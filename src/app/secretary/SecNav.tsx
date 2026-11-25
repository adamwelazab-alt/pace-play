import Link from "next/link";

export function SecNav({ current }: { current: "review" | "members" | "import" }) {
  const items = [["review", "/secretary", "Low ratings to review"], ["members", "/secretary/members", "Members"], ["import", "/secretary/import", "Tee times and settings"]] as const;
  return (
    <nav className="subnav" aria-label="Secretary">
      {items.map(([k, href, label]) => <Link key={k} href={href} aria-current={current === k ? "page" : undefined}>{label}</Link>)}
    </nav>
  );
}
