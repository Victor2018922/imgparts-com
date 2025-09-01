// app/stock/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

interface Product {
  num: string;
  product: string;
  oe?: string;
  brand?: string;
  model?: string;
  year?: string;
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
      const c = (it.oe || "").toLowerCase();
      const d = (it.brand || "").toLowerCase();
      const e = (it.model || "").toLowerCase();
      return (
        a.includes(kw) ||
        b.includes(kw) ||
        c.includes(kw) ||
        d.includes(kw) ||
        e.includes(kw)
      );
    });
  }, [q, items]);

  if (loading) return <p style={{ padding: 20 }}>加载中…</p>;
  if (error) return <p style={{ padding: 20, color: "red" }}>错误: {error}</p>;

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
        库存产品列表
      </h1>

      {/* 搜索框 */}
      <div style={{ marginBottom: 16 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索：SKU / 产品名 / OE / 品牌 / 车型"
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

      {/* 简易表格 */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            border: "1px solid #e5e7eb",
            borderRadius: 8,
          }}
        >
          <thead style={{ background: "#f8fafc" }}>
            <tr>
              <th style={th}>SKU</th>
              <th style={th}>产品</th>
              <th style={th}>OE</th>
              <th style={th}>品牌</th>
              <th style={th}>车型</th>
              <th style={th}>年份</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it) => (
              <tr
                key={it.num}
                style={{ cursor: "pointer" }}
                onClick={() =>
                  (window.location.href = `/stock/${encodeURIComponent(it.num)}`)
                }
                onMouseEnter={(e) =>
                  ((e.currentTarget.style.backgroundColor = "#f8fafc"))
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget.style.backgroundColor = "transparent"))
                }
              >
                <td style={tdBold}>{it.num}</td>
                <td style={td}>{it.product || "-"}</td>
                <td style={td}>{it.oe || "-"}</td>
                <td style={td}>{it.brand || "-"}</td>
                <td style={td}>{it.model || "-"}</td>
                <td style={td}>{it.year || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #f1f5f9",
  whiteSpace: "nowrap",
};

const tdBold: React.CSSProperties = {
  ...td,
  fontWeight: 600,
};
