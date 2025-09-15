"use client";

import { useEffect, useState } from "react";
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

export default function StockPage() {
  const [data, setData] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("https://niuniuparts.com:6001/scm-product/v1/stock2", {
      cache: "no-store",
    })
      .then((res) => {
        if (!res.ok) throw new Error(`upstream_${res.status}`);
        return res.json();
      })
      .then((json) => {
        console.log("API返回内容:", json); // 调试输出
        if (Array.isArray(json) && json.length > 0) {
          setData(json);
        } else if (json?.data && Array.isArray(json.data)) {
          setData(json.data);
        } else {
          setData([]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("加载错误:", err);
        setError("数据加载失败，请稍后再试");
        setData([]);
        setLoading(false);
      });
  }, []);

  const handleDownload = () => {
    location.href =
      "https://niuniuparts.com:6001/scm-product/v1/stock2/excel";
  };

  if (loading) {
    return <p className="p-4">Loading...</p>;
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Stock List</h1>

      {error ? (
        <p className="mb-3 text-red-600">{error}</p>
      ) : (
        <p className="mb-3 text-gray-600">共 {data.length} 条数据</p>
      )}

      <button
        onClick={handleDownload}
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        下载库存 Excel
      </button>

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
          {(data || []).map((item, idx) => {
            const num = item?.num ? String(item.num) : "";
            return (
              <tr key={`${num}-${idx}`} className="hover:bg-gray-50">
                <td className="border px-2 py-1">
                  {num ? (
                    <Link
                      href={`/stock/${encodeURIComponent(num)}`}
                      className="text-blue-600 hover:underline"
                    >
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
          })}
          {(!data || data.length === 0) && (
            <tr>
              <td
                colSpan={6}
                className="border px-2 py-6 text-center text-gray-500"
              >
                暂无数据
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <p className="text-xs text-gray-500 mt-3">
        数据源：niuniuparts.com（测试预览用途）
      </p>
    </div>
  );
}

