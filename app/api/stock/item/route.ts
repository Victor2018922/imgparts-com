import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sheetToJson(workbook: XLSX.WorkBook) {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
}
function pick(row: Record<string, any>, keys: string[]): string {
  for (const k of keys) {
    const hit =
      Object.keys(row).find((col) => col.toLowerCase() === k.toLowerCase()) ??
      keys.find((alt) => alt.toLowerCase() === k.toLowerCase());
    if (hit && row[hit] != null) return String(row[hit]).trim();
  }
  return "";
}
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const num = searchParams.get("num");
    if (!num) return NextResponse.json({ error: "Missing query param: num" }, { status: 400 });

    const base = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://imgparts-com.vercel.app");
    const sourceUrl = `${base}/api/stock`;
    const res = await fetch(sourceUrl, {
      cache: "no-store",
      headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    });
    if (!res.ok) return NextResponse.json({ error: `Failed to fetch stock source: ${res.status}` }, { status: 502 });

    const arrayBuf = await res.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuf), { type: "array" });
    const rows = sheetToJson(workbook);

    const target = rows.find((row) => (pick(row, ["num","Num","NUM","编号","sku","SKU"]) || "") === num);
    if (!target) return NextResponse.json({ error: `Item not found for num=${num}` }, { status: 404 });

    const body = {
      num: pick(target, ["num","Num","NUM","编号","sku","SKU"]) || num,
      product: pick(target, ["product","Product","产品","品名"]) || "",
      oe: pick(target, ["oe","OE","OEN","OE号","OE编号"]),
      brand: pick(target, ["brand","Brand","品牌"]),
      model: pick(target, ["model","Model","车型"]),
      year: pick(target, ["year","Year","年份"]),
      category: pick(target, ["category","Category","类目","分类"]),
      note: pick(target, ["note","Note","备注","说明"]),
      raw: target,
    };
    return NextResponse.json(body, {
      status: 200,
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unknown error" }, { status: 500 });
  }
}
