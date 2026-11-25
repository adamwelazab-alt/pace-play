"use client";
import { useState } from "react";
import { Avatar, STAR_PATH } from "./bits";
import { LOW_REASONS, STAR_WORDS, isLow, type RatingInput } from "@/lib/rules";

type Partner = { id: string; name: string; handicap: string | null };
type Result = { ok: true } | { ok: false; errors: Record<string, string> };
type Entry = { stars: number; hover: number; reasons: string[]; note: string };

export function RatingForm(props: {
  title: string;
  subtitle: string;
  raterFirstName: string;
  releaseLabel: string;
  partners: Partner[];
  submit: (ratings: RatingInput[]) => Promise<Result>;
  footer?: React.ReactNode;
  after?: React.ReactNode;
}) {
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(props.partners.map((p) => [p.id, { stars: 0, hover: 0, reasons: [], note: "" }])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const update = (id: string, patch: Partial<Entry>) => setEntries((e) => ({ ...e, [id]: { ...e[id], ...patch } }));

  async function onSubmit() {
    const local: Record<string, string> = {};
    for (const p of props.partners) {
      const e = entries[p.id];
      if (e.stars && isLow(e.stars) && !e.reasons.length && !e.note.trim()) local[p.id] = "Please pick a reason or write a short note.";
    }
    setErrors(local);
    if (Object.keys(local).length) {
      document.getElementById(`p-${Object.keys(local)[0]}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    setBusy(true);
    try {
      const res = await props.submit(
        props.partners.map((p) => ({ rateeId: p.id, stars: entries[p.id].stars, reasons: entries[p.id].reasons, note: entries[p.id].note })),
      );
      if (res.ok) setDone(true);
      else setErrors(res.errors);
    } catch {
      setErrors({ form: "We couldn't save that. Check your signal and try again." });
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const anyLow = props.partners.some((p) => entries[p.id].stars && isLow(entries[p.id].stars));
    return (
      <div className="ratecard">
        <div className="done" role="status">
          <div className="tick">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </div>
          <h2>Thanks, {props.raterFirstName}</h2>
          <p className="note">Your ratings are saved. They&apos;ll be added to the monthly release on {props.releaseLabel}, and your name is never shown to the players you rated.</p>
          {anyLow ? <p className="note">Your comment on a low rating has gone to the club secretary to review.</p> : null}
          {props.after}
        </div>
      </div>
    );
  }

  const anyRated = props.partners.some((p) => entries[p.id].stars > 0);

  return (
    <div className="ratecard">
      <div className="apphead"><b>{props.title}</b><span>{props.subtitle}</span></div>
      <div className="ratebody">
        {props.partners.map((p) => {
          const e = entries[p.id];
          const v = e.hover || e.stars;
          const low = e.stars > 0 && isLow(e.stars);
          return (
            <div className="p" key={p.id} id={`p-${p.id}`}>
              <div className="prow">
                <Avatar name={p.name} id={p.id} />
                <div className="pname">{p.name}{p.handicap ? <small>Handicap {p.handicap}</small> : null}</div>
              </div>
              <div className="stars" role="radiogroup" aria-label={`Pace rating for ${p.name}`} onMouseLeave={() => update(p.id, { hover: 0 })}>
                {[1, 2, 3, 4, 5].map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={e.stars === k}
                    aria-label={`${k} star${k > 1 ? "s" : ""}: ${STAR_WORDS[k]}`}
                    className={`${k <= v ? "lit" : ""} ${v && isLow(v) ? "low" : ""}`}
                    onMouseEnter={() => update(p.id, { hover: k })}
                    onFocus={() => update(p.id, { hover: k })}
                    onBlur={() => update(p.id, { hover: 0 })}
                    onClick={() => { update(p.id, { stars: k, hover: 0 }); setErrors((x) => ({ ...x, [p.id]: "" })); }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d={STAR_PATH} /></svg>
                  </button>
                ))}
              </div>
              <div className="lbl" aria-live="polite">{v ? STAR_WORDS[v] : "Tap a star"}</div>
              {e.stars ? (
                <div className={`reason ${low ? "req" : ""}`}>
                  <label htmlFor={`t-${p.id}`}>{low ? "Why so low? Required, sent only to the club secretary" : "Add a note (optional)"}</label>
                  {low ? (
                    <div className="chips">
                      {LOW_REASONS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-pressed={e.reasons.includes(c)}
                          className={e.reasons.includes(c) ? "on" : ""}
                          onClick={() => { update(p.id, { reasons: e.reasons.includes(c) ? e.reasons.filter((x) => x !== c) : [...e.reasons, c] }); setErrors((x) => ({ ...x, [p.id]: "" })); }}
                        >{c}</button>
                      ))}
                    </div>
                  ) : null}
                  <textarea
                    id={`t-${p.id}`}
                    maxLength={1000}
                    value={e.note}
                    placeholder={low ? "What happened on the course?" : "Anything the club should know"}
                    onChange={(ev) => update(p.id, { note: ev.target.value })}
                  />
                </div>
              ) : null}
              {errors[p.id] ? <div className="err" role="alert">{errors[p.id]}</div> : null}
            </div>
          );
        })}
        {errors.form ? <p className="err" role="alert">{errors.form}</p> : null}
        <button className="btn wide" type="button" disabled={!anyRated || busy} onClick={onSubmit}>{busy ? "Saving…" : "Submit ratings"}</button>
        <p className="note" style={{ textAlign: "center" }}>You can skip anyone you&apos;d rather not rate. Ratings are on pace only.</p>
        {props.footer}
      </div>
    </div>
  );
}
