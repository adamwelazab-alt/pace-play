import { sql } from "./db";
import type { Viewer } from "./auth";

export type ScoreRow = { id: string; name: string; handicap: string | null; votes: number; average: number | null };

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function latestRelease(clubId: string) {
  const [r] = await sql<{ id: string; period: Date; released_at: Date }[]>`
    select id, period, released_at from releases where club_id = ${clubId} order by period desc limit 1`;
  return r ?? null;
}

/** Every active member with their score from the latest monthly release. */
export async function memberScores(clubId: string, releaseId: string | null): Promise<ScoreRow[]> {
  const rows = await sql`
    select m.id, m.name, m.handicap, coalesce(s.votes, 0)::int as votes, s.average
    from members m left join member_scores s on s.member_id = m.id and s.release_id = ${releaseId}
    where m.club_id = ${clubId} and m.active and m.external_id is distinct from 'secretary'
    order by m.name`;
  return rows.map((r) => ({ id: r.id, name: r.name, handicap: r.handicap, votes: r.votes, average: num(r.average) }));
}

export async function myHistory(memberId: string) {
  const rows = await sql`
    select r.period, s.month_average, s.month_votes from member_scores s join releases r on r.id = s.release_id
    where s.member_id = ${memberId} order by r.period desc limit 6`;
  return rows.reverse().map((r) => ({ period: r.period as Date, average: num(r.month_average), votes: r.month_votes as number }));
}

export async function upcomingRounds(viewer: Viewer, releaseId: string | null) {
  const rounds = await sql<{ id: string; tee_time: Date; course: string | null }[]>`
    select r.id, r.tee_time, r.course from rounds r join round_players rp on rp.round_id = r.id
    where rp.member_id = ${viewer.id} and r.tee_time > now() and r.tee_time < now() + interval '14 days'
    order by r.tee_time limit 1`;
  const out = [];
  for (const r of rounds) {
    const partners = await sql`
      select m.id, m.name, m.handicap, coalesce(s.votes, 0)::int as votes, s.average
      from round_players rp join members m on m.id = rp.member_id
      left join member_scores s on s.member_id = m.id and s.release_id = ${releaseId}
      where rp.round_id = ${r.id} and m.id <> ${viewer.id} order by m.name`;
    out.push({ ...r, partners: partners.map((p) => ({ id: p.id, name: p.name, handicap: p.handicap, votes: p.votes, average: num(p.average) })) });
  }
  return out;
}

/** Recent rounds this member played but hasn't rated yet. */
export async function roundsToRate(memberId: string) {
  return sql<{ id: string; tee_time: Date; course: string | null }[]>`
    select r.id, r.tee_time, r.course from rounds r join round_players rp on rp.round_id = r.id
    where rp.member_id = ${memberId} and r.invites_sent_at is not null and r.tee_time > now() - interval '7 days'
      and (select count(*) from round_players x where x.round_id = r.id) > 1
      and not exists (select 1 from ratings ra where ra.round_id = r.id and ra.rater_id = ${memberId})
    order by r.tee_time desc`;
}
