// Fills the database with a made-up demo club (Fernhill Golf Club) so you can click around.
// Run with: npm run db:seed   (only for development or a demo database, never a real club's)
import "./env";
import { sql } from "../src/lib/db";
import { importMembers, importTeeTimes } from "../src/lib/importer";
import { releaseDueMonths } from "../src/lib/release";
import { localParts, monthStart } from "../src/lib/time";

const TZ = "Europe/London";
// name, how quick they really are (1-5), handicap
const PEOPLE: [string, number, string][] = [
  ["Tom Harland", 4.6, "9"], ["James Okafor", 4.7, "12"], ["Priya Desai", 4.2, "18"], ["Mark Whitley", 2.2, "24"],
  ["Sarah Lindqvist", 4.9, "4"], ["David Brennan", 3.8, "15"], ["Helen Marsh", 4.0, "20"], ["Rob Castellano", 4.4, "11"],
  ["Graham Pike", 2.7, "22"], ["Aisha Rahman", 4.6, "14"], ["Colin Fairweather", 3.4, "17"], ["Nina Patel", 4.5, "26"],
  ["Owen Hughes", 4.1, "8"], ["Fiona Clarke", 4.8, "6"], ["Stuart Bell", 4.0, "19"], ["Ellie Moran", 4.2, "28"], ["Ken Tanaka", 4.3, "13"],
];
const RARE = new Set(["Helen Marsh", "Nina Patel", "Ellie Moran"]); // play rarely, so not enough votes yet

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const shuffle = <T,>(a: T[]) => a.map((x) => [rand(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
const pad = (n: number) => String(n).padStart(2, "0");

async function main() {
  await sql`delete from clubs where slug = 'fernhill-demo'`;
  const [club] = await sql<{ id: string; timezone: string; invite_delay_hours: number }[]>`
    insert into clubs (name, slug, invite_channel) values ('Fernhill Golf Club', 'fernhill-demo', 'sms')
    returning id, timezone, invite_delay_hours`;
  await sql`insert into members (club_id, external_id, name, email, role) values (${club.id}, 'secretary', 'Jane Holloway', 'secretary@fernhill.example', 'secretary')`;
  await importMembers(club.id, PEOPLE.map(([name, , handicap], i) => ({
    externalId: String(1001 + i), name, handicap,
    email: name.toLowerCase().replace(/[^a-z]+/g, ".") + "@fernhill.example",
    phone: `07700 900${String(100 + i)}`,
  })));
  const members = await sql<{ id: string; name: string; external_id: string }[]>`select id, name, external_id from members where club_id = ${club.id} and role = 'member'`;
  const byName = new Map(members.map((m) => [m.name, m]));
  const pace = new Map(PEOPLE.map(([n, p]) => [n, p]));

  // About 4 months of past rounds, plus a few in the coming week.
  const now = new Date();
  const bookings = [];
  for (let d = -125; d <= 6; d++) {
    const day = new Date(now.getTime() + d * 86400_000);
    const p = localParts(day, TZ);
    const groups = d > 0 ? 1 : 2;
    for (let g = 0; g < groups; g++) {
      const pool = shuffle(PEOPLE.map((x) => x[0]).filter((n) => !RARE.has(n) || rand() < 0.05));
      const four = pool.slice(0, 3 + (rand() < 0.6 ? 1 : 0));
      if (d === 6 && g === 0) four.splice(0, four.length, "Tom Harland", "Rob Castellano", "Mark Whitley", "Nina Patel");
      bookings.push({
        externalId: `demo-${d}-${g}`,
        teeTime: `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(8 + g * 2)}:${g ? "20" : "40"}`,
        course: "Old Course",
        memberIds: four.map((n) => byName.get(n)!.external_id),
      });
    }
  }
  await importTeeTimes(club, bookings);

  // Past rounds: invites sent and most people rated.
  const rounds = await sql<{ id: string; tee_time: Date }[]>`select id, tee_time from rounds where club_id = ${club.id} and tee_time < now() - interval '6 hours'`;
  const thisMonth = monthStart(localParts(now, TZ).year, localParts(now, TZ).month, TZ);
  for (const r of rounds) {
    await sql`update rounds set invites_sent_at = invites_due_at where id = ${r.id}`;
    const players = await sql<{ id: string; name: string }[]>`select m.id, m.name from round_players rp join members m on m.id = rp.member_id where rp.round_id = ${r.id}`;
    for (const rater of players) {
      if (rand() < 0.3) continue;
      for (const ratee of players) {
        if (ratee.id === rater.id) continue;
        let stars = Math.max(1, Math.min(5, Math.round(pace.get(ratee.name)! + (rand() - 0.5) * 1.6)));
        if (rater.name === "Colin Fairweather" && (ratee.name === "Stuart Bell" || ratee.name === "Owen Hughes")) stars = 1;
        const low = stars <= 2;
        const recent = r.tee_time >= thisMonth && r.tee_time.getTime() > now.getTime() - 12 * 86400_000;
        const status = !low ? "counted" : recent ? "pending" : rand() < 0.85 ? "accepted" : "dismissed";
        const reasons = low ? shuffle(["Slow between shots", "Long ball searches", "Didn't let faster groups through", "Too many practice swings"]).slice(0, 1 + Math.floor(rand() * 2)) : [];
        const note = low && rand() < 0.5 ? (rater.name === "Colin Fairweather" ? "He knows why." : "We lost a hole on the group in front by the turn.") : null;
        await sql`insert into ratings (club_id, round_id, rater_id, ratee_id, stars, reasons, note, status, created_at)
                  values (${club.id}, ${r.id}, ${rater.id}, ${ratee.id}, ${stars}, ${reasons}, ${note}, ${status}, ${new Date(r.tee_time.getTime() + 6 * 3600_000)})
                  on conflict do nothing`;
      }
      await sql`insert into invites (round_id, member_id, token_hash, sent_at, completed_at, channel, expires_at)
                values (${r.id}, ${rater.id}, ${"seed-" + r.id + rater.id}, ${r.tee_time}, ${r.tee_time}, 'sms', ${new Date(r.tee_time.getTime() + 7 * 86400_000)})
                on conflict do nothing`;
    }
  }
  // Leave Tom's most recent round unrated so the dashboard shows "rate your last round".
  const [last] = await sql<{ id: string }[]>`
    select r.id from rounds r join round_players rp on rp.round_id = r.id
    where r.club_id = ${club.id} and rp.member_id = ${byName.get("Tom Harland")!.id} and r.tee_time < now() - interval '6 hours'
    order by r.tee_time desc limit 1`;
  if (last) {
    await sql`delete from ratings where round_id = ${last.id} and rater_id = ${byName.get("Tom Harland")!.id}`;
    await sql`update invites set completed_at = null where round_id = ${last.id} and member_id = ${byName.get("Tom Harland")!.id}`;
  }

  // Publish the last 4 monthly releases as if they had run on the 1st of each month.
  const p = localParts(now, TZ);
  for (let k = 3; k >= 0; k--) await releaseDueMonths(new Date(monthStart(p.year, p.month - k, TZ).getTime() + 3600_000));

  console.log("Demo club ready: Fernhill Golf Club.");
  console.log("Sign in at /login as tom.harland@fernhill.example (member) or secretary@fernhill.example (secretary).");
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
