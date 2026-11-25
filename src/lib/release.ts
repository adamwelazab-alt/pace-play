import { sql } from "./db";
import { localParts, monthStart } from "./time";

/**
 * Publishes last month's ratings on the 1st. Each member's score is the average of every rating
 * from rounds in the last few months (3 by default) that counts: 3 to 5 stars, or a low rating the
 * secretary accepted. Low ratings still waiting for review, and dismissed ones, are left out.
 * Scores are only shown once a member has at least the club's minimum number of votes (5).
 */
export async function releaseDueMonths(now = new Date()): Promise<string[]> {
  const clubs = await sql<{ id: string; name: string; timezone: string; min_votes: number; window_months: number }[]>`
    select id, name, timezone, min_votes, window_months from clubs`;
  const done: string[] = [];
  for (const club of clubs) {
    const p = localParts(now, club.timezone);
    // The month just finished, at the club's own clock.
    const periodStart = monthStart(p.year, p.month - 1, club.timezone);
    const periodEnd = monthStart(p.year, p.month, club.timezone);
    const windowStart = monthStart(p.year, p.month - club.window_months, club.timezone);
    const pd = localParts(new Date(periodStart.getTime() + 3600_000 * 12), club.timezone);
    const period = `${pd.year}-${String(pd.month).padStart(2, "0")}-01`;

    const released = await sql.begin(async (tx) => {
      const [rel] = await tx<{ id: string }[]>`
        insert into releases (club_id, period, released_at) values (${club.id}, ${period}, ${now})
        on conflict (club_id, period) do nothing returning id`;
      if (!rel) return false;
      await tx`
        insert into member_scores (release_id, member_id, votes, average, month_votes, month_average)
        select ${rel.id}, m.id,
               count(x.stars)::int,
               case when count(x.stars) >= ${club.min_votes} then round(avg(x.stars), 2) end,
               count(x.stars) filter (where x.tee_time >= ${periodStart})::int,
               case when count(x.stars) filter (where x.tee_time >= ${periodStart}) >= ${club.min_votes}
                    then round(avg(x.stars) filter (where x.tee_time >= ${periodStart}), 2) end
        from members m
        left join (
          select ra.ratee_id, ra.stars, r.tee_time from ratings ra join rounds r on r.id = ra.round_id
          where ra.club_id = ${club.id} and ra.status in ('counted','accepted')
            and r.tee_time >= ${windowStart} and r.tee_time < ${periodEnd}
            and ra.created_at < ${now}
        ) x on x.ratee_id = m.id
        where m.club_id = ${club.id} and m.active
        group by m.id`;
      return true;
    });
    if (released) done.push(`${club.name} ${period}`);
  }
  return done;
}

/** How long data is kept. Older rounds and ratings are deleted for good. */
export const KEEP_MONTHS = 18;

export async function purgeOldData(now = new Date()) {
  const rounds = await sql`delete from rounds where tee_time < ${now}::timestamptz - make_interval(months => ${KEEP_MONTHS}) returning id`;
  const releases = await sql`delete from releases where released_at < ${now}::timestamptz - make_interval(months => ${KEEP_MONTHS}) returning id`;
  await sql`delete from sessions where expires_at < now()`;
  await sql`delete from login_tokens where expires_at < now() - interval '1 day'`;
  return { rounds: rounds.length, releases: releases.length };
}
