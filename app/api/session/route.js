import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  return NextResponse.json({ authenticated: isAuthenticated(request) });
}
