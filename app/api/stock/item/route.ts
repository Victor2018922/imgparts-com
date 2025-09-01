import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 读取第一张工作表为 JSON */
function sheetToJson(workbook: XLSX.WorkBook) {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
}

/** 在一行中鲁棒取字段：忽略大小写 & 前后空格 */
function pick(row: Record<string, any>, keys: string[]): string {
  const norm = (s: string) => String(s).trim().toLowerCase();
  const colMap = new Map<string, string>();
  for (const col of Object.keys(row)) colMap.set(norm(col), col);

  for (const k of keys) {
    const hitOrig = colMap.get(norm(k));
    if (hitOrig && row[hitOrig] != null) return String(row[hitOrig]).trim();
  }
  return "";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const num = searchParams.get("num");

    if (!num) {
      return NextResponse.json(
        { error: "Missing query param: num" },
        { status: 400 }
      );
    }

    // 通过 /api/stock 下载 Excel 源
    const base =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      "https://imgparts-com.vercel.app";

    const sourceUrl = `${base}/api/stock`;
    const res = await fetch(sourceUrl, {
      cache: "no-store",
      headers: {
        Accept:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch stock source: ${res.status}` },
        { status: 502 }
      );
    }

    const arrayBuf = await res.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuf), { type: "array" });
    const rows = sheetToJson(workbook);

    // num=ALL：返回列表所需字段
    if (num === "ALL") {
      const list = rows.map((row) => ({
        num: pick(row, ["num", "Num", "编号", "sku", "SKU"]),
        product: pick(row, ["product", "Product", "产品", "品名"]),
        oe: pick(row, ["oe", "OE", "OEN", "OE号", "OE编号"]),
        brand: pick(row, ["brand", "Brand", "品牌"]),
        model: pick(row, ["model", "Model", "车型"]),
        year: pick(row, ["year", "Year", "年份"]),
      }));
      return NextResponse.json(list, { status: 200 });
    }

    // 单条：按编号查找
    const target = rows.find((row) => {
      const rowNum = pick(row, ["num", "Num", "编号", "sku", "SKU"]) || "";
      return rowNum === num;
    });

    if (!target) {
      return NextResponse.json(
        { error: `Item not found for num=${num}` },
        { status: 404 }
      );
    }

    // 规范化输出
    const body = {
      num: pick(target, ["num", "Num", "编号", "sku", "SKU"]) || num,
      product: pick(target, ["product", "Product", "产品", "品名"]) || "",
      oe: pick(target, ["oe", "OE", "OEN", "OE号", "OE编号"]),
      brand: pick(target, ["brand", "Brand", "品牌"]),
      model: pick(target, ["model", "Model", "车型"]),
      year: pick(target, ["year", "Year", "年份"]),
      category: pick(target, ["category", "Category", "类目", "分类"]),
      note: pick(target, ["note", "Note", "备注", "说明"]),
      raw: target,
    };

    return NextResponse.json(body, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
