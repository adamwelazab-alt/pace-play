import { requireSecretary } from "@/lib/auth";
import { reviewQueue, secretaryStats } from "@/lib/secretary";
import { formatDateTime, nextRelease } from "@/lib/time";
import { Header } from "@/components/Header";
import { Avatar, MiniStars } from "@/components/bits";
import { reviewAction } from "./actions";
import { SecNav } from "./SecNav";

export const dynamic = "force-dynamic";

function Act({ id, action, label, cls = "btn ghost small" }: { id: string; action: string; label: string; cls?: string }) {
  return (
    <form action={reviewAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      <button className={cls}>{label}</button>
    </form>
  );
}

export default async function SecretaryPage() {
  const v = await requireSecretary();
  const [cases, stats] = await Promise.all([reviewQueue(v.clubId), secretaryStats(v.clubId, v.timezone)]);
  const next = nextRelease(new Date(), v.timezone);
  const open = cases.filter((c) => c.status === "pending");
  const reviewed = cases.filter((c) => c.status !== "pending");
  const kpis: [string | number, string][] = [
    [stats.open, "low ratings to review"],
    [stats.sent, "rating requests sent this month"],
    [stats.sent ? `${Math.round((stats.replied / stats.sent) * 100)}%` : "–", "of members replied"],
    [`${next.daysLeft} day${next.daysLeft === 1 ? "" : "s"}`, `until the ${next.atLabel} release`],
  ];

  const card = (c: (typeof cases)[number]) => (
    <div className={`case ${c.status === "dismissed" ? "gone" : ""}`} key={c.id}>
      <div className="chead">
        <div className="prow"><Avatar name={c.rateeName} id={c.rateeId} /><div className="pname">{c.rateeName}<small>Round on {formatDateTime(c.teeTime, v.timezone)}</small></div></div>
        <div><MiniStars value={c.stars} /><b>{c.stars} star{c.stars > 1 ? "s" : ""}</b></div>
      </div>
      <div className="quote">
        {c.reasons.length ? <div className="chips" style={{ marginBottom: c.note ? 8 : 0 }}>{c.reasons.map((x) => <span className="pill" key={x}>{x}</span>)}</div> : null}
        {c.note ? c.note : <span className="note">No written note, reasons picked only.</span>}
      </div>
      <div className="meta">Rated by {c.raterName} · visible to the secretary only, never to the member</div>
      {c.warnings.map((w) => <div className="flag" key={w}>Pattern check: {w}</div>)}
      {c.status === "pending" ? (
        <div className="acts">
          <Act id={c.id} action="accept" label="Accept" cls="btn small" />
          <Act id={c.id} action="remind" label="Accept and remind member" />
          <Act id={c.id} action="dismiss" label="Dismiss" />
        </div>
      ) : (
        <div className="acts">
          <span className="state">
            {c.status === "dismissed" ? "Dismissed, removed from rating" : `Accepted, counts in the ${next.atLabel} release`}
            {c.reminded ? ". Pace reminder sent to member" : ""}
          </span>
          <Act id={c.id} action="undo" label="Undo" />
        </div>
      )}
    </div>
  );

  return (
    <>
      <Header viewer={v} current="secretary" />
      <main className="band"><div className="wrap">
        <SecNav current="review" />
        <h1>Low ratings waiting for review</h1>
        <p className="note" style={{ margin: "0 0 16px" }}>Only club secretaries see this page. A low rating counts toward a member&apos;s score only once it&apos;s accepted here.</p>
        <div className="kpis">{kpis.map(([b, s]) => <div className="kpi" key={s}><b>{b}</b><span>{s}</span></div>)}</div>
        {open.length ? open.map(card) : <div className="panel empty">Nothing to review. Nice.</div>}
        {reviewed.length ? <><h2 style={{ marginTop: 28 }}>Reviewed in the last 14 days</h2>{reviewed.map(card)}</> : null}
      </div></main>
    </>
  );
}
