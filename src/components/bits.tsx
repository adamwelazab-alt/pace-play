import { initials } from "@/lib/rules";

const COLOURS = ["#1d7a4f", "#2f6f9f", "#9a5b2e", "#7a4f9a", "#a3364b", "#4a7a2a", "#2f8a8a", "#8a6d1d"];

function colourFor(key: string) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLOURS[h % COLOURS.length];
}

export function Avatar({ name, id }: { name: string; id: string }) {
  return <span className="av" style={{ background: colourFor(id) }} aria-hidden="true">{initials(name)}</span>;
}

export const STAR_PATH = "M12 2.6l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5L2.5 9.4l6.6-.8z";

export function MiniStars({ value }: { value: number }) {
  const fill = (k: number) => (k <= Math.round(value) ? (value < 3 ? "var(--red)" : "var(--star)") : "var(--off)");
  return (
    <span className="mini" aria-label={`${value.toFixed(1)} out of 5 stars`} role="img">
      {[1, 2, 3, 4, 5].map((k) => (
        <svg key={k} viewBox="0 0 24 24" aria-hidden="true" style={{ fill: fill(k) }}><path d={STAR_PATH} /></svg>
      ))}
    </span>
  );
}

export type Score = { votes: number; average: number | null };

/** A member's released score, or "not enough ratings" until they reach the club's minimum. */
export function ScoreBadge({ score, minVotes }: { score: Score | null; minVotes: number }) {
  const votes = score?.votes ?? 0;
  if (!score || score.average === null) {
    return <div className="score"><span className="pend">Not enough ratings ({Math.min(votes, minVotes - 1)} of {minVotes})</span></div>;
  }
  const r = score.average;
  return (
    <div className="score">
      <b>{r.toFixed(1)}</b>
      {r < 3 ? <span className="tag slow">Slow</span> : r >= 4.5 ? <span className="tag quick">Quick</span> : null}
      <small><MiniStars value={r} />{votes} ratings</small>
    </div>
  );
}
