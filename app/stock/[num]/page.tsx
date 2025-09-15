"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface StockItem {
  num: string;
  name: string;
  brand: string;
  model: string;
  year: string;
  price: number;
  stock: number;
  oe?: string;
  pics?: string[];
}

export default function StockDetailPage() {
  const { num } = useParams<{ num: string }>();
  const router = useRouter();
  const [item, setItem] = useState<StockItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!num) return;

    const fetchDetail = async () => {
      try {
        const res = await fetch(
          `https://niuniuparts.com:6001/scm-product/v1/stock2?num=${num}`
        );

        if (!res.ok) {
          throw new Error(`加载失败：HTTP ${res.status}`);
        }

        const data = await res.json();

        if (data && data.length > 0) {
          setItem(data[0]);
        } else {
          setError("未找到该商品");
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [num]);

  if (loading) return <p>加载中...</p>;
  if (error) return <p style={{ color: "red" }}>加载失败：{error}</p>;
  if (!item) return <p>未找到该商品</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Product Detail</h1>

      <div className="flex gap-6">
        {item.pics && item.pics.length > 0 ? (
          <img
            src={item.pics[0]}
            alt={item.name}
            className="w-80 h-80 object-contain border rounded"
          />
        ) : (
          <p>暂无图片</p>
        )}

        <div>
          <p><strong>Num:</strong> {item.num}</p>
          <p><strong>Name:</strong> {item.name}</p>
          <p><strong>Parts Brand:</strong> {item.brand}</p>
          <p><strong>Brand:</strong> {item.model}</p>
          <p><strong>Year:</strong> {item.year}</p>
          <p><strong>Price:</strong> ${item.price}</p>
          <p><strong>Stock:</strong> {item.stock}</p>
        </div>
      </div>

      <button
        onClick={() => router.push("/stock")}
        className="mt-6 px-4 py-2 bg-blue-600 text-white rounded"
      >
        ← 返回列表
      </button>
    </div>
  );
}
