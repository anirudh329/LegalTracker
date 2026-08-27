import { Pool } from "pg";

let pool = null;
function client() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL (or POSTGRES_URL) is not set");
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
