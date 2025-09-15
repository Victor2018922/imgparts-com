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

const demoData: StockItem[] = [
  { num: "610474", product: "Wheel Hub Bearing", oe: "OE-610474", brand: "VW", model: "Golf", year: "2018" },
  { num: "819077", product: "Brake Pad Set", oe: "OE-819077", brand: "Audi", model: "A4", year: "2017" },
  { num: "JS0260", product: "Oil Filter", oe: "90915-YZZE1", brand: "Toyota", model: "Corolla", year: "2018" },
  { num: "1K0129620D", product: "Air Filter", oe: "1K0 129 620 D", brand: "VW", model: "Jetta", year: "2012" },
  { num: "4F0615301", product: "Shock Absorber", oe: "4F0 615 301", brand: "Audi", model: "A6", year: "2010" },
];

export default function StockPage() {
  const [data, setData] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingDemo, setUsingDemo] = useState(false);

  // 尝试更稳健地解析返回体（兼容 text/JSON、BOM、包壳）
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

  useEffect(() => {
    const url = "https://niuniuparts.com:6001/scm-product/v1/stock2";
    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const raw = await parseResponse(res);
        let arr: StockItem[] = [];
        if (Array.isArray(raw)) arr = raw;
        else if (raw && Array.isArray((raw as any).data)) arr = (raw as any).data;
        // 如果真实数据为空，自动启用演示数据
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
        // 异常也回退到演示数据（页面不中断）
        setError("数据源暂不可用，已显示演示数据");
        setData(demoData);
        setUsingDemo(true);
        setLoading(false);
      });
  }, []);

  const handleDownload = () => {
    // 仍然用官方 Excel 接口下载
    location.href = "https://niuniuparts.com:6001/scm-product/v1/stock2/excel";
  };

  if (loading) {
    return <p className="p-4">Loading...</p>;
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-1">Stock List</h1>
      <div className="mb-3 text-sm">
        {error ? (
          <span className="text-red-600">{error}</span>
        ) : (
          <span className="text-gray-600">共 {data.length} 条数据</span>
        )}
        {usingDemo && (
          <span className="ml-2 px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700 align-middle">
            正在使用演示数据
          </span>
        )}
      </div>

      <button
        onClick={handleDownload}
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        下载库存 Excel


