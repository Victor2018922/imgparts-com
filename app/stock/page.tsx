"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/* ---------------- 工具：解析 & 字段识别 ---------------- */
type AnyRec = Record<string, any>;

async function parseResponse(res: Response) {
  try {
    return await res.json();
  } catch {
    const txt = (await res.text()).trim().replace(/^\uFEFF/, "");
    try { return JSON.parse(txt); } catch { return txt; }
  }
}

function findArrayInObject(input: any): any[] {
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object") {
    const prefer = ["data", "records", "list", "content", "items", "rows", "result"];
    for (const k of prefer) {
      const v = (input as AnyRec)[k];
      if (Array.isArray(v)) return v;
    }
    let best: any[] = [];
    for (const v of Object.values(input)) {
      if (Array.isArray(v) && v.length > best.length) best = v;
    }
    if (best.length) return best;
  }
  return [];
}

function pickStr(row: AnyRec, keys: string[], regex?: RegExp): string | null {
  if (!row) return null;
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  if (regex) {
    const hit = Object.keys(row).find((k) => regex.test(k));
    const v = hit ? row[hit] : null;
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}
function pickAny(row: AnyRec, keys: string[], regex?: RegExp): any {
  if (!row) return null;
  for (const k of keys) {
    if (k in row) {
      const v = row[k];
      if (v !== null && v !== undefined && v !== "") return v;
    }
  }
  if (regex) {
    const hit = Object.keys(row).find((k) => regex.test(k));
    if (hit) return row[hit];
  }
  return null;
}

function pickNum(row: AnyRec) {
  return (
    pickStr(row, ["num", "code", "partNo", "sku", "编号", "编码"]) ||
    pickStr(row, [], /num|code|part|sku|编号|编码/i) ||
    "-"
  );
}
function pickTitle(row: AnyRec) {
  return (
    pickStr(row, ["title","name","product","productName","goodsName","desc","description"]) ||
    pickStr(row, [], /title|name|product|goods|desc/i) ||
    "-"
  );
}
function pickBrand(row: AnyRec) {
  return pickStr(row, ["brand","brandName","partBrand","品牌"], /brand|品牌/i) || "-";
}
function pickModel(row: AnyRec) {
  return pickStr(row, ["model","carModel","vehicleModel","车型"], /model|车型/i) || "-";
}
function pickOE(row: AnyRec) {
  return pickStr(row, ["oe","oeNo","oe_num","oeNumber","OE号","OE码"], /oe/i) || "-";
}
function pickYear(row: AnyRec) {
  return pickStr(row, ["year","年份"], /year|年份/i) || "-";
}
function pickPrice(row: AnyRec) {
  const v = pickAny(row, ["price","salePrice","sale_price","unit_price","unitPrice","amount","cost","usdPrice","cnyPrice"], /price|amount|cost|unit/i);
  return v === null || v === undefined || v === "" ? "-" : String(v);
}
function pickStock(row: AnyRec) {
  const v = pickAny(row, ["stock","stockQty","stockQuantity","qty","quantity","inventory","available","库存","数量"], /stock|qty|quantity|inventory|库存|数量|可用/i);
  return v === null || v === undefined || v === "" ? "-" : String(v);
}

/** 规范化 URL：支持 //xxx、/xxx、http(s)://xxx、data:image/... */
function normalizeUrlMaybeImage(s: string): string | null {
  const str = s.trim();
  if (!str) return null;

  // data url
  if (/^data:image\//i.test(str)) return str;

  // protocol-relative
  if (str.startsWith("//")) return "https:" + str;

  // site relative path
  if (str.startsWith("/")) return "https://niuniuparts.com" + str;

  // absolute http(s)
  if (/^https?:\/\//i.test(str)) return str;

  return null;
}

/** 判断字符串是否“像图片”：有常见后缀，或 URL 中包含 image/img/photo 等词 */
function looksLikeImageUrl(u: string): boolean {
  const s = u.toLowerCase();
  if (/\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?.*)?$/.test(s)) return true;
  if (/^data:image\//.test(s)) return true;
  if (s.includes("/image") || s.includes("/img") || s.includes("/photo") || s.includes("/picture") || s.includes("x-oss-process")) return true;
  return false;
}

/** 递归在任意层级中找第一张图片 URL（**更宽松**） */
function findFirstImageUrlDeep(input: any, depth = 0, seen = new Set<any>()): string | null {
  if (!input || depth > 6 || seen.has(input)) return null;
  seen.add(input);

  if (typeof input === "string") {
    const u = normalizeUrlMaybeImage(input);
    if (u && looksLikeImageUrl(u)) return u;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      const hit = findFirstImageUrlDeep(item, depth + 1, seen);
      if (hit) return hit;
    }
    return null;
  }

  if (typeof input === "object") {
    // 1) 先扫常见图片字段
    const prefer = ["imageUrl","image_url","imgUrl","img_url","image","img","photo","picture","thumb","thumbnail","cover","url","images","imgs","photos","pics","gallery","album","pictures"];
    for (const k of prefer) {
      if (k in input) {
        const hit = findFirstImageUrlDeep((input as AnyRec)[k], depth + 1, seen);
        if (hit) return hit;
      }
    }
    // 2) 全量扫描
    for (const v of Object.values(input)) {
      const hit = findFirstImageUrlDeep(v, depth + 1, seen);
      if (hit) return hit;
    }
  }
  return null;
}

/* ---------------- 列表页 ---------------- */
export default function StockListPage() {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AnyRec[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    const url = `https://niuniuparts.com:6001/scm-product/v1/stock2?size=${size}&page=${page}`;
    setLoading(true);
    setError(null);
    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const raw = await parseResponse(res);
        const arr = findArrayInObject(raw);
        setRows(arr || []);
      })
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false));
  }, [page, size]);

  const list = useMemo(() => {
    const mapped = rows.map((row) => {
      const num = pickNum(row);
      const title = pickTitle(row);
      const brand = pickBrand(row);
      const model = pickModel(row);
      const oe = pickOE(row);
      const year = pickYear(row);
      const price = pickPrice(row);
      const stock = pickStock(row);

      // 更激进：深度扫描并宽松识别图片
      const img = findFirstImageUrlDeep(row);
      const image = img || "";

      return { num, title, brand, model, oe, year, price, stock, image, _raw: row };
    });

    if (!q.trim()) return mapped;
    const s = q.trim().toLowerCase();
    return mapped.filter((it) =>
      [it.num, it.title, it.brand, it.model, it.oe].some((x) => String(x || "").toLowerCase().includes(s))
    );
  }, [rows, q]);

  if (loading) return <p className="p-4">Loading...</p>;
  if (error) return <p className="p-4 text-red-600">{error}</p>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-2">库存产品列表</h1>
      <div className="text-gray-500 mb-3">共 {rows.length} 条（当前页）</div>

      <div className="flex gap-3 items-center mb-3 flex-wrap">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索 编号 / 标题 / OE / 品牌（仅当前页）"
          className="border px-3 py-2 rounded w-[380px] max-w-full"
        />
        <button className="px-3 py-2 border rounded" onClick={() => setPage(Math.max(0, page - 1))}>
          上一页
        </button>
        <span>第 {page + 1} 页</span>
        <button className="px-3 py-2 border rounded" onClick={() => setPage(page + 1)}>
          下一页
        </button>

        <div className="flex items-center gap-2">
          <span>每页</span>
          <select className="border px-2 py-1 rounded" value={size} onChange={(e) => setSize(Number(e.target.value))}>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>条</span>
        </div>

        <a
          href="https://niuniuparts.com:6001/scm-product/v1/stock2/excel"
          target="_blank"
          className="ml-auto px-4 py-2 bg-blue-600 text-white rounded"
        >
          下载库存 Excel
        </a>
      </div>

      {/* 卡片列表 */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {list.map((it) => {
          const href = `/stock/${encodeURIComponent(it.num)}?product=${encodeURIComponent(it.title)}&oe=${encodeURIComponent(it.oe)}&brand=${encodeURIComponent(it.brand)}&model=${encodeURIComponent(it.model)}&year=${encodeURIComponent(it.year)}&image=${encodeURIComponent(it.image || "")}&price=${encodeURIComponent(it.price || "")}&stock=${encodeURIComponent(it.stock || "")}`;
          return (
            <div key={it.num} className="border rounded-xl p-3">
              <div className="font-semibold mb-1">{it.title}</div>
              <div className="text-sm text-gray-600 space-y-1 mb-3">
                <div>品牌：{it.brand}</div>
                <div>车型：{it.model}</div>
                <div>OE号：{it.oe}</div>
                <div>编号：{it.num}</div>
                <div>价格：{it.price}</div>
                <div>库存：{it.stock}</div>
              </div>

              <div className="border rounded-lg flex items-center justify-center mb-3" style={{ minHeight: 220 }}>
                {it.image ? (
                  <img
                    src={it.image}
                    alt={it.num}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    style={{ maxWidth: "100%", maxHeight: 210, objectFit: "contain", borderRadius: 8 }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="text-gray-400">无图</div>
                )}
              </div>

              <Link
                href={href}
                className="w-full inline-block text-center px-4 py-2 bg-gray-900 text-white rounded hover:opacity-90"
              >
                查看详情
              </Link>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 mt-6">数据源：niuniuparts.com（测试预览用途）</p>
    </div>
  );
}
