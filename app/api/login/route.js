import { NextResponse } from "next/server";
import { checkPassword, createSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

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

  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", createSessionCookie());
  return res;
}
