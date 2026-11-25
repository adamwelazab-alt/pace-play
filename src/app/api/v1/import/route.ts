import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { sql } from "@/lib/db";
import { importMembers, importTeeTimes, type MemberRow, type TeeTimeInput } from "@/lib/importer";

export const dynamic = "force-dynamic";

/**
 * For booking systems that can push data automatically.
 *   POST /api/v1/import
 *   Authorization: Bearer <club API key>
 *   { "members": [{ "member_id": "1001", "name": "Tom Harland", "email": "...", "mobile": "...", "handicap": "9" }],
 *     "tee_times": [{ "booking_ref": "B1042", "start": "2026-11-22 09:40", "course": "Old Course", "member_ids": ["1001","1002"] }] }
 * Times without a zone are taken as the club's local time.
 */
export async function POST(req: Request) {
  const key = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!key) return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  const [club] = await sql<{ id: string; timezone: string; invite_delay_hours: number }[]>`
    select id, timezone, invite_delay_hours from clubs where api_key_hash = ${createHash("sha256").update(key).digest("hex")}`;
  if (!club) return NextResponse.json({ error: "Wrong API key" }, { status: 401 });

  let body: { members?: Record<string, unknown>[]; tee_times?: Record<string, unknown>[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body must be JSON" }, { status: 400 }); }
  const members = Array.isArray(body.members) ? body.members.slice(0, 5000) : [];
  const teeTimes = Array.isArray(body.tee_times) ? body.tee_times.slice(0, 2000) : [];
  const s = (x: unknown) => (x === undefined || x === null ? "" : String(x));

  const memberReport = members.length
    ? await importMembers(club.id, members.map((m): MemberRow => ({ externalId: s(m.member_id), name: s(m.name), email: s(m.email), phone: s(m.mobile ?? m.phone), handicap: s(m.handicap) })))
    : null;
  const teeReport = teeTimes.length
    ? await importTeeTimes(club, teeTimes.map((t): TeeTimeInput => ({ externalId: s(t.booking_ref), teeTime: s(t.start), course: s(t.course), memberIds: Array.isArray(t.member_ids) ? t.member_ids.map(s) : [] })))
    : null;
  return NextResponse.json({ members: memberReport, tee_times: teeReport });
}
