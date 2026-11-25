import Link from "next/link";
import type { Viewer } from "@/lib/auth";
import { signOutAction } from "@/app/actions";

export function Header({ viewer, current }: { viewer?: Viewer | null; current?: "dashboard" | "secretary" }) {
  return (
    <header className="top">
      <div className="topin">
        <Link href={viewer ? "/dashboard" : "/"} className="logo">
          Pace of Play Ratings
          {viewer ? <small>{viewer.clubName}</small> : null}
        </Link>
        {viewer ? (
          <nav className="topnav" aria-label="Main">
            <Link href="/dashboard" aria-current={current === "dashboard" ? "page" : undefined}>Dashboard</Link>
            {viewer.role === "secretary" ? (
              <Link href="/secretary" aria-current={current === "secretary" ? "page" : undefined}>Secretary</Link>
            ) : null}
            <form action={signOutAction}><button type="submit">Sign out</button></form>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
