// One-time (or re-run-to-reset) import of the case data snapshot into Postgres.
// Requires DATABASE_URL (or POSTGRES_URL) in the environment — run via
// `vercel env pull .env.local` then `npm run seed`, or set the connection
// string manually for a non-Vercel Postgres/Neon database.
import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!connectionString) {
  console.error("Set DATABASE_URL or POSTGRES_URL before running the seed script.");
  process.exit(1);
}
const pool = new Pool({
  connectionString,
  ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? false : { rejectUnauthorized: false },
});

async function main() {
  const raw = await readFile(new URL("../data/seed-cases.json", import.meta.url), "utf-8");
  const { cases, meta } = JSON.parse(raw);

  await pool.query(`CREATE TABLE IF NOT EXISTS cases (id text PRIMARY KEY, data jsonb NOT NULL)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS meta (key text PRIMARY KEY, value jsonb NOT NULL)`);

  await pool.query(`DELETE FROM cases`);
  let count = 0;
  for (const c of cases) {
    await pool.query(`INSERT INTO cases (id, data) VALUES ($1, $2::jsonb)`, [c.id, JSON.stringify(c)]);
    count++;
    if (count % 100 === 0) console.log(`  inserted ${count}/${cases.length}`);
  }

  await pool.query(
    `INSERT INTO meta (key, value) VALUES ('docket', $1::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(meta)]
  );

  console.log(`Seeded ${count} cases and meta into Postgres.`);
  await pool.end();
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
