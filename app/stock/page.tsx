// app/stock/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

interface Product {
  num: string;
  product: string;
}

export default function StockPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

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

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return items;
    return items.filter((it) => {
      const a = (it.num || "").toLowerCase();
      const b = (it.product || "").toLowerCase();
      return a.includes(kw) || b.includes(kw);
    });
  }, [q, items]);

  if (loading) return <p style={{ padding: 20 }}>加载中…</p>;
  if (error) return <p style={{ padding: 20, color: "red" }}>错误: {error}</p>;

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
        库存产品列表
      </h1>

      {/* 搜索框 */}
      <div style={{ marginBottom: 16 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索：输入 SKU 或 产品名"
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            outline: "none",
          }}
        />
        <div style={{ marginTop: 8, color: "#6b7280" }}>
          共 {items.length} 条，当前匹配 {filtered.length} 条
        </div>
      </div>

      {filtered.length === 0 ? (
        <p>没有匹配的数据。</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {filtered.map((item) => (
            <li key={item.num} style={{ marginBottom: 10 }}>
              <a
                href={`/stock/${encodeURIComponent(item.num)}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "12px 14px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  textDecoration: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f8fafc";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <div style={{ fontWeight: 600, minWidth: 120 }}>{item.num}</div>
                <div style={{ color: "#4b5563", flex: 1 }}>
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
