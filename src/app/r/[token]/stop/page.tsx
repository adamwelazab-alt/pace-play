import { optOutByToken } from "@/lib/ratings";

async function stop(form: FormData) {
  "use server";
  await optOutByToken(String(form.get("token") ?? ""));
  const { redirect } = await import("next/navigation");
  redirect(`/r/${form.get("token")}/stop?done=1`);
}

export default async function StopPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string }> }) {
  const { token } = await params;
  const { done } = await searchParams;
  return (
    <main className="band"><div className="narrow panel">
      <h1>Stop rating messages</h1>
      {done ? (
        <p className="ok">Done. You won&apos;t get any more rating messages. Ask the club secretary if you change your mind.</p>
      ) : (
        <form action={stop}>
          <p>You won&apos;t get texts or emails asking you to rate your playing partners any more.</p>
          <input type="hidden" name="token" value={token} />
          <button className="btn redb wide">Stop the messages</button>
        </form>
      )}
    </div></main>
  );
}
