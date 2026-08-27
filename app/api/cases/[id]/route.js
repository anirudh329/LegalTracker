import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { updateCase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PUT(request, { params }) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  let patch;
  try {
    patch = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!patch || typeof patch !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const updated = await updateCase(params.id, patch);
    if (!updated) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ case: updated });
  } catch (e) {
    console.error("PUT /api/cases/[id] failed:", e);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
