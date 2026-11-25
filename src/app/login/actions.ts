"use server";
import { sql } from "@/lib/db";
import { createLoginToken } from "@/lib/auth";
import { appUrl, sendEmail, sendSms } from "@/lib/messaging";
import { normaliseEmail, normalisePhone } from "@/lib/rules";

export type LoginState = { sent?: boolean; error?: string; devLinks?: string[] };

export async function requestLogin(_: LoginState, form: FormData): Promise<LoginState> {
  const raw = String(form.get("who") ?? "").trim();
  const email = normaliseEmail(raw);
  const phone = email ? null : normalisePhone(raw);
  if (!email && !phone) return { error: "Enter the email address or mobile number the club has for you." };

  const members = await sql<{ id: string; name: string; club: string; recent: number }[]>`
    select m.id, m.name, c.name as club,
      (select count(*)::int from login_tokens t where t.member_id = m.id and t.expires_at > now()) as recent
    from members m join clubs c on c.id = m.club_id
    where m.active and ${email ? sql`lower(m.email) = ${email}` : sql`m.phone = ${phone}`}`;

  const devLinks: string[] = [];
  for (const m of members) {
    if (m.recent >= 3) continue; // stops someone flooding a member with sign-in messages
    const url = `${appUrl()}/auth/${await createLoginToken(m.id)}`;
    if (process.env.NODE_ENV !== "production") devLinks.push(url);
    if (email) await sendEmail(email, `Sign in to ${m.club} pace ratings`, `Hi ${m.name.split(" ")[0]},\n\nUse the button below to sign in. The link works once and lasts 20 minutes. If you didn't ask for this, you can ignore this email.`, { label: "Sign in", url });
    else await sendSms(phone!, `Your ${m.club} pace ratings sign-in link (works once, lasts 20 minutes): ${url}`);
  }
  // The same answer whether or not we found them, so this can't be used to check who's a member.
  return { sent: true, devLinks };
}
