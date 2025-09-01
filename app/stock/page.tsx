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
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) setItems(data);
        else throw new Error("返回数据不是数组格式");
      } catch (err: any) {
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <p style={{ padding: 20 }}>加载中…</p>;
  if (error) return <p style={{ padding: 20, color: "red" }}>错误: {error}</p>;

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
        库存产品列表
      </h1>

      {items.length === 0 ? (
        <p>没有数据。</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((item) => (
            <li key={item.num} style={{ marginBottom: 10 }}>
              <a
                href={`/stock/${encodeURIComponent(item.num)}`}
                style={{
                  display: "block",
                  padding: "12px 14px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  textDecoration: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget.style.backgroundColor = "#f8fafc");
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget.style.backgroundColor = "transparent");
                }}
              >
                <div style={{ fontWeight: 600 }}>{item.num}</div>
                <div style={{ color: "#4b5563" }}>
                  {item.product || "未命名产品"}
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
