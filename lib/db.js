import { Pool } from "pg";
import seedData from "@/data/seed-cases.json";

// Vercel's Postgres (Neon) integration prefixes every variable it sets with
// the database's name when one was given at creation time — e.g. a database
// named "legal" produces LEGAL_POSTGRES_URL, LEGAL_DATABASE_URL, etc. instead
// of the plain names, to avoid collisions if more than one database is
// attached to a project. Check the plain names first, then fall back to
// whichever *_DATABASE_URL / *_POSTGRES_URL variant is actually present.
function resolveConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  const key = Object.keys(process.env).find(
    (k) => k.endsWith("_DATABASE_URL") || k.endsWith("_POSTGRES_URL")
  );
  return key ? process.env[key] : null;
}

let pool = null;
function client() {
  if (!pool) {
    const connectionString = resolveConnectionString();
    if (!connectionString) {
      throw new Error("No DATABASE_URL/POSTGRES_URL (or a *_DATABASE_URL/*_POSTGRES_URL variant) is set");
    }
    pool = new Pool({
      connectionString,
      ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? false : { rejectUnauthorized: false },
    });
  }
  return pool;
}

let schemaReady = null;

// Called lazily on first request rather than at module load, so `next build`
// (which imports route modules without a live DB connection) never touches
// the database.
function ensureSchema() {
  if (!schemaReady) {
    const db = client();
    schemaReady = db
      .query(`CREATE TABLE IF NOT EXISTS cases (id text PRIMARY KEY, data jsonb NOT NULL)`)
      .then(() => db.query(`CREATE TABLE IF NOT EXISTS meta (key text PRIMARY KEY, value jsonb NOT NULL)`));
  }
  return schemaReady;
}

export async function getAllCases() {
  const db = client();
  await ensureSchema();
  const { rows } = await db.query(`SELECT data FROM cases ORDER BY id`);
  return rows.map((r) => r.data);
}

export async function getMeta() {
  const db = client();
  await ensureSchema();
  const { rows } = await db.query(`SELECT value FROM meta WHERE key = 'docket'`);
  return rows[0] ? rows[0].value : { orgName: "", lastSyncedAt: null, thresholdINR: 25000 };
}

export async function getCase(id) {
  const db = client();
  await ensureSchema();
  const { rows } = await db.query(`SELECT data FROM cases WHERE id = $1`, [id]);
  return rows[0] ? rows[0].data : null;
}

// Only these fields are ever writable through the API — everything else on a
// case (netBalance, invoices, contact info, ...) comes from the Zoho sync and
// must not be mutable by a client request.
const EDITABLE_FIELDS = ["status", "legalStage", "caseType", "caseStep", "assignedTo", "notes", "flags"];

export async function updateCase(id, patch) {
  const db = client();
  await ensureSchema();
  const existing = await getCase(id);
  if (!existing) return null;

  const next = { ...existing };
  for (const field of EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(patch, field)) {
      next[field] = patch[field];
    }
  }

  await db.query(`UPDATE cases SET data = $2::jsonb WHERE id = $1`, [id, JSON.stringify(next)]);
  return next;
}

// One-time bootstrap for a fresh database. Deliberately refuses to touch
// anything once the table has rows — this is not a reset/restore path, only
// a way to populate an empty deployment, so it's safe to leave reachable
// (behind the edit password) without risking overwriting real edits.
export async function seedIfEmpty() {
  const db = client();
  await ensureSchema();
  const { rows } = await db.query(`SELECT count(*)::int AS n FROM cases`);
  if (rows[0].n > 0) {
    return { seeded: false, existingCount: rows[0].n };
  }

  const { cases, meta } = seedData;
  const BATCH_SIZE = 200;
  for (let i = 0; i < cases.length; i += BATCH_SIZE) {
    const chunk = cases.slice(i, i + BATCH_SIZE);
    const values = [];
    const placeholders = chunk
      .map((c, idx) => {
        values.push(c.id, JSON.stringify(c));
        const n = idx * 2;
        return `($${n + 1}, $${n + 2}::jsonb)`;
      })
      .join(", ");
    await db.query(`INSERT INTO cases (id, data) VALUES ${placeholders}`, values);
  }

  await db.query(
    `INSERT INTO meta (key, value) VALUES ('docket', $1::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(meta)]
  );

  return { seeded: true, count: cases.length };
}
