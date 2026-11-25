import { sql } from "./db";
import { hashToken } from "./tokens";
import { isLow, validateRatings, type ValidationResult } from "./rules";

export type RoundForRating = {
  roundId: string;
  raterId: string;
  raterName: string;
  clubName: string;
  timezone: string;
  teeTime: Date;
  course: string | null;
  partners: { id: string; name: string; handicap: string | null }[];
  alreadyRated: boolean;
};

async function loadRound(roundId: string, raterId: string): Promise<RoundForRating | null> {
  const [r] = await sql<{ tee_time: Date; course: string | null; club_name: string; timezone: string; rater_name: string }[]>`
    select r.tee_time, r.course, c.name as club_name, c.timezone, m.name as rater_name
    from rounds r join clubs c on c.id = r.club_id
    join round_players rp on rp.round_id = r.id and rp.member_id = ${raterId}
    join members m on m.id = rp.member_id
    where r.id = ${roundId}`;
  if (!r) return null;
  const partners = await sql<{ id: string; name: string; handicap: string | null }[]>`
    select m.id, m.name, m.handicap from round_players rp join members m on m.id = rp.member_id
    where rp.round_id = ${roundId} and rp.member_id <> ${raterId} and m.active
    order by m.name`;
  const [done] = await sql`select 1 from ratings where round_id = ${roundId} and rater_id = ${raterId} limit 1`;
  return {
    roundId, raterId, raterName: r.rater_name, clubName: r.club_name, timezone: r.timezone,
    teeTime: r.tee_time, course: r.course, partners, alreadyRated: !!done,
  };
}

export type InviteLookup =
  | { state: "ok"; round: RoundForRating }
  | { state: "expired" | "missing" | "opted_out"; clubName?: string };

/** Finds the round behind a link from a text or email. */
export async function lookupInvite(token: string): Promise<InviteLookup> {
  const [inv] = await sql<{ id: string; round_id: string; member_id: string; expired: boolean; opted_out: boolean; club_name: string }[]>`
    select i.id, i.round_id, i.member_id, i.expires_at < now() as expired, m.opted_out, c.name as club_name
    from invites i join members m on m.id = i.member_id join clubs c on c.id = m.club_id
    where i.token_hash = ${hashToken(token)} and m.active`;
  if (!inv) return { state: "missing" };
  if (inv.opted_out) return { state: "opted_out", clubName: inv.club_name };
  if (inv.expired) return { state: "expired", clubName: inv.club_name };
  await sql`update invites set opened_at = coalesce(opened_at, now()) where id = ${inv.id}`;
  const round = await loadRound(inv.round_id, inv.member_id);
  return round ? { state: "ok", round } : { state: "missing" };
}

/** For a signed-in member rating from the dashboard. Only rounds in the last 7 days. */
export async function lookupRoundForMember(roundId: string, memberId: string): Promise<RoundForRating | null> {
  const [ok] = await sql`select 1 from rounds where id = ${roundId} and invites_sent_at is not null and tee_time > now() - interval '7 days'`;
  if (!ok) return null;
  return loadRound(roundId, memberId);
}

/** Saves ratings. Low ratings wait for the secretary; the rest count straight away. */
export async function saveRatings(round: RoundForRating, input: unknown): Promise<ValidationResult> {
  if (round.alreadyRated) return { ok: false, errors: { form: "You've already rated this round. Thanks!" } };
  const result = validateRatings(input, round.partners.map((p) => p.id));
  if (!result.ok) return result;
  await sql.begin(async (tx) => {
    for (const r of result.ratings) {
      await tx`
        insert into ratings (club_id, round_id, rater_id, ratee_id, stars, reasons, note, status)
        select club_id, ${round.roundId}, ${round.raterId}, ${r.rateeId}, ${r.stars}, ${r.reasons}, ${r.note || null},
               ${isLow(r.stars) ? "pending" : "counted"}
        from rounds where id = ${round.roundId}
        on conflict (round_id, rater_id, ratee_id) do nothing`;
    }
    await tx`update invites set completed_at = now() where round_id = ${round.roundId} and member_id = ${round.raterId}`;
  });
  return result;
}

/** Stops future rating messages to this member. They can ask the club to turn them back on. */
export async function optOutByToken(token: string): Promise<boolean> {
  const rows = await sql`
    update members set opted_out = true
    where id = (select member_id from invites where token_hash = ${hashToken(token)}) returning id`;
  return rows.length > 0;
}
