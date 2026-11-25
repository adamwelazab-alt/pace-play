import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { Header } from "@/components/Header";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams;
  if (await getViewer()) redirect("/dashboard");
  return (
    <>
      <Header />
      <main className="band">
        <div className="narrow panel">
          <h1>Member sign in</h1>
          <p className="lead">No password needed. We&apos;ll send a one-time link to the email or mobile the club has for you.</p>
          {expired ? <p className="err">That sign-in link has expired or was already used. Ask for a new one below.</p> : null}
          <LoginForm />
        </div>
      </main>
    </>
  );
}
