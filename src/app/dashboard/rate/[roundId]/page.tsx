import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { lookupRoundForMember } from "@/lib/ratings";
import { formatDay, formatTime, nextRelease } from "@/lib/time";
import { Header } from "@/components/Header";
import { RatingForm } from "@/components/RatingForm";
import { submitByRound } from "@/app/r/actions";

export const dynamic = "force-dynamic";

export default async function RateFromDashboard({ params }: { params: Promise<{ roundId: string }> }) {
  const v = await requireViewer();
  const { roundId } = await params;
  const r = /^[0-9a-f-]{36}$/.test(roundId) ? await lookupRoundForMember(roundId, v.id) : null;
  return (
    <>
      <Header viewer={v} current="dashboard" />
      <main className="band" style={{ paddingInline: 12 }}><div className="narrow">
        {!r || r.alreadyRated ? (
          <div className="panel"><p>{r ? "You've already rated this round. Thanks!" : "This round can't be rated any more."}</p><Link href="/dashboard">Back to the dashboard</Link></div>
        ) : (
          <RatingForm
            title="Rate your group's pace"
            subtitle={[formatDay(r.teeTime, r.timezone), formatTime(r.teeTime, r.timezone), [r.clubName, r.course].filter(Boolean).join(", ")].join(" · ")}
            raterFirstName={r.raterName.split(" ")[0]}
            releaseLabel={nextRelease(new Date(), r.timezone).atLabel}
            partners={r.partners}
            submit={submitByRound.bind(null, r.roundId)}
            after={<Link className="btn ghost wide" href="/dashboard">Back to the dashboard</Link>}
          />
        )}
      </div></main>
    </>
  );
}
