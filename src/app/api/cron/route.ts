import { NextResponse } from "next/server";
import { sendDueInvites } from "@/lib/invites";
import { purgeOldData, releaseDueMonths } from "@/lib/release";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The scheduled job. Call it every 15 minutes with the header "Authorization: Bearer <CRON_SECRET>".
 * It sends due rating requests, publishes the monthly release on the 1st, and deletes old data.
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  const invites = await sendDueInvites();
  const released = await releaseDueMonths();
  const purged = await purgeOldData();
  return NextResponse.json({ invites, released, purged });
}

export const GET = run;
export const POST = run;
