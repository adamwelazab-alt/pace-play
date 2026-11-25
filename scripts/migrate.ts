// Sets up or updates the database. Run with: npm run db:migrate
import "./env";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1, onnotice: () => {} });
const dir = join(process.cwd(), "db", "migrations");

async function main() {
  await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const applied = new Set((await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name));
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (applied.has(file)) continue;
    console.log(`Applying ${file}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync(join(dir, file), "utf8"));
      await tx`insert into schema_migrations (name) values (${file})`;
    });
  }
  console.log("Database is up to date.");
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
