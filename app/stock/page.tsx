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

const demoData: StockItem[] = [
  { num: "610474", product: "-", oe: "68500-T20-H20ZZ", brand: "IMG(OE配套)", model: "-", year: "-" },
  { num: "819077", product: "-", oe: "31100-5AY-H01", brand: "IMG", model: "-", year: "-" },
  { num: "JS0260", product: "-", oe: "52453-02130", brand: "雷根斯堡", model: "-", year: "-" },
  { num: "510082", product: "-", oe: "51360-TW0-H00", brand: "IMG", model: "-", year: "-" },
  { num: "113039", product: "-", oe: "19502-R1A-A01", brand: "IMG", model: "-", year: "-" },
];

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
  const [data, setData] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingDemo, setUsingDemo] = useState(false);

  const [q, setQ] = useState("");

  // 尽量稳健解析返回体
  const parseResponse = async (res: Response) => {
    try {
      return await res.json();
    } catch {
      const txt = (await res.text()).trim().replace(/^\uFEFF/, "");
      try { return JSON.parse(txt); } catch { return txt; }
    }
  };

  useEffect(() => {
    const url = "https://niuniuparts.com:6001/scm-product/v1/stock2";
    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const raw = await parseResponse(res);
        let arr: StockItem[] = [];
        if (Array.isArray(raw)) arr = raw;
        else if (raw && Array.isArray((raw as any).data)) arr = (raw as any).data;

        if (!arr || arr.length === 0) {
          setData(demoData);
          setUsingDemo(true);
        } else {
          setData(arr);
          setUsingDemo(false);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("数据源暂不可用，已显示演示数据");
        setData(demoData);
        setUsingDemo(true);
        setLoading(false);
      });
  }, []);

  const handleDownload = () => {
    location.href = "https://niuniuparts.com:6001/scm-product/v1/stock2/excel";
  };

  // 关键词过滤（Num / Product / OE / Brand）
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

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-1">Stock List</h1>

      <div className="mb-3 text-sm flex items-center gap-3 flex-wrap">
        {error ? (
          <span className="text-red-600">{error}</span>
        ) : (
          <span className="text-gray-600">共 {data.length} 条数据</span>
        )}
        {usingDemo && (
          <span className="px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700">
            正在使用演示数据
          </span>
        )}
        <span className="text-gray-500">当前筛选：{filtered.length} 条</span>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索 Num / Product / OE / Brand"
          className="w-80 max-w-full px-3 py-2 border rounded outline-none focus:ring"
        />
        {q && (
          <button onClick={() => setQ("")} className="px-3 py-2 border rounded hover:bg-gray-50">
            清空
          </button>
        )}
        <button
          onClick={handleDownload}
          className="ml-auto px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          下载库存 Excel
        </button>
      </div>

      <table className="w-full border border-gray-300 text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1">Num</th>
            <th className="border px-2 py-1">Product</th>
            <th className="border px-2 py-1">OE</th>
            <th className="border px-2 py-1">Brand</th>
            <th className="border px-2 py-1">Model</th>
            <th className="border px-2 py-1">Year</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length > 0 ? (
            filtered.map((item, idx) => {
              const num = item?.num ? String(item.num) : "";
              return (
                <tr key={`${num || "row"}-${idx}`} className="hover:bg-gray-50">
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
                  <td className="border px-2 py-1">{item?.model ?? "-"}</td>
                  <td className="border px-2 py-1">{item?.year ?? "-"}</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={6} className="border px-2 py-6 text-center text-gray-500">
                没有匹配的结果
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <p className="text-xs text-gray-500 mt-3">数据源：niuniuparts.com（测试预览用途）</p>
    </div>
  );
}

