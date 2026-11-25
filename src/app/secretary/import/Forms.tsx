"use client";
import { useActionState } from "react";
import { importAction, settingsAction, type ImportState, type SettingsState } from "../actions";

function Report({ state }: { state: ImportState }) {
  if (state.error) return <p className="err">{state.error}</p>;
  if (!state.report) return null;
  const r = state.report;
  return (
    <div style={{ marginTop: 12 }}>
      <p className="ok">{r.added} added, {r.updated} updated{r.left !== undefined ? `, ${r.left} marked as left` : ""}.</p>
      {r.skipped.length ? (
        <details><summary className="note">{r.skipped.length} note{r.skipped.length > 1 ? "s" : ""} on rows that were skipped or changed</summary>
          <ul className="note">{r.skipped.slice(0, 100).map((s, i) => <li key={i}>{s}</li>)}</ul>
        </details>
      ) : null}
    </div>
  );
}

export function ImportForm({ kind }: { kind: "members" | "teetimes" }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="kind" value={kind} />
      <div className="field"><input type="file" name="file" accept=".csv,text/csv" required aria-label="CSV file" /></div>
      {kind === "members" ? (
        <label className="note" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input type="checkbox" name="markLeft" /> This is the full member list: mark anyone not in it as having left
        </label>
      ) : null}
      <button className="btn" disabled={pending}>{pending ? "Uploading…" : "Upload"}</button>
      <Report state={state} />
    </form>
  );
}

export function SettingsForm({ channel, delay }: { channel: string; delay: number }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(settingsAction, {});
  const [keyState, keyAction] = useActionState<SettingsState, FormData>(settingsAction, {});
  return (
    <>
      <form action={action}>
        <div className="field">
          <label htmlFor="channel">Send rating requests by</label>
          <select id="channel" name="channel" className="input" defaultValue={channel}>
            <option value="email">Email (free), text if no email on file</option>
            <option value="sms">Text message (about 4p each), email if no mobile on file</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="delay">Hours after the tee time</label>
          <input id="delay" name="delay" type="number" min={1} max={24} defaultValue={delay} className="input" style={{ maxWidth: 120 }} />
          <span className="note">Messages due between 9pm and 8am wait until 9am.</span>
        </div>
        {state.error ? <p className="err">{state.error}</p> : null}
        {state.saved ? <p className="ok">Saved.</p> : null}
        <button className="btn" disabled={pending}>Save settings</button>
      </form>
      <form action={keyAction} style={{ marginTop: 20 }}>
        <input type="hidden" name="newKey" value="1" />
        <h3>Booking system connection</h3>
        <p className="note">If your booking system can send tee times automatically, give its provider an API key. Making a new key stops the old one working.</p>
        {keyState.apiKey ? <p className="ok" style={{ wordBreak: "break-all" }}>New key (copy it now, it won&apos;t be shown again): <code>{keyState.apiKey}</code></p> : null}
        <button className="btn ghost">Make a new API key</button>
      </form>
    </>
  );
}
