import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const apiBase = process.env.SOURCE_API_URL || "";
    const key = process.env.SOURCE_API_KEY || "";

    if (!apiBase) {
      return NextResponse.json({ error: "Missing SOURCE_API_URL in .env.local" }, { status: 500 });
    }

    // 透传查询参数（默认取一页，避免太大）
    const inUrl = new URL(req.url);
    const qs = new URLSearchParams(inUrl.search);
    if (!qs.has("size")) qs.set("size", "5");
    if (!qs.has("page")) qs.set("page", "0");

    const url = `${apiBase}?${qs.toString()}`;

    const res = await fetch(url, {
      headers: key ? { Authorization: key } : undefined,
      cache: "no-store",
    });

    const text = await res.text(); // 原样取文本，防止某些接口不是标准 JSON
    // 尝试 JSON 解析；失败则直接返回文本
    try {
      const json = JSON.parse(text);
      return NextResponse.json({ ok: res.ok, status: res.status, url, dataType: typeof json, data: json });
    } catch {
      return NextResponse.json({ ok: res.ok, status: res.status, url, dataType: "text", data: text });
    }
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
