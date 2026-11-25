"use server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireSecretary } from "@/lib/auth";
import { sendToMember, appUrl } from "@/lib/messaging";
import { parseCsv } from "@/lib/csv";
import { importMembers, importTeeTimes, memberRowsFromCsv, teeTimesFromCsv, type ImportReport } from "@/lib/importer";
import { createHash, randomBytes } from "node:crypto";

export async function reviewAction(form: FormData) {
  const v = await requireSecretary();
  const id = String(form.get("id"));
  const action = String(form.get("action"));
  if (action === "undo") {
    await sql`update ratings set status = 'pending', reviewed_by = null, reviewed_at = null where id = ${id} and club_id = ${v.clubId} and stars <= 2`;
  } else if (action === "accept" || action === "remind" || action === "dismiss") {
    const [r] = await sql<{ ratee_id: string; reminder_sent_at: Date | null }[]>`
      update ratings set status = ${action === "dismiss" ? "dismissed" : "accepted"}, reviewed_by = ${v.id}, reviewed_at = now()
      where id = ${id} and club_id = ${v.clubId} and stars <= 2 returning ratee_id, reminder_sent_at`;
    if (r && action === "remind" && !r.reminder_sent_at) {
      const [m] = await sql<{ name: string; email: string | null; phone: string | null }[]>`select name, email, phone from members where id = ${r.ratee_id}`;
      const first = m.name.split(" ")[0];
      // Deliberately general: no date, round or rater, so it can't be traced back to anyone.
      const text = `Hi ${first},\n\nA quick, friendly note from ${v.clubName}. We've had some feedback about pace of play in groups you've been part of recently. Keeping up with the group in front, being ready to play when it's your turn, and calling faster groups through all help everyone enjoy their round.\n\nThanks for your help.\n${v.name}`;
      const res = await sendToMember(m, "email", {
        sms: `Hi ${first}, a friendly note from ${v.clubName}: we've had some feedback about pace of play in groups you've been part of recently. Being ready to play and calling faster groups through helps everyone. Thanks, ${v.name}`,
        subject: `A note about pace of play from ${v.clubName}`,
        email: text,
        button: { label: "See your pace rating", url: `${appUrl()}/login` },
      });
      if (res.ok) await sql`update ratings set reminder_sent_at = now() where id = ${id}`;
    }
  }
  revalidatePath("/secretary");
}

export async function memberAction(form: FormData) {
  const v = await requireSecretary();
  const id = String(form.get("id"));
  const action = String(form.get("action"));
  if (action === "optout") await sql`update members set opted_out = true where id = ${id} and club_id = ${v.clubId}`;
  if (action === "optin") await sql`update members set opted_out = false where id = ${id} and club_id = ${v.clubId}`;
  if (action === "leave") await sql`update members set active = false where id = ${id} and club_id = ${v.clubId} and id <> ${v.id}`;
  if (action === "rejoin") await sql`update members set active = true where id = ${id} and club_id = ${v.clubId}`;
  if (action === "delete" && form.get("confirm") === "yes" && id !== v.id) {
    // Right to erasure: removes the member, every rating they gave or got, and their scores.
    await sql`delete from members where id = ${id} and club_id = ${v.clubId}`;
  }
  revalidatePath("/secretary/members");
}

export type ImportState = { report?: ImportReport; error?: string; kind?: string };

export async function importAction(_: ImportState, form: FormData): Promise<ImportState> {
  const v = await requireSecretary();
  const kind = String(form.get("kind"));
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file first.", kind };
  if (file.size > 5_000_000) return { error: "That file is too big. Split it into smaller files.", kind };
  const rows = parseCsv(await file.text());
  if (rows.length === 0) return { error: "That file looks empty.", kind };
  if (kind === "members") {
    return { kind, report: await importMembers(v.clubId, memberRowsFromCsv(rows), form.get("markLeft") === "on") };
  }
  const [club] = await sql<{ id: string; timezone: string; invite_delay_hours: number }[]>`select id, timezone, invite_delay_hours from clubs where id = ${v.clubId}`;
  return { kind, report: await importTeeTimes(club, teeTimesFromCsv(rows)) };
}

export type SettingsState = { saved?: boolean; apiKey?: string; error?: string };

export async function settingsAction(_: SettingsState, form: FormData): Promise<SettingsState> {
  const v = await requireSecretary();
  if (form.get("newKey") === "1") {
    const key = "pk_" + randomBytes(24).toString("hex");
    await sql`update clubs set api_key_hash = ${createHash("sha256").update(key).digest("hex")} where id = ${v.clubId}`;
    return { apiKey: key };
  }
  const channel = form.get("channel") === "sms" ? "sms" : "email";
  const delay = Math.round(Number(form.get("delay")));
  if (!(delay >= 1 && delay <= 24)) return { error: "Pick a delay between 1 and 24 hours." };
  await sql`update clubs set invite_channel = ${channel}, invite_delay_hours = ${delay} where id = ${v.clubId}`;
  revalidatePath("/secretary/import");
  return { saved: true };
}
