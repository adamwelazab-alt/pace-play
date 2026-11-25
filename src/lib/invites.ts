import { sql } from "./db";
import { newToken, hashToken } from "./tokens";
import { appUrl, sendToMember } from "./messaging";
import { formatTime, localParts } from "./time";

const LINK_DAYS = 7;

function greetingWhen(tee: Date, tz: string, now: Date) {
  const t = localParts(tee, tz), n = localParts(now, tz);
  const sameDay = t.year === n.year && t.month === n.month && t.day === n.day;
  const part = t.hour < 12 ? "morning" : t.hour < 17 ? "afternoon" : "evening";
  return sameDay ? `this ${part}` : "yesterday";
}

/**
 * Sends the rating link for every round whose time has come (5 hours after tee time by default).
 * Safe to run as often as you like: each round is only sent once.
 */
export async function sendDueInvites(now = new Date()): Promise<{ rounds: number; sent: number; failed: number }> {
  let rounds = 0, sent = 0, failed = 0;
  for (;;) {
    // Claim one round at a time so two runs at once never double-send.
    const [round] = await sql<{ id: string; tee_time: Date; club_name: string; timezone: string; channel: "sms" | "email"; stale: boolean }[]>`
      update rounds r set invites_sent_at = now()
      from clubs c
      where r.id = (
        select id from rounds where invites_sent_at is null and invites_due_at <= ${now}
        order by invites_due_at limit 1 for update skip locked
      ) and c.id = r.club_id
      returning r.id, r.tee_time, c.name as club_name, c.timezone, c.invite_channel as channel,
                r.tee_time < ${now}::timestamptz - interval '3 days' as stale`;
    if (!round) break;
    rounds++;
    if (round.stale) continue; // a very old booking was imported late; don't text people about it

    const players = await sql<{ id: string; name: string; email: string | null; phone: string | null }[]>`
      select m.id, m.name, m.email, m.phone from round_players rp join members m on m.id = rp.member_id
      where rp.round_id = ${round.id} and m.active and not m.opted_out`;
    const [{ count }] = await sql<{ count: number }[]>`select count(*)::int as count from round_players where round_id = ${round.id}`;
    if (count < 2) continue;

    for (const p of players) {
      const token = newToken();
      const inserted = await sql`
        insert into invites (round_id, member_id, token_hash, expires_at)
        values (${round.id}, ${p.id}, ${hashToken(token)}, ${now}::timestamptz + make_interval(days => ${LINK_DAYS}))
        on conflict (round_id, member_id) do nothing returning id`;
      if (!inserted[0]) continue;
      const url = `${appUrl()}/r/${token}`;
      const first = p.name.split(" ")[0];
      const when = greetingWhen(round.tee_time, round.timezone, now);
      const tee = formatTime(round.tee_time, round.timezone);
      const result = await sendToMember(p, round.channel, {
        sms: `Hi ${first}, thanks for playing at ${round.club_name} ${when} (${tee} tee). How was the pace of your group? Rate your playing partners in under a minute: ${url}\nYour ratings are anonymous.`,
        subject: `How was the pace of your round at ${round.club_name}?`,
        email: `Hi ${first},\n\nThanks for playing at ${round.club_name} ${when} (${tee} tee). How was the pace of your group? It takes under a minute to rate your playing partners.\n\nYour ratings are anonymous. Members never see who rated them, and ratings are only released once a month.`,
        button: { label: "Rate your playing partners", url },
      });
      if (result.ok) {
        sent++;
        await sql`update invites set sent_at = now(), channel = ${result.channel} where id = ${inserted[0].id}`;
      } else {
        failed++;
        await sql`update invites set send_error = ${result.error} where id = ${inserted[0].id}`;
      }
    }
  }
  return { rounds, sent, failed };
}
