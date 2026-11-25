import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { Header } from "@/components/Header";

export default async function Home() {
  if (await getViewer()) redirect("/dashboard");
  return (
    <>
      <Header />
      <main className="band">
        <div className="narrow panel">
          <h1>Pace of play, rated by members</h1>
          <p className="lead">
            A few hours after your round you get one text or email. Rate each playing partner&apos;s pace from 1 to 5 stars. Ratings are
            anonymous and released once a month.
          </p>
          <Link className="btn wide" href="/login">Member sign in</Link>
          <p className="note" style={{ marginTop: 14 }}><Link href="/privacy">How we use your information</Link></p>
        </div>
      </main>
    </>
  );
}
