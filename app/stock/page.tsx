// app/stock/page.tsx
"use client";

import { useEffect, useState } from "react";

interface Product {
  num: string;
  product: string;
}

export default function StockPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/stock/item?num=ALL");
        if (!res.ok) {
          throw new Error(`Fetch failed: ${res.status}`);
        }
        const data = await res.json();
        if (Array.isArray(data)) {
          setItems(data);
        } else {
          setError("返回数据不是数组格式");
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <p style={{ padding: 20 }}>加载中…</p>;
  if (error) return <p style={{ padding: 20, color: "red" }}>错误: {error}</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1>库存产品列表</h1>
      <ul>
        {items.map((item) => (
          <li key={item.num}>
            {item.num} - {item.product}
          </li>
        ))}
      </ul>
    </div>
  );
}
