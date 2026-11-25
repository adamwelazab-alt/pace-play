import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { latestRelease, memberScores, myHistory, roundsToRate, upcomingRounds } from "@/lib/dashboard";
import { MONTHS, formatDateTime, localParts, nextRelease } from "@/lib/time";
import { Header } from "@/components/Header";
import { Avatar, MiniStars, ScoreBadge } from "@/components/bits";
import { MemberSearch } from "./MemberSearch";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const v = await requireViewer();
  const rel = await latestRelease(v.clubId);
  const [members, history, upcoming, toRate] = await Promise.all([
    memberScores(v.clubId, rel?.id ?? null),
    myHistory(v.id),
    upcomingRounds(v, rel?.id ?? null),
    roundsToRate(v.id),
  ]);
  const me = members.find((m) => m.id === v.id) ?? null;
  const next = nextRelease(new Date(), v.timezone);
  const relMonth = rel ? MONTHS[localParts(new Date(rel.period.getTime() + 43200_000), "UTC").month - 1] : null;

  return (
    <>
      <Header viewer={v} current="dashboard" />
      <main className="band"><div className="wrap">
        <div className="release">
          <div>
            <b>{rel ? `${relMonth} ratings released` : "No ratings released yet"}</b>
            <div className="note">Signed in as {v.name} · Next release {next.atLabel} · Ratings from the last {v.windowMonths} months count</div>
          </div>
          {toRate[0] ? <Link className="btn" href={`/dashboard/rate/${toRate[0].id}`}>Rate your last round</Link> : null}
        </div>
        <div className="dgrid">
          <div className="panel">
            <h2>Find a member</h2>
            <p className="note" style={{ margin: 0 }}>Check a playing partner before a competition draw. Ratings appear once a member has {v.minVotes} or more votes.</p>
            <MemberSearch members={members} minVotes={v.minVotes} />
          </div>
          <div className="stack">
            <div className="panel">
              <h3>Your pace rating</h3>
              {me && me.average !== null ? (
                <div className="me"><span className="big">{me.average.toFixed(1)}</span><span><MiniStars value={me.average} /><br /><span className="note">from {me.votes} ratings</span></span></div>
              ) : (
                <p className="note">You need {v.minVotes} ratings before your score shows. You have {Math.min(me?.votes ?? 0, v.minVotes - 1)} so far.</p>
              )}
              {history.some((h) => h.average !== null) ? (
                <div className="hist" aria-label="Your monthly average">
                  {history.map((h) => (
                    <div key={String(h.period)}>
                      <span>{h.average !== null ? h.average.toFixed(1) : "–"}</span>
                      <i style={{ height: `${h.average !== null ? Math.max(4, ((h.average - 1) / 4) * 80) : 0}%` }} />
                      {MONTHS[localParts(new Date(h.period.getTime() + 43200_000), "UTC").month - 1].slice(0, 3)}
                    </div>
                  ))}
                </div>
              ) : null}
              <p className="note" style={{ margin: "8px 0 0" }}>Monthly average. You can&apos;t see who rated you or which round a rating came from.</p>
            </div>
            {upcoming.map((r) => (
              <div className="panel flush" key={r.id}>
                <h3>Your next round</h3>
                <p className="note" style={{ margin: "0 0 6px" }}>{formatDateTime(r.tee_time, v.timezone)}{r.course ? `, ${r.course}` : ""}</p>
                {r.partners.map((p) => (
                  <div className="mrow" key={p.id}>
                    <Avatar name={p.name} id={p.id} />
                    <div className="pname">{p.name}{p.handicap ? <small>Handicap {p.handicap}</small> : null}</div>
                    <ScoreBadge score={p} minVotes={v.minVotes} />
                  </div>
                ))}
              </div>
            ))}
            <p className="note"><Link href="/privacy">How your information is used</Link></p>
          </div>
        </div>
      </div></main>
    </>
  );
}
