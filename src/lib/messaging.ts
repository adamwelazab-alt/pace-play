/**
 * Sends texts through Twilio and emails through Resend. If the keys aren't set (for example on
 * your own computer), messages are printed in the terminal instead of being sent.
 */

export type SendResult = { ok: true; channel: "sms" | "email" } | { ok: false; error: string };

export const smsConfigured = () => !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
export const emailConfigured = () => !!process.env.RESEND_API_KEY;

export const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

export async function sendSms(to: string, body: string): Promise<SendResult> {
  if (!smsConfigured()) {
    if (process.env.NODE_ENV === "production") return { ok: false, error: "Texts aren't set up (Twilio keys missing)." };
    console.log(`\n[text not sent, Twilio isn't set up] To ${to}:\n${body}\n`);
    return { ok: true, channel: "sms" };
  }
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM!, Body: body }),
  });
  if (!res.ok) return { ok: false, error: `Twilio ${res.status}: ${(await res.text()).slice(0, 300)}` };
  return { ok: true, channel: "sms" };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function sendEmail(to: string, subject: string, text: string, button?: { label: string; url: string }): Promise<SendResult> {
  const fullText = button ? `${text}\n\n${button.label}: ${button.url}` : text;
  if (!emailConfigured()) {
    if (process.env.NODE_ENV === "production") return { ok: false, error: "Email isn't set up (Resend key missing)." };
    console.log(`\n[email not sent, Resend isn't set up] To ${to}\nSubject: ${subject}\n${fullText}\n`);
    return { ok: true, channel: "email" };
  }
  const paras = text.split(/\n\n+/).map((p) => `<p style="margin:0 0 14px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
  const btn = button
    ? `<p style="margin:22px 0"><a href="${escapeHtml(button.url)}" style="background:#0f4d32;color:#fff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:10px;display:inline-block">${escapeHtml(button.label)}</a></p><p style="font-size:13px;color:#5b6b61">Or copy this link: ${escapeHtml(button.url)}</p>`
    : "";
  const html = `<div style="font:16px/1.5 system-ui,sans-serif;color:#14211a;max-width:520px">${paras}${btn}</div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || "Pace of Play <onboarding@resend.dev>", to, subject, text: fullText, html }),
  });
  if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 300)}` };
  return { ok: true, channel: "email" };
}

/** Sends to a member by their club's preferred channel, falling back to the other one. */
export async function sendToMember(
  member: { name: string; email: string | null; phone: string | null },
  preferred: "sms" | "email",
  msg: { sms: string; subject: string; email: string; button?: { label: string; url: string } },
): Promise<SendResult> {
  const canSms = !!member.phone;
  const canEmail = !!member.email;
  const order: ("sms" | "email")[] = preferred === "sms" ? ["sms", "email"] : ["email", "sms"];
  let lastError = "No email address or mobile number on file.";
  for (const ch of order) {
    if (ch === "sms" && canSms) {
      const r = await sendSms(member.phone!, msg.sms);
      if (r.ok) return r;
      lastError = r.error;
    }
    if (ch === "email" && canEmail) {
      const r = await sendEmail(member.email!, msg.subject, msg.email, msg.button);
      if (r.ok) return r;
      lastError = r.error;
    }
  }
  return { ok: false, error: lastError };
}
