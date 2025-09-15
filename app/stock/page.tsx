"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface StockItem {
  num: string;
  product: string;
  oe: string;
  brand: string;
  model: string;
  year: string;
}

export default function StockPage() {
  const [data, setData] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("https://niuniuparts.com:6001/scm-product/v1/stock2")
      .then((res) => {
        if (!res.ok) {
          throw new Error("API 请求失败: " + res.status);
        }
        return res.json();
      })
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fetch Error:", err);
        setError("数据加载失败，请稍后重试");
        setLoading(false);
      });
  }, []);

  const handleDownload = () => {
    try {
      window.open("https://niuniuparts.com:6001/scm-product/v1/stock2/excel", "_blank");
    } catch (err) {
      console.error("Download Error:", err);
    }
  };

  if (loading) {
    return <p className="p-4">Loading...</p>;
  }

  if (error) {
    return <p className="p-4 text-red-600">{error}</p>;
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Stock List</h1>

      {/* 下载按钮 */}
      <button
        onClick={handleDownload}
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        下载库存 Excel
      </button>

      <table className="w-full border border-gray-300">
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
          {data.map((item) => (
            <tr key={item.num} className="hover:bg-gray-50">
              <td className="border px-2 py-1">
                <Link href={`/stock/${item.num}`} className="text-blue-600 hover:underline">
                  {item.num}
                </Link>
              </td>
              <td className="border px-2 py-1">{item.product}</td>
              <td className="border px-2 py-1">{item.oe}</td>
              <td className="border px-2 py-1">{item.brand}</td>
              <td className="border px-2 py-1">{item.model}</td>
              <td className="border px-2 py-1">{item.year}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

