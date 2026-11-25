import { requireSecretary } from "@/lib/auth";
import { sql } from "@/lib/db";
import { Header } from "@/components/Header";
import { SecNav } from "../SecNav";
import { ImportForm, SettingsForm } from "./Forms";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const v = await requireSecretary();
  const [club] = await sql<{ invite_channel: string; invite_delay_hours: number }[]>`select invite_channel, invite_delay_hours from clubs where id = ${v.clubId}`;
  return (
    <>
      <Header viewer={v} current="secretary" />
      <main className="band"><div className="wrap">
        <SecNav current="import" />
        <h1>Tee times and settings</h1>
        <div className="dgrid">
          <div className="stack">
            <div className="panel">
              <h2>Upload tee times</h2>
              <p className="note">Export the tee sheet from your booking system as a CSV. One row per player works best:</p>
              <pre>booking_ref,date,time,course,member_id{"\n"}B1042,2026-11-22,09:40,Old Course,1001{"\n"}B1042,2026-11-22,09:40,Old Course,1002</pre>
              <p className="note">Uploading the same booking again updates it. Guests and anyone not in the member list are left out.</p>
              <ImportForm kind="teetimes" />
            </div>
            <div className="panel">
              <h2>Upload members</h2>
              <p className="note">Columns: <code>member_id</code>, <code>name</code>, <code>email</code>, <code>mobile</code>, <code>handicap</code>. Members are matched on their member number.</p>
              <ImportForm kind="members" />
            </div>
          </div>
          <div className="panel">
            <h2>Settings</h2>
            <SettingsForm channel={club.invite_channel} delay={club.invite_delay_hours} />
          </div>
        </div>
      </div></main>
    </>
  );
}
