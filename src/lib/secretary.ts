import { sql } from "./db";
import { patternWarnings } from "./rules";
import { localParts, monthStart } from "./time";

export type Case = {
  id: string;
  stars: number;
  reasons: string[];
  note: string | null;
  status: "pending" | "accepted" | "dismissed";
  reminded: boolean;
  teeTime: Date;
  rateeId: string;
  rateeName: string;
  raterName: string;
  warnings: string[];
};

/** Low ratings waiting for review, plus ones reviewed in the last 14 days so they can be undone. */
export async function reviewQueue(clubId: string, now = new Date()): Promise<Case[]> {
  const rows = await sql`
    select ra.id, ra.stars, ra.reasons, ra.note, ra.status, ra.reminder_sent_at is not null as reminded, ra.rater_id,
           r.tee_time, ee.id as ratee_id, ee.name as ratee_name, er.name as rater_name
    from ratings ra join rounds r on r.id = ra.round_id
    join members ee on ee.id = ra.ratee_id join members er on er.id = ra.rater_id
    where ra.club_id = ${clubId} and ra.stars <= 2
      and (ra.status = 'pending' or ra.reviewed_at > now() - interval '14 days')
    order by (ra.status = 'pending') desc, ra.created_at desc
    limit 200`;
  const raterIds = [...new Set(rows.map((r) => r.rater_id as string))];
  const history = raterIds.length
    ? await sql`select rater_id, ratee_id, created_at, stars from ratings where rater_id = any(${raterIds})`
    : [];
  const rateeIds = [...new Set(rows.map((r) => r.ratee_id as string))];
  const onRatees = rateeIds.length
    ? await sql`select rater_id, ratee_id, stars from ratings
                where ratee_id = any(${rateeIds}) and status <> 'dismissed' and created_at > ${now}::timestamptz - interval '90 days'`
    : [];
  return rows.map((r) => {
    const mine = history.filter((h) => h.rater_id === r.rater_id);
    return {
      id: r.id, stars: r.stars, reasons: r.reasons, note: r.note, status: r.status, reminded: r.reminded,
      teeTime: r.tee_time, rateeId: r.ratee_id, rateeName: r.ratee_name, raterName: r.rater_name,
      warnings: patternWarnings({
        raterName: r.rater_name, rateeId: r.ratee_id, rateeName: r.ratee_name, now,
        lowRatings: mine.filter((h) => h.stars <= 2).map((h) => ({ rateeId: h.ratee_id, createdAt: h.created_at })),
        totalRatings: mine.length,
        othersOnRatee: onRatees.filter((x) => x.ratee_id === r.ratee_id && x.rater_id !== r.rater_id).map((x) => x.stars as number),
      }),
    };
  });
}

export async function secretaryStats(clubId: string, timezone: string, now = new Date()) {
  const p = localParts(now, timezone);
  const start = monthStart(p.year, p.month, timezone);
  const [s] = await sql<{ open: number; sent: number; replied: number }[]>`
    select
      (select count(*)::int from ratings where club_id = ${clubId} and status = 'pending') as open,
      (select count(*)::int from invites i join rounds r on r.id = i.round_id where r.club_id = ${clubId} and i.sent_at >= ${start}) as sent,
      (select count(*)::int from invites i join rounds r on r.id = i.round_id where r.club_id = ${clubId} and i.sent_at >= ${start} and i.completed_at is not null) as replied`;
  return s;
}
