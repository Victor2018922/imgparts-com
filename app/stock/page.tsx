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
    const controller = new AbortController();

    fetch("https://niuniuparts.com:6001/scm-product/v1/stock2", {
      signal: controller.signal,
      // 明确禁用缓存，避免意外的旧响应
      cache: "no-store",
    })
      .then((res) => {
        if (!res.ok) throw new Error(`upstream_${res.status}`);
        return res.json();
      })
      .then((json) => {
        const arr = Array.isArray(json) ? json : [];
        setData(arr);
        setLoading(false);
      })
      .catch(() => {
        // 任何异常都不抛出，避免客户端崩溃
        setError("数据加载失败，请稍后再试");
        setData([]); // 兜底为空数组，防止 .map 崩溃
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const handleDownload = () => {
    // 只做简单跳转，不依赖外部窗口状态
    location.href = "https://niuniuparts.com:6001/scm-product/v1/stock2/excel";
  };

  if (loading) return <p className="p-4">Loading...</p>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Stock List</h1>

      {/* 提示区（不阻塞渲染） */}
      {error ? (
        <p className="mb-3 text-red-600">{error}</p>
      ) : (
        <p className="mb-3 text-gray-600">共 {data.length} 条数据</p>
      )}

      {/* 下载按钮 */}
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
          {(Array.isArray(data) ? data : []).map((item, idx) => {
            // 全面防御：任何缺失字段都给占位符，避免渲染时报错
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
              <td colSpan={6} className="border px-2 py-6 text-center text-gray-500">
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

