"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type StockItem = {
  num?: string;
  product?: string;
  oe?: string;
  brand?: string;
  model?: string;
  year?: string;
  [k: string]: any;
};

// 从记录里尽量识别“图片URL”
function pickImageUrl(row: Record<string, any>): string | null {
  const keys = Object.keys(row || {});
  // 优先常见 key
  const candidates = [
    "imageUrl",
    "image_url",
    "imgUrl",
    "img_url",
    "image",
    "img",
    "photo",
    "picture",
    "thumb",
    "thumbnail",
  ];
  for (const k of candidates) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  // 兜底：在所有 key 中模糊找包含 image/img/photo/pic/thumb
  const hit = keys.find((k) => /image|img|photo|pic|thumb/i.test(k));
  const v = hit ? row[hit] : null;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// 从记录里尽量识别“价格”
function pickPrice(row: Record<string, any>): string | null {
  const keys = Object.keys(row || {});
  const candidates = [
    "price",
    "unit_price",
    "unitPrice",
    "salePrice",
    "sale_price",
    "amount",
    "cost",
  ];
  for (const k of candidates) {
    const v = row[k];
    if (v !== null && v !== undefined && v !== "") return String(v);
  }
  const hit = keys.find((k) => /price|amount|cost/i.test(k));
  const v = hit ? row[hit] : null;
  return v !== null && v !== undefined && v !== "" ? String(v) : null;
}

function buildDetailUrl(it: StockItem) {
  const num = String(it?.num ?? "").trim();
  const q = new URLSearchParams({
    product: (it?.product ?? "-").toString(),
    oe: (it?.oe ?? "-").toString(),
    brand: (it?.brand ?? "-").toString(),
    model: (it?.model ?? "-").toString(),
    year: (it?.year ?? "-").toString(),
  }).toString();
  return `/stock/${encodeURIComponent(num)}?${q}`;
}

export default function StockPage() {
  // 数据与状态
  const [data, setData] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 搜索与分页（与后端分页对齐）
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1); // 显示给用户的页码（从1开始）
  const [pageSize, setPageSize] = useState(50); // 将映射到 ?size=
  // 为了简单，这一步只按“当前页”做搜索（下一步再做跨页搜索/总数统计）

  // 请求：使用你提供的分页接口
  useEffect(() => {
    const url = `https://niuniuparts.com:6001/scm-product/v1/stock2?size=${pageSize}&page=${page - 1}`;
    setLoading(true);
    setError(null);

    // 兼容 text/JSON/BOM 的解析函数
    const parseResponse = async (res: Response) => {
      try {
        return await res.json();
      } catch {
        const txt = (await res.text()).trim().replace(/^\uFEFF/, "");
        try {
          return JSON.parse(txt);
        } catch {
          return txt;
        }
      }
    };

    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const raw = await parseResponse(res);
        const arr: StockItem[] = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as any)?.data)
          ? (raw as any).data
          : [];
        setData(arr || []);
      })
      .catch(() => {
        setError("数据加载失败，请稍后再试");
        setData([]);
      })
      .finally(() => setLoading(false));
  }, [page, pageSize]);

  // Excel 下载：跟随当前分页参数
  const handleDownload = () => {
    const url = `https://niuniuparts.com:6001/scm-product/v1/stock2/excel?size=${pageSize}&page=${page - 1}`;
    location.href = url;
  };

  // 当前页内搜索（Num / Product / OE / Brand）
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return data;
    return (data || []).filter((it) => {
      const num = String(it?.num ?? "").toLowerCase();
      const product = String(it?.product ?? "").toLowerCase();
      const oe = String(it?.oe ?? "").toLowerCase();
      const brand = String(it?.brand ?? "").toLowerCase();
      return num.includes(kw) || product.includes(kw) || oe.includes(kw) || brand.includes(kw);
    });
  }, [q, data]);

  if (loading) return <p className="p-4">Loading...</p>;

  // 分页控件（上一页 / 下一页）
  const Pager = (
    <div className="flex items-center gap-2 flex-wrap mb-3">
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
        onChange={(e) => {
          setPageSize(Number(e.target.value) || 50);
          setPage(1); // 切换每页条数时回到第一页
        }}
        className="px-2 py-1 border rounded"
      >
        <option value={20}>20</option>
        <option value={50}>50</option>
        <option value={100}>100</option>
      </select>
      <span className="text-sm text-gray-600">条</span>
    </div>
  );

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-1">Stock List</h1>

      <div className="mb-3 text-sm flex items-center gap-3 flex-wrap">
        {error ? (
          <span className="text-red-600">{error}</span>
        ) : (
          <span className="text-gray-600">本页 {data.length} 条数据</span>
        )}
        <span className="text-gray-500">当前筛选：{filtered.length} 条</span>
        <button
          onClick={handleDownload}
          className="ml-auto px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          下载库存 Excel
        </button>
      </div>

      {/* 搜索框 */}
      <div className="mb-3 flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索 Num / Product / OE / Brand（仅当前页）"
        />
        {q && (
          <button onClick={() => setQ("")} className="px-3 py-2 border rounded hover:bg-gray-50">
            清空
          </button>
        )}
      </div>

      {/* 顶部分页 */}
      {Pager}

      <table className="w-full border border-gray-300 text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1">图片</th>
            <th className="border px-2 py-1">Num</th>
            <th className="border px-2 py-1">Product</th>
            <th className="border px-2 py-1">OE</th>
            <th className="border px-2 py-1">Brand</th>
            <th className="border px-2 py-1">价格</th>
            <th className="border px-2 py-1">Model</th>
            <th className="border px-2 py-1">Year</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length > 0 ? (
            filtered.map((item, idx) => {
              const num = item?.num ? String(item.num) : "";
              const imgUrl = pickImageUrl(item);
              const price = pickPrice(item);
              return (
                <tr key={`${num || "row"}-${idx}`} className="hover:bg-gray-50">
                  <td className="border px-2 py-1">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={num}
                        style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8 }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <span className="text-gray-400">无图</span>
                    )}
                  </td>
                  <td className="border px-2 py-1">
                    {num ? (
                      <Link href={buildDetailUrl(item)} className="text-blue-600 hover:underline">
                        {num}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="border px-2 py-1">{item?.product ?? "-"}</td>
                  <td className="border px-2 py-1">{item?.oe ?? "-"}</td>
                  <td className="border px-2 py-1">{item?.brand ?? "-"}</td>
                  <td className="border px-2 py-1">{price ?? "-"}</td>
                  <td className="border px-2 py-1">{item?.model ?? "-"}</td>
                  <td className="border px-2 py-1">{item?.year ?? "-"}</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={8} className="border px-2 py-6 text-center text-gray-500">
                没有匹配的结果（当前页）
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* 底部分页 */}
      <div className="mt-3">{Pager}</div>

      <p className="text-xs text-gray-500 mt-3">数据源：niuniuparts.com（测试预览用途）</p>
    </div>
  );
}

