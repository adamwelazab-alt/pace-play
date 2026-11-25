"use client";
import { useActionState } from "react";
import { requestLogin, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(requestLogin, {});
  if (state.sent) {
    return (
      <div>
        <p className="ok">Check your messages. If the club has you on file, we&apos;ve sent you a sign-in link.</p>
        {state.devLinks?.length ? (
          <p className="note">Development only, not shown on the live site: {state.devLinks.map((l) => <a key={l} href={l} style={{ display: "block", wordBreak: "break-all" }}>{l}</a>)}</p>
        ) : null}
      </div>
    );
  }
  return (
    <form action={action}>
      <div className="field">
        <label htmlFor="who">Email or mobile number</label>
        <input id="who" name="who" className="input" autoComplete="email" inputMode="email" required placeholder="you@example.com or 07700 900123" />
      </div>
      {state.error ? <p className="err">{state.error}</p> : null}
      <button className="btn wide" disabled={pending}>{pending ? "Sending…" : "Send me a sign-in link"}</button>
    </form>
  );
}
