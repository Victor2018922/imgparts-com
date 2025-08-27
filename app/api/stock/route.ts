
import { NextResponse } from "next/server";

const BASE = process.env.NIUNIUPARTS_BASE_URL || "https://niuniuparts.com:6001";
const PAGE_SIZE = Number(process.env.NIUNIUPARTS_PAGE_SIZE || "20");
const TOKEN = process.env.NIUNIUPARTS_BEARER_TOKEN || "";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? "0");
  const url = `${BASE}/scm-product/v1/stock2?size=${PAGE_SIZE}&page=${page}`;

  const headers: Record<string,string> = {};
  if (TOKEN) headers["Authorization"] = `Bearer ${TOKEN}`;

  const res = await fetch(url, { headers, cache: "no-store" });
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok) {
    const text = await res.text();
    return new NextResponse(JSON.stringify({ error: res.status, body: text }), { status: 500 });
  }
  if (contentType.includes("application/json")) {
    const data = await res.json();
    return NextResponse.json(data);
  } else {
    // Try to parse as text (some servers wrap JSON in text/plain)
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch {
      return new NextResponse(text, { status: 200, headers: { "content-type": contentType } });
    }
  }
}
