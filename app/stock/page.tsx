"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/** -------- 工具：通用解析 + 字段识别 -------- */

type AnyRec = Record<string, any>;

function safeJsonParse(text: string) {
  try { return JSON.parse(text); } catch { return text; }
}

async function parseResponse(res: Response) {
  try {
    return await res.json();
  } catch {
    const txt = (await res.text()).trim().replace(/^\uFEFF/, "");
    return safeJsonParse(txt);
  }
}

/** 在对象树里“找到第一个数组对象列表” */
function findArrayInObject(input: any): any[] {
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object") {
    // 常见容器字段
    const candidates = ["data", "records", "list", "content", "items", "rows", "result"];
    for (const k of candidates) {
      const v = (input as AnyRec)[k];
      if (Array.isArray(v)) return v;
    }
    // 否则遍历一层 value，找最大的数组
    let best: any[] = [];
    for (const v of Object.values(input)) {
      if (Array.isArray(v) && v.length > best.length) best = v;
    }
    if (best.length) return best;
  }
  return [];
}

/** 统一的字段识别器 */
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

function pickImage(row: AnyRec): string | null {
  return pickStr(
    row,
    ["imageUrl","image_url","imgUrl","img_url","image","img","photo","picture","thumb","thumbnail","cover","pic"],
    /image|img|photo|pic|thumb|cover/i
  );
}

function pickPrice(row: AnyRec): string | null {
  const v = pickAny(
    row,
    ["price","salePrice","sale_price","unit_price","unitPrice","amount","cost"],
    /price|amount|cost|unit/i
  );
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}

function pickStock(row: AnyRec): string | null {
  const v = pickAny(
    row,
    ["stock","qty","quantity","inventory","available","库存","数量"],
    /stock|qty|quantity|inventory|可用|库存|数量/i
  );
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}

function pickTitle(row: AnyRec): string | null {
  return (
    pickStr(row, ["title","name","product","productName","goodsName","spuName","desc","description"]) ||
    pickStr(row, [], /title|name|product|goods|desc/i)
  );
}

function pickNum(row: AnyRec): string | null {
  return (
    pickStr(row, ["num","code","partNo","sku","编号","编码"]) ||
    pickStr(row, [], /num|code|part|sku|编号|编码/i)
  );
}

function pickOE(row: AnyRec): string | null {
  return pickStr(row, ["oe","oeNo","oe_num","oeNumber","OE号","OE码"], /oe/i);
}

function pickBrand(row: AnyRec): string | null {
  return pickStr(row, ["brand","brandName","partBrand","品牌"], /brand|品牌/i);
}

function pickModel(row: AnyRec): string | null {
  return pickStr(row, ["model","carModel","vehicleModel","车型"], /model|车型/i);
}

type CardItem = {
  num: string;
  title: string;
  image?: string | null;
  price?: string | null;
  stock?: string | null;
  oe?: string | null;
  brand?: string | null;
  model?: string | null;
  raw: AnyRec; // 备用
};

function toCard(row: AnyRec): CardItem | null {
  const num = pickNum(row) || "";
  const title = pickTitle(row) || "";
  if (!num && !title) return null;
  return {
    num,
    title,
    image: pickImage(row),
    price: pickPrice(row),
    stock: pickStock(row),
    oe: pickOE(row),
    brand: pickBrand(row),
    model: pickModel(row),
    raw: row,
  };
}

/** -------- 页面组件 -------- */

