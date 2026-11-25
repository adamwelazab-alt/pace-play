import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
}

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  return postgres(url, {
    // Supabase's transaction pooler (port 6543) does not support prepared statements.
    prepare: false,
    max: 5,
    idle_timeout: 20,
    transform: { undefined: null },
  });
}

type Sql = ReturnType<typeof postgres>;
const get = (): Sql => globalThis.__sql ?? (globalThis.__sql = connect());

/** One shared database connection pool, opened on first use and reused across hot reloads. */
export const sql = new Proxy(function () {} as unknown as Sql, {
  apply: (_t, _this, args) => (get() as unknown as (...a: unknown[]) => unknown)(...args),
  get: (_t, prop) => {
    const v = (get() as unknown as Record<string | symbol, unknown>)[prop];
    return typeof v === "function" ? v.bind(get()) : v;
  },
});
