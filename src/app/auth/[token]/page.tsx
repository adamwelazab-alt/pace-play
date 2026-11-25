import { redirect } from "next/navigation";
import Link from "next/link";
import { redeemLoginToken } from "@/lib/auth";
import { Header } from "@/components/Header";

async function signIn(form: FormData) {
  "use server";
  const ok = await redeemLoginToken(String(form.get("token") ?? ""));
  redirect(ok ? "/dashboard" : "/login?expired=1");
}

// The link opens this page and the member presses a button. Email scanners that open links
// automatically therefore can't use up the link before the member does.
export default async function AuthPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <Header />
      <main className="band">
        <div className="narrow panel">
          <h1>Sign in</h1>
          <form action={signIn}>
            <input type="hidden" name="token" value={token} />
            <button className="btn wide">Continue to your dashboard</button>
          </form>
          <p className="note" style={{ marginTop: 12 }}>Link not working? <Link href="/login">Ask for a new one</Link>.</p>
        </div>
      </main>
    </>
  );
}
