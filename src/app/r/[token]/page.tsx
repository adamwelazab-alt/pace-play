import Link from "next/link";
import { lookupInvite } from "@/lib/ratings";
import { formatDay, formatTime, nextRelease } from "@/lib/time";
import { RatingForm } from "@/components/RatingForm";
import { submitByToken } from "../actions";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="band" style={{ paddingInline: 12 }}><div className="narrow">{children}</div></main>;
}

export default async function RatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await lookupInvite(token);
  if (inv.state !== "ok") {
    const msg = {
      missing: "This link isn't right. Check you copied all of it from the message.",
      expired: "This link has expired. Rating links last 7 days after the round.",
      opted_out: "You've turned off rating messages. Ask the club secretary if you'd like them back.",
    }[inv.state];
    return <Shell><div className="panel"><h1>Pace of play rating</h1><p>{msg}</p><Link href="/login">Sign in to your dashboard</Link></div></Shell>;
  }
  const r = inv.round;
  const subtitle = [formatDay(r.teeTime, r.timezone), formatTime(r.teeTime, r.timezone), [r.clubName, r.course].filter(Boolean).join(", ")].join(" · ");
  const release = nextRelease(new Date(), r.timezone);
  const footer = (
    <p className="note" style={{ textAlign: "center" }}>
      <Link href={`/r/${token}/stop`}>Stop these messages</Link> · <Link href="/privacy">Privacy</Link>
    </p>
  );
  if (r.alreadyRated) {
    return <Shell><div className="panel"><h1>Already done, thanks</h1><p>You&apos;ve rated this round. Your ratings will be in the release on {release.atLabel}.</p><Link className="btn ghost" href="/login">Go to your dashboard</Link></div></Shell>;
  }
  if (r.partners.length === 0) {
    return <Shell><div className="panel"><h1>Nobody to rate</h1><p>There are no other members on this booking.</p></div></Shell>;
  }
  return (
    <Shell>
      <RatingForm
        title="Rate your group's pace"
        subtitle={subtitle}
        raterFirstName={r.raterName.split(" ")[0]}
        releaseLabel={release.atLabel}
        partners={r.partners}
        submit={submitByToken.bind(null, token)}
        footer={footer}
        after={<Link className="btn ghost wide" href="/login">See your dashboard</Link>}
      />
    </Shell>
  );
}
