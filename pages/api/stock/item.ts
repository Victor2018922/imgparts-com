// pages/api/stock/item.ts
import type { NextApiRequest, NextApiResponse } from "next";
import * as XLSX from "xlsx";

/** 工具：读第一张表为 JSON */
function sheetToJson(workbook: XLSX.WorkBook) {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
}

/** 工具：在一行记录中鲁棒取字段 */
function pick(row: Record<string, any>, keys: string[]): string {
  for (const k of keys) {
    const hit =
      Object.keys(row).find((col) => col.toLowerCase() === k.toLowerCase()) ??
      keys.find((alt) => alt.toLowerCase() === k.toLowerCase());
    if (hit && row[hit] != null) return String(row[hit]).trim();
  }
  return "";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { num } = req.query as { num?: string };
    if (!num) {
      return res.status(400).json({ error: "Missing query param: num" });
    }

    // 通过现有的 /api/stock 代理下载 Excel 源
    const base =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      "https://imgparts-com.vercel.app";
    const sourceUrl = `${base}/api/stock`;

    const r = await fetch(sourceUrl, {
      cache: "no-store",
      headers: {
        Accept:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
    if (!r.ok) {
      return res
        .status(502)
        .json({ error: `Failed to fetch stock source: ${r.status}` });
    }

    const arrayBuf = await r.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuf), { type: "array" });
    const rows = sheetToJson(workbook);

    // 按编号查找
    const target =
      rows.find(
        (row) => (pick(row, ["num", "Num", "NUM", "编号", "sku", "SKU"]) || "") === num
      ) || null;

    if (!target) {
      return res.status(404).json({ error: `Item not found for num=${num}` });
    }

    const body = {
      num: pick(target, ["num", "Num", "NUM", "编号", "sku", "SKU"]) || num,
      product: pick(target, ["product", "Product", "产品", "品名"]) || "",
      oe: pick(target, ["oe", "OE", "OEN", "OE号", "OE编号"]),
      brand: pick(target, ["brand", "Brand", "品牌"]),
      model: pick(target, ["model", "Model", "车型"]),
      year: pick(target, ["year", "Year", "年份"]),
      category: pick(target, ["category", "Category", "类目", "分类"]),
      note: pick(target, ["note", "Note", "备注", "说明"]),
      raw: target,
    };

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
    return res.status(200).json(body);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Unknown error" });
  }
}
