import crypto from "node:crypto";

const COOKIE_NAME = "docket_session";
const SESSION_DAYS = 30;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

function sign(expiry) {
  return crypto.createHmac("sha256", secret()).update(String(expiry)).digest("hex");
}

export function createSessionCookie() {
  const expiry = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const token = `${expiry}.${sign(expiry)}`;
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function checkPassword(candidate) {
  const expected = process.env.EDIT_PASSWORD || "";
  const a = Buffer.from(String(candidate || ""));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return expected.length > 0 && crypto.timingSafeEqual(a, b);
}

export function isAuthenticated(request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return false;
  const [expiryStr, sig] = decodeURIComponent(match[1]).split(".");
  const expiry = Number(expiryStr);
  if (!expiry || Number.isNaN(expiry) || expiry < Date.now()) return false;
  if (!sig) return false;
  const expectedSig = sign(expiry);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
