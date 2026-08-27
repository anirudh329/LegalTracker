import { NextResponse } from "next/server";
import { checkPassword } from "@/lib/auth";
import { seedIfEmpty } from "@/lib/db";

export const dynamic = "force-dynamic";

// One-time bootstrap for a fresh deployment's empty database. Refuses to run
// if the cases table already has rows (see seedIfEmpty in lib/db.js) — this
// is not a reset endpoint, so leaving it reachable behind the edit password
// carries no risk of clobbering real data.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!checkPassword(body && body.password)) {
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }

  try {
    const result = await seedIfEmpty();
    if (!result.seeded) {
      return NextResponse.json({ error: "not_empty", existingCount: result.existingCount }, { status: 409 });
    }
    return NextResponse.json({ ok: true, count: result.count });
  } catch (e) {
    console.error("POST /api/admin/seed failed:", e);
    return NextResponse.json({ error: "seed_failed" }, { status: 500 });
  }
}
