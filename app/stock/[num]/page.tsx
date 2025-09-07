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

  // 新增：图片地址与数量
  const [imgSrc, setImgSrc] = useState<string>(`/images/${num}.jpg`);
  const [qty, setQty] = useState<number>(1);

  useEffect(() => {
    (async () => {
      try {
        // 优先：精确查询 ?num=
        const resA = await fetch(`/api/stock/item?num=${encodeURIComponent(num)}`, { cache: "no-store" });
        if (resA.ok) {
          const dataA = await resA.json();
          if (Array.isArray(dataA) && dataA.length > 0) {
            setItem(dataA[0]);
            return;
          }
        }
        // 兜底：全量再前端筛选
        const resB = await fetch("/api/stock/item", { cache: "no-store" });
        const dataB: StockItem[] = await resB.json();
        setItem(dataB.find((x) => x.num === num) || null);
      } finally {
        setLoading(false);
      }
    })();
  }, [num]);

  // 数量增减与校验
  const dec = () => setQty((v) => Math.max(1, v - 1));
  const inc = () => setQty((v) => v + 1);
  const onQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value.replace(/[^\d]/g, "") || "1", 10);
    setQty(Math.max(1, val));
  };
  const addToCart = () => {
    if (!item) return;
    alert(`已加入购物车：${qty} × ${item.product}（${item.num}）`);
  };

  if (loading) {
    return <div className="p-4 max-w-6xl mx-auto">Loading...</div>;
  }

  if (!item) {
    return (
      <div className="p-4 max-w-6xl mx-auto">
        <p className="text-red-600 mb-4">Item not found.</p>
        <Link href="/stock" className="text-blue-600 underline">← Back to Stock</Link>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="mb-3">
        <Link href="/stock" className="text-blue-600 underline">← Back to Stock</Link>
      </div>

      <div className="flex items-start justify-between gap-6">
        {/* 左侧：图片 + 规格 + 适配 */}
        <div className="flex-1 space-y-4">
          {/* 图片区域：先尝试本地 /public/images/{num}.jpg；失败则回退到在线占位图 */}
          <div className="w-full border rounded overflow-hidden bg-gray-100">
            <img
              src={imgSrc}
              alt={`${item.product} image`}
              style={{ width: "100%", height: "auto" }}
              onError={() =>
                setImgSrc(
                  `https://via.placeholder.com/800x450?text=${encodeURIComponent(
                    item.product || "No Image"
                  )}`
                )
              }
            />
          </div>

          {/* 规格参数 */}
          <div className="border rounded p-4">
            <h2 className="font-bold mb-3 text-lg">Specifications</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-gray-500">SKU / Num:</span>{" "}
                <span className="font-medium">{item.num}</span>
              </div>
              <div>
                <span className="text-gray-500">OE:</span>{" "}
                <span className="font-medium">{item.oe}</span>
              </div>
              <div>
                <span className="text-gray-500">Brand:</span>{" "}
                <span className="font-medium">{item.brand}</span>
              </div>
              <div>
                <span className="text-gray-500">Model:</span>{" "}
                <span className="font-medium">{item.model}</span>
              </div>
              <div>
                <span className="text-gray-500">Year:</span>{" "}
                <span className="font-medium">{item.year}</span>
              </div>
            </div>
          </div>

          {/* 适配信息 */}
          <div className="border rounded p-4">
            <h2 className="font-bold mb-3 text-lg">Compatibility</h2>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>Brand: {item.brand}</li>
              <li>Model: {item.model}</li>
              <li>Year: {item.year}</li>
            </ul>
          </div>
        </div>

        {/* 右侧：购买区（数量可用） */}
        <aside className="w-full md:w-80 shrink-0">
          <div className="border rounded p-4 sticky top-4">
            <h2 className="font-bold text-lg mb-3">Buy Box</h2>
            <div className="text-sm text-gray-600 mb-2">（占位）未来显示价格、库存、配送、卖家评分等</div>
            <div className="flex items-center gap-2 mb-3">
              <button className="border rounded px-3 py-2" onClick={dec} aria-label="decrease quantity">-</button>
              <input
                className="w-16 border rounded px-2 py-2 text-center"
                value={qty}
                onChange={onQtyChange}
                inputMode="numeric"
                aria-label="quantity"
              />
              <button className="border rounded px-3 py-2" onClick={inc} aria-label="increase quantity">+</button>
            </div>
            <button className="w-full bg-black text-white rounded py-2" onClick={addToCart}>
              Add to Cart
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
