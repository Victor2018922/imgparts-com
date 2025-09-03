"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type StockItem = {
  num: string;
  product: string;
  oe: string;
  brand: string;
  model: string;
  year: string;
};

export default function StockDetailPage({ params }: { params: { num: string } }) {
  const { num } = params;
  const [item, setItem] = useState<StockItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // 方式 A：优先尝试后端按 num 查询（若后端暂不支持，会返回空）
        const resA = await fetch(`/api/stock/item?num=${encodeURIComponent(num)}`, { cache: "no-store" });
        if (resA.ok) {
          const dataA = await resA.json();
          if (Array.isArray(dataA) && dataA.length > 0) {
            setItem(dataA[0]);
            return;
          }
        }
        // 方式 B：兜底策略——取全量再前端筛选
        const resB = await fetch("/api/stock/item", { cache: "no-store" });
        const dataB: StockItem[] = await resB.json();
        setItem(dataB.find((x) => x.num === num) || null);
      } finally {
        setLoading(false);
      }
    })();
  }, [num]);

  if (loading) {
    return <div className="p-4 max-w-4xl mx-auto">Loading...</div>;
  }

  if (!item) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <p className="text-red-600 mb-4">Item not found.</p>
        <Link href="/stock" className="text-blue-600 underline">← Back to Stock</Link>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <Link href="/stock" className="text-blue-600 underline">← Back to Stock</Link>

      <h1 className="text-2xl font-semibold mt-3 mb-4">{item.product}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded p-4">
          <h2 className="font-bold mb-2">Basic Info</h2>
          <p><strong>SKU / Num:</strong> {item.num}</p>
          <p><strong>OE:</strong> {item.oe}</p>
          <p><strong>Brand:</strong> {item.brand}</p>
          <p><strong>Model:</strong> {item.model}</p>
          <p><strong>Year:</strong> {item.year}</p>
        </div>

        <div className="border rounded p-4">
          <h2 className="font-bold mb-2">Notes</h2>
          <p className="text-sm text-gray-600">
            本页为演示数据。后续可扩展：产品图片、适配车型/发动机清单、参数规格、库存与价格、加入购物车等。
          </p>
        </div>
      </div>
    </div>
  );
}
