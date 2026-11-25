// End-to-end check against a real database: tee time -> message -> rating -> review -> monthly release.
// Needs TEST_DATABASE_URL (an empty database it can wipe). Skipped otherwise.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const url = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL = url;

describe.skipIf(!url)("full flow", async () => {
  const { sql } = await import("@/lib/db");
  const { importMembers, importTeeTimes } = await import("@/lib/importer");
  const { sendDueInvites } = await import("@/lib/invites");
  const { lookupInvite, saveRatings } = await import("@/lib/ratings");
  const { releaseDueMonths } = await import("@/lib/release");
  const { reviewQueue } = await import("@/lib/secretary");
  let clubId = "";
  const links: string[] = [];

  beforeAll(async () => {
    await sql.unsafe("drop schema public cascade; create schema public;");
    await sql.unsafe(readFileSync("db/migrations/001_init.sql", "utf8"));
    vi.spyOn(console, "log").mockImplementation((m: string) => { const x = String(m).match(/\/r\/(\w+)/); if (x) links.push(x[1]); });
    [{ id: clubId }] = await sql`insert into clubs (name, slug, min_votes) values ('Test GC', 'test', 2) returning id`;
    await importMembers(clubId, ["Ann", "Ben", "Cat", "Dan"].map((n, i) => ({ externalId: String(i + 1), name: `${n} Test`, phone: `0770090000${i}` })));
  });
  afterAll(async () => { await sql.end(); });

  it("runs a round from tee time to monthly release", async () => {
    const [club] = await sql`select id, timezone, invite_delay_hours from clubs where id = ${clubId}`;
    await importTeeTimes(club as never, [{ externalId: "B1", teeTime: "2026-10-10 09:00", course: "Old", memberIds: ["1", "2", "3", "4"] }]);
    const sendAt = new Date("2026-10-10T13:30:00Z"); // 14:30 BST, 5h30 after the tee
    expect((await sendDueInvites(new Date("2026-10-10T12:00:00Z"))).sent).toBe(0); // too early
    expect((await sendDueInvites(sendAt)).sent).toBe(4);
    expect((await sendDueInvites(sendAt)).sent).toBe(0); // never twice
    expect(links).toHaveLength(4);

    // Everyone rates Dan 1 star with a reason and the others 4 stars. Links expire 7 days after sending,
    // so pretend it's still October inside the database by backdating the expiry check.
    await sql`update invites set expires_at = now() + interval '1 day'`;
    for (const token of links) {
      const inv = await lookupInvite(token);
      expect(inv.state).toBe("ok");
      if (inv.state !== "ok") continue;
      const res = await saveRatings(inv.round, inv.round.partners.map((p) => (
        p.name.startsWith("Dan") ? { rateeId: p.id, stars: 1, reasons: ["Long ball searches"], note: "" } : { rateeId: p.id, stars: 4, reasons: [], note: "" }
      )));
      expect(res.ok).toBe(true);
      const again = await lookupInvite(token);
      expect(again.state === "ok" && again.round.alreadyRated).toBe(true);
    }
    await sql`update ratings set created_at = '2026-10-10T15:00:00Z'`;

    const queue = await reviewQueue(clubId);
    expect(queue.filter((c) => c.status === "pending")).toHaveLength(3);
    // Accept two of Dan's low ratings, dismiss one.
    await sql`update ratings set status = 'accepted' where id = any(${queue.slice(0, 2).map((c) => c.id)})`;
    await sql`update ratings set status = 'dismissed' where id = ${queue[2].id}`;

    const released = await releaseDueMonths(new Date("2026-11-01T00:30:00Z"));
    expect(released).toEqual(["Test GC 2026-10-01"]);
    expect(await releaseDueMonths(new Date("2026-11-01T01:30:00Z"))).toEqual([]); // once per month
    const scores = await sql`select m.name, s.votes, s.average::float from member_scores s join members m on m.id = s.member_id order by m.name`;
    expect(scores.map((s) => [s.name, s.votes, s.average])).toEqual([
      ["Ann Test", 3, 4], ["Ben Test", 3, 4], ["Cat Test", 3, 4], ["Dan Test", 2, 1],
    ]);
  });
});
