"use client";
import { useMemo, useState } from "react";
import { Avatar, ScoreBadge } from "@/components/bits";
import type { ScoreRow } from "@/lib/dashboard";

export function MemberSearch({ members, minVotes }: { members: ScoreRow[]; minVotes: number }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("name");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const a = members.filter((m) => m.name.toLowerCase().includes(t));
    if (sort !== "name") {
      const d = sort === "low" ? 1 : -1;
      a.sort((x, y) => (x.average === null ? 1 : 0) - (y.average === null ? 1 : 0) || d * ((x.average ?? 0) - (y.average ?? 0)) || x.name.localeCompare(y.name));
    }
    return a;
  }, [members, q, sort]);
  return (
    <>
      <div className="searchrow">
        <input type="search" placeholder="Search by name" aria-label="Search members" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="name">Sort: name</option>
          <option value="low">Sort: lowest rated first</option>
          <option value="high">Sort: highest rated first</option>
        </select>
      </div>
      {list.length ? (
        list.slice(0, 200).map((m) => (
          <div className="mrow" key={m.id}>
            <Avatar name={m.name} id={m.id} />
            <div className="pname">{m.name}{m.handicap ? <small>Handicap {m.handicap}</small> : null}</div>
            <ScoreBadge score={m} minVotes={minVotes} />
          </div>
        ))
      ) : (
        <div className="empty">No member called “{q}”.</div>
      )}
    </>
  );
}
