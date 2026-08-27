import { PAGE_HTML } from "@/lib/page-html";

export const dynamic = "force-dynamic";

export async function GET() {
  const html = "<!doctype html>\n<html>\n<head></head>\n<body>\n" + PAGE_HTML + "\n</body>\n</html>";
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
