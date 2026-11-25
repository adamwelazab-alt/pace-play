import Link from "next/link";
import { requireSecretary } from "@/lib/auth";
import { sql } from "@/lib/db";
import { Header } from "@/components/Header";
import { memberAction } from "../actions";
import { SecNav } from "../SecNav";

export const dynamic = "force-dynamic";

function Btn({ id, action, label, cls = "btn ghost small", extra }: { id: string; action: string; label: string; cls?: string; extra?: React.ReactNode }) {
  return (
    <form action={memberAction}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="action" value={action} />{extra}
      <button className={cls}>{label}</button>
    </form>
  );
}

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string; del?: string }> }) {
  const v = await requireSecretary();
  const { q = "", del } = await searchParams;
  const rows = await sql`
    select id, name, external_id, email, phone, role, opted_out, active from members
    where club_id = ${v.clubId} and (${q} = '' or name ilike ${"%" + q + "%"} or external_id = ${q})
    order by active desc, name limit 300`;
  const toDelete = del ? rows.find((r) => r.id === del) : null;
  return (
    <>
      <Header viewer={v} current="secretary" />
      <main className="band"><div className="wrap">
        <SecNav current="members" />
        <h1>Members</h1>
        <p className="note" style={{ margin: "0 0 12px" }}>Add or update members from a CSV on the <Link href="/secretary/import">tee times and settings</Link> page.</p>
        {toDelete ? (
          <div className="panel" style={{ marginBottom: 16, borderColor: "var(--red)" }}>
            <h3>Delete {toDelete.name} for good?</h3>
            <p>This removes them and every rating they gave or received. Use it when a member asks for their data to be erased. It can&apos;t be undone.</p>
            <div className="acts">
              <Btn id={toDelete.id} action="delete" label="Yes, delete everything" cls="btn redb small" extra={<input type="hidden" name="confirm" value="yes" />} />
              <Link className="btn ghost small" href="/secretary/members">Cancel</Link>
            </div>
          </div>
        ) : null}
        <form className="searchrow"><input name="q" type="search" defaultValue={q} placeholder="Search by name or member number" aria-label="Search members" /><button className="btn">Search</button></form>
        <div className="panel" style={{ overflowX: "auto" }}>
          <table className="t">
            <thead><tr><th>Name</th><th className="hide-sm">Number</th><th className="hide-sm">Contact</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} style={{ opacity: m.active ? 1 : 0.55 }}>
                  <td><b>{m.name}</b>{m.role === "secretary" ? <span className="tag quick">Secretary</span> : null}</td>
                  <td className="hide-sm">{m.external_id}</td>
                  <td className="hide-sm note">{[m.email, m.phone].filter(Boolean).join(" · ") || "None"}</td>
                  <td className="note">{!m.active ? "Left the club" : m.opted_out ? "Messages off" : "Active"}</td>
                  <td><div className="acts" style={{ marginTop: 0, justifyContent: "flex-end" }}>
                    {m.active ? (m.opted_out ? <Btn id={m.id} action="optin" label="Turn messages on" /> : <Btn id={m.id} action="optout" label="Turn messages off" />) : null}
                    {m.id !== v.id ? (m.active ? <Btn id={m.id} action="leave" label="Mark as left" /> : <Btn id={m.id} action="rejoin" label="Rejoined" />) : null}
                    {m.id !== v.id ? <Link className="btn ghost small" href={`/secretary/members?del=${m.id}`}>Delete</Link> : null}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <div className="empty">No members found.</div> : null}
        </div>
      </div></main>
    </>
  );
}