export default function StockPage() {
  const [items, setItems] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 翻页（后端分页）
  const [page, setPage] = useState(1);        // 1-based
  const [pageSize, setPageSize] = useState(20);

  // 搜索（本页内）
  const [q, setQ] = useState("");

  useEffect(() => {
    const url = `https://niuniuparts.com:6001/scm-product/v1/stock2?size=${pageSize}&page=${page - 1}`;
    setLoading(true);
    setError(null);
    fetch(url, { cache: "no-store" })
      .then(parseResponse)
      .then((raw) => {
        const arr = findArrayInObject(raw);
        const cards = arr
          .map(toCard)
          .filter(Boolean) as CardItem[];
        setItems(cards);
      })
      .catch(() => setError("数据加载失败"))
      .finally(() => setLoading(false));
  }, [page, pageSize]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return items;
    return items.filter((it) => {
      return (
        it.num.toLowerCase().includes(kw) ||
        (it.title || "").toLowerCase().includes(kw) ||
        (it.oe || "").toLowerCase().includes(kw) ||
        (it.brand || "").toLowerCase().includes(kw)
      );
    });
  }, [q, items]);

  const handleDownload = () => {
    const url = `https://niuniuparts.com:6001/scm-product/v1/stock2/excel?size=${pageSize}&page=${page - 1}`;
    location.href = url;
  };

  if (loading) return <p className="p-4">Loading...</p>;
  if (error) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold mb-3">库存产品列表</h1>
        <p className="text-red-600 mb-4">{error}</p>
      </div>
    );
  }

  // 翻页控件
  const Pager = (
    <div className="flex items-center gap-2 flex-wrap mb-4">
      <button
        onClick={() => setPage((p) => Math.max(1, p - 1))}
        disabled={page <= 1}
        className={`px-3 py-1 rounded border ${page <= 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"}`}
      >
        上一页
      </button>
      <span className="text-sm text-gray-600">第 {page} 页</span>
      <button
        onClick={() => setPage((p) => p + 1)}
        className="px-3 py-1 rounded border hover:bg-gray-50"
      >
        下一页
      </button>

      <span className="ml-4 text-sm text-gray-600">每页</span>
      <select
        value={pageSize}
        onChange={(e) => { setPageSize(Number(e.target.value) || 20); setPage(1); }}
        className="px-2 py-1 border rounded"
      >
        <option value={20}>20</option>
        <option value={30}>30</option>
        <option value={50}>50</option>
      </select>
      <span className="text-sm text-gray-600">条</span>

      <button
        onClick={handleDownload}
        className="ml-auto px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        下载库存 Excel
      </button>
    </div>
  );

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-1">库存产品列表</h1>

      <div className="mb-3 text-sm text-gray-600">共 {items.length} 条（当前页）</div>

      {/* 搜索框 */}
      <div className="mb-4 flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索 编号 / 标题 / OE / 品牌（仅当前页）"
          className="w-96 max-w-full px-3 py-2 border rounded outline-none focus:ring"
        />
        {q && (
          <button onClick={() => setQ("")} className="px-3 py-2 border rounded hover:bg-gray-50">
            清空
          </button>
        )}
      </div>

      {Pager}

      {/* 卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map((it) => {
          const href = `/stock/${encodeURIComponent(it.num)}?` + new URLSearchParams({
            product: it.title || "-",
            oe: it.oe || "-",
            brand: it.brand || "-",
            model: it.model || "-",
            year: "-",
            image: it.image || "",
            price: it.price || "",
          }).toString();

          return (
            <div key={it.num + (it.oe || "")} className="border rounded-2xl p-3 shadow-sm hover:shadow-md transition">
              <div className="text-base font-semibold mb-2 line-clamp-2">{it.title || "-"}</div>
              <div className="text-sm text-gray-600 space-y-1 mb-3">
                <div>品牌：{it.brand || "-"}</div>
                <div>车型：{it.model || "-"}</div>
                <div>OE号：{it.oe || "-"}</div>
                <div>编号：{it.num || "-"}</div>
                <div>价格：{it.price || "-"}</div>
                <div>库存：{it.stock || "-"}</div>
              </div>
              <div className="rounded-lg border bg-white flex items-center justify-center" style={{ minHeight: 220 }}>
                {it.image ? (
                  <img
                    src={it.image}
                    alt={it.num}
                    style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 8 }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="text-gray-400">无图</div>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Link href={href} className="px-3 py-2 bg-gray-900 text-white rounded hover:bg-black">
                  查看详情
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4">{Pager}</div>

      <p className="text-xs text-gray-500 mt-6">数据源：niuniuparts.com（测试预览用途）</p>
    </div>
  );
}
