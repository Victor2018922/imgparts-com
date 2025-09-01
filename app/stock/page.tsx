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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

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

  // 搜索
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

  // 搜索变化时回到第 1 页
  useEffect(() => {
    setPage(1);
  }, [q, pageSize]);

  // 分页
  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const end = start + pageSize;
  const visible = filtered.slice(start, end);

  if (loading) return <p style={{ padding: 20 }}>加载中…</p>;
  if (error) return <p style={{ padding: 20, color: "red" }}>错误: {error}</p>;

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
        库存产品列表
      </h1>

      {/* 搜索与分页设置 */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索：SKU / 产品名 / OE / 品牌 / 车型"
          style={{
            flex: 1,
            minWidth: 260,
            padding: "10px 12px",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            outline: "none",
          }}
        />
        <label style={{ color: "#6b7280" }}>
          每页
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            style={{ marginLeft: 6, padding: "6px 8px", borderRadius: 6, border: "1px solid #e5e7eb" }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          条
        </label>
      </div>

      <div style={{ marginBottom: 8, color: "#6b7280" }}>
        共 {total} 条，当前第 {current}/{pageCount} 页
      </div>

      {/* 表格 */}
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
            {visible.map((it) => (
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
            {visible.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 16, textAlign: "center", color: "#6b7280" }}>没有匹配的数据。</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 翻页控件 */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
        <button
          disabled={current <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          style={btn(current <= 1)}
        >
          上一页
        </button>
        <button
          disabled={current >= pageCount}
          onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          style={btn(current >= pageCount)}
        >
          下一页
        </button>
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

const btn = (disabled: boolean): React.CSSProperties => ({
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  background: disabled ? "#f3f4f6" : "white",
  color: disabled ? "#9ca3af" : "#111827",
  cursor: disabled ? "not-allowed" : "pointer",
});
