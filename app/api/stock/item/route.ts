export const dynamic = 'force-dynamic';
// app/api/stock/item/route.ts
import { NextRequest, NextResponse } from "next/server";

// 需安装依赖：npm i xlsx
import * as XLSX from "xlsx";

/**
 * 从工作簿中读取第一张表并转为 JSON
 */
function sheetToJson(workbook: XLSX.WorkBook) {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
}

/**
 * 在一行记录中，尽可能鲁棒地取字段
 */
function pick(row: Record<string, any>, keys: string[]): string {
  for (const k of keys) {
    // 匹配大小写 & 去除首尾空格
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

    if (!num) {
      return NextResponse.json(
        { error: "Missing query param: num" },
        { status: 400 }
      );
    }

    // 通过现有的 /api/stock 代理下载 Excel 源
    const base =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      "https://imgparts-com.vercel.app";

    const sourceUrl = `${base}/api/stock`;
    const res = await fetch(sourceUrl, {
      // 重要：在 Edge/Node 运行时都取 Buffer
      cache: "no-store",
      headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
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

    // 兼容多种列名：num / Num / 编号 / SKU / sku
    const target = rows.find((row) => {
      const rowNum =
        pick(row, ["num", "Num", "NUM", "编号", "sku", "SKU"]) || "";
      return rowNum === num;
    });

    if (!target) {
      return NextResponse.json(
        { error: `Item not found for num=${num}` },
        { status: 404 }
      );
    }

    // 规范化输出：前端显示更稳定
    const normalize = (row: Record<string, any>) => ({
      num:
        pick(row, ["num", "Num", "NUM", "编号", "sku", "SKU"]) || num,
      product:
        pick(row, ["product", "Product", "产品", "品名"]) || "",
      oe: pick(row, ["oe", "OE", "OEN", "OE号", "OE编号"]),
      brand: pick(row, ["brand", "Brand", "品牌"]),
      model: pick(row, ["model", "Model", "车型"]),
      year: pick(row, ["year", "Year", "年份"]),
      category: pick(row, ["category", "Category", "类目", "分类"]),
      note: pick(row, ["note", "Note", "备注", "说明"]),
      // 兜底：把整行也回传，便于排查字段映射
      raw: row,
    });

    // 可适当设置缓存头（详情数据变更频率通常低）
    const body = normalize(target);
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
