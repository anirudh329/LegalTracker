import { NextResponse } from "next/server";
import { getAllCases, getMeta } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [cases, meta] = await Promise.all([getAllCases(), getMeta()]);
    return NextResponse.json({ cases, meta });
  } catch (e) {
    console.error("GET /api/cases failed:", e);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
