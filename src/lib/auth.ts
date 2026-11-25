import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "./db";
import { hashToken, newToken } from "./tokens";

export const SESSION_COOKIE = "pp_session";
const SESSION_DAYS = 30;

export type Viewer = {
  id: string;
  name: string;
  role: "member" | "secretary";
  clubId: string;
  clubName: string;
  timezone: string;
  minVotes: number;
  windowMonths: number;
  inviteChannel: "sms" | "email";
};

/** The signed-in member, or null. */
export async function getViewer(): Promise<Viewer | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await sql<Viewer[]>`
    select m.id, m.name, m.role, c.id as "clubId", c.name as "clubName", c.timezone,
           c.min_votes as "minVotes", c.window_months as "windowMonths", c.invite_channel as "inviteChannel"
    from sessions s join members m on m.id = s.member_id join clubs c on c.id = m.club_id
    where s.token_hash = ${hashToken(token)} and s.expires_at > now() and m.active`;
  return rows[0] ?? null;
}

export async function requireViewer(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/login");
  return v;
}

export async function requireSecretary(): Promise<Viewer> {
  const v = await requireViewer();
  if (v.role !== "secretary") redirect("/dashboard");
  return v;
}

/** Makes a one-time sign-in link that lasts 20 minutes. */
export async function createLoginToken(memberId: string): Promise<string> {
  const token = newToken(32);
  await sql`insert into login_tokens (token_hash, member_id, expires_at)
            values (${hashToken(token)}, ${memberId}, now() + interval '20 minutes')`;
  return token;
}

/** Uses up a sign-in link and starts a session. Returns false if the link is old or used. */
export async function redeemLoginToken(token: string): Promise<boolean> {
  const rows = await sql<{ member_id: string }[]>`
    update login_tokens set used_at = now()
    where token_hash = ${hashToken(token)} and used_at is null and expires_at > now()
    returning member_id`;
  if (!rows[0]) return false;
  const session = newToken(32);
  await sql`insert into sessions (token_hash, member_id, expires_at)
            values (${hashToken(session)}, ${rows[0].member_id}, now() + make_interval(days => ${SESSION_DAYS}))`;
  (await cookies()).set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return true;
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await sql`delete from sessions where token_hash = ${hashToken(token)}`;
  jar.delete(SESSION_COOKIE);
}
