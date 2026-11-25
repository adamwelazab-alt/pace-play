// Adds a new club and its secretary. Run with:
//   npm run club:create -- "Fernhill Golf Club" fernhill "Jane Smith" jane@fernhillgc.co.uk
import "./env";
import postgres from "postgres";
import { createHash, randomBytes } from "node:crypto";

const [name, slug, secName, secEmail] = process.argv.slice(2);
if (!name || !slug || !secName || !secEmail) {
  console.log('Usage: npm run club:create -- "Club name" club-slug "Secretary name" secretary@email');
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

async function main() {
  const apiKey = "pk_" + randomBytes(24).toString("hex");
  const [club] = await sql<{ id: string }[]>`
    insert into clubs (name, slug, api_key_hash) values (${name}, ${slug}, ${createHash("sha256").update(apiKey).digest("hex")})
    returning id`;
  await sql`insert into members (club_id, external_id, name, email, role)
            values (${club.id}, ${"secretary"}, ${secName}, ${secEmail.toLowerCase()}, 'secretary')`;
  console.log(`Created ${name}.`);
  console.log(`${secName} can now sign in at /login with ${secEmail}.`);
  console.log(`Booking system API key (shown once, keep it safe): ${apiKey}`);
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
