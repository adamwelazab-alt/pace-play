import { sql } from "./db";
import { pick } from "./csv";
import { normaliseEmail, normalisePhone } from "./rules";
import { inviteTime, parseLocalDateTime } from "./time";

type Club = { id: string; timezone: string; invite_delay_hours: number };

export type ImportReport = { added: number; updated: number; skipped: string[]; left?: number };

export type MemberRow = { externalId: string; name: string; email?: string | null; phone?: string | null; handicap?: string | null };

/** Adds or updates members, matching on the club's member number. */
export async function importMembers(clubId: string, rows: MemberRow[], markMissingAsLeft = false): Promise<ImportReport> {
  const report: ImportReport = { added: 0, updated: 0, skipped: [] };
  const seen: string[] = [];
  for (const [i, r] of rows.entries()) {
    const line = `Row ${i + 2}`;
    const externalId = (r.externalId || "").trim();
    const name = (r.name || "").trim();
    if (!externalId || !name) { report.skipped.push(`${line}: needs a member number and a name.`); continue; }
    const email = normaliseEmail(r.email);
    const phone = normalisePhone(r.phone);
    if (r.email && !email) report.skipped.push(`${line} (${name}): email "${r.email}" doesn't look right, saved without it.`);
    if (r.phone && !phone) report.skipped.push(`${line} (${name}): mobile "${r.phone}" doesn't look right, saved without it.`);
    const [res] = await sql<{ inserted: boolean }[]>`
      insert into members (club_id, external_id, name, email, phone, handicap)
      values (${clubId}, ${externalId}, ${name}, ${email}, ${phone}, ${r.handicap?.trim() || null})
      on conflict (club_id, external_id) do update set
        name = excluded.name,
        email = coalesce(excluded.email, members.email),
        phone = coalesce(excluded.phone, members.phone),
        handicap = coalesce(excluded.handicap, members.handicap),
        active = true
      returning (xmax = 0) as inserted`;
    seen.push(externalId);
    if (res.inserted) report.added++; else report.updated++;
  }
  if (markMissingAsLeft && seen.length > 0) {
    const left = await sql`
      update members set active = false
      where club_id = ${clubId} and active and role <> 'secretary' and external_id is not null and not (external_id = any(${seen}))
      returning id`;
    report.left = left.length;
  }
  return report;
}

export function memberRowsFromCsv(rows: Record<string, string>[]): MemberRow[] {
  return rows.map((r) => ({
    externalId: pick(r, "member_id", "member_number", "member_no", "membership_number", "id", "number"),
    name: pick(r, "name", "full_name", "member_name") || [pick(r, "first_name", "forename"), pick(r, "last_name", "surname")].filter(Boolean).join(" "),
    email: pick(r, "email", "email_address", "e_mail"),
    phone: pick(r, "mobile", "mobile_number", "phone", "phone_number", "telephone"),
    handicap: pick(r, "handicap", "handicap_index", "hcp"),
  }));
}

export type TeeTimeInput = { externalId: string; teeTime: string; course?: string | null; memberIds: string[] };

/** Adds tee times and who played in each. Each booking is matched on its booking reference. */
export async function importTeeTimes(club: Club, bookings: TeeTimeInput[]): Promise<ImportReport> {
  const report: ImportReport = { added: 0, updated: 0, skipped: [] };
  const members = await sql<{ id: string; external_id: string }[]>`
    select id, external_id from members where club_id = ${club.id} and external_id is not null`;
  const byExt = new Map(members.map((m) => [m.external_id, m.id]));
  for (const b of bookings) {
    const label = `Booking ${b.externalId || "(no reference)"}`;
    const tee = parseLocalDateTime(b.teeTime, club.timezone);
    if (!tee) { report.skipped.push(`${label}: couldn't read the date and time "${b.teeTime}".`); continue; }
    const ids: string[] = [];
    for (const ext of b.memberIds) {
      const id = byExt.get(ext.trim());
      if (id) { if (!ids.includes(id)) ids.push(id); }
      else if (ext.trim()) report.skipped.push(`${label}: member number ${ext} isn't in the member list (guest?), left out.`);
    }
    if (ids.length < 2) { report.skipped.push(`${label}: fewer than 2 members, nobody to rate.`); continue; }
    const due = inviteTime(tee, club.invite_delay_hours, club.timezone);
    const externalId = b.externalId || `${tee.toISOString()}|${b.course ?? ""}|${[...b.memberIds].sort().join(",")}`;
    await sql.begin(async (tx) => {
      const [round] = await tx<{ id: string; inserted: boolean; sent: boolean }[]>`
        insert into rounds (club_id, external_id, tee_time, course, invites_due_at)
        values (${club.id}, ${externalId}, ${tee}, ${b.course || null}, ${due})
        on conflict (club_id, external_id) do update set
          tee_time = case when rounds.invites_sent_at is null then excluded.tee_time else rounds.tee_time end,
          course = excluded.course,
          invites_due_at = case when rounds.invites_sent_at is null then excluded.invites_due_at else rounds.invites_due_at end
        returning id, (xmax = 0) as inserted, invites_sent_at is not null as sent`;
      if (!round.sent) {
        await tx`delete from round_players where round_id = ${round.id}`;
        for (const id of ids) await tx`insert into round_players (round_id, member_id) values (${round.id}, ${id}) on conflict do nothing`;
      }
      if (round.inserted) report.added++; else report.updated++;
    });
  }
  return report;
}

/**
 * Reads a tee sheet export. Accepts one row per player (booking_ref, date, time, course, member_id),
 * or one row per booking with the member numbers in a "players" column separated by ; or |.
 */
export function teeTimesFromCsv(rows: Record<string, string>[]): TeeTimeInput[] {
  const map = new Map<string, TeeTimeInput>();
  for (const r of rows) {
    const date = pick(r, "date", "tee_date", "play_date");
    const time = pick(r, "time", "tee_time_local", "start_time");
    const combined = pick(r, "tee_time", "datetime", "start", "date_time");
    const teeTime = combined || `${date} ${time}`.trim();
    const course = pick(r, "course", "course_name", "tee");
    const ref = pick(r, "booking_ref", "booking_id", "booking", "reference", "ref");
    const players = pick(r, "players", "member_ids", "members");
    const single = pick(r, "member_id", "member_number", "member_no", "membership_number");
    const ids = players ? players.split(/[;|]/).map((s) => s.trim()).filter(Boolean) : single ? [single] : [];
    const key = ref || `${teeTime}|${course}`;
    const cur = map.get(key) ?? { externalId: ref, teeTime, course, memberIds: [] };
    cur.memberIds.push(...ids);
    map.set(key, cur);
  }
  return [...map.values()];
}
