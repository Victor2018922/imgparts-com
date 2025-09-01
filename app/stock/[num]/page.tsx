// app/stock/[num]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Item = {
  num: string;
  product: string;
  oe?: string;
  brand?: string;
  model?: string;
  year?: string;
  category?: string;
  note?: string;
  raw?: Record<string, any>;
};

function splitTags(s?: string) {
  if (!s) return [] as string[];
  // 支持逗号 / 斜杠 / 空格分隔，多 OE 也能正常展示
  return s
    .toString()
    .split(/[,\s/]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function StockDetailPage({ params }: { params: { num: string } }) {
  const { num } = params;
  const [data, setData] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [copiedOE, setCopiedOE] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      try {
        const res = await fetch(`/api/stock/item?num=${encodeURIComponent(num)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Item;
        setData(json);
      } catch (e: any) {
        setErr(e?.message || "加载失败");
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [num]);

  const oeTags = useMemo(() => splitTags(data?.oe), [data?.oe]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedOE(text);
      setTimeout(() => setCopiedOE(null), 1200);
    } catch {}
  }

  if (loading) return <div style={{ padding: 20 }}>加载中…</div>;
  if (err) {
    return (
      <div style={{ padding: 20 }}>
        <h2>加载失败</h2>
        <p style={{ color: "red" }}>{err}</p>
        <a href="/stock">← 返回库存列表</a>
      </div>
    );
  }
  if (!data) {
    return (
      <div style={{ padding: 20 }}>
        <h2>SKU 未找到</h2>
        <p>没有找到编号为 {num} 的产品。</p>
        <a href="/stock">← 返回库存列表</a>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 20px", maxWidth: 1100, margin: "0 auto" }}>
      {/* 标题区 */}
      <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 8 }}>
        {data.product || "未命名产品"}
      </h1>
      <div style={{ color: "#6b7280", marginBottom: 20 }}>SKU：{data.num}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, alignItems: "start" }}>
        {/* 左侧图片占位 */}
        <div
          style={{
            gridColumn: "1 / span 1",
            background: "#f8fafc",
            border: "1px solid #eef2f7",
            borderRadius: 16,
            height: 280,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#94a3b8",
          }}
        >
          No Image
        </div>

        {/* 右侧信息卡片 */}
        <div style={{ gridColumn: "2 / span 2", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {/* OE 标签块 */}
          <div style={card}>
            <div style={label}>OE</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {oeTags.length > 0 ? (
                oeTags.map((code) => (
                  <button
                    key={code}
                    onClick={() => copy(code)}
                    title="点击复制 OE"
                    style={{
                      border: "1px solid #e5e7eb",
                      background: "#fff",
                      borderRadius: 9999,
                      padding: "4px 10px",
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    {copiedOE === code ? "已复制 ✓" : code}
                  </button>
                ))
              ) : (
                <span>-</span>
              )}
            </div>
          </div>

          {/* 品牌 */}
          <div style={card}>
            <div style={label}>品牌</div>
            <div style={value}>{data.brand || "-"}</div>
          </div>

          {/* 类别 */}
          <div style={card}>
            <div style={label}>类别</div>
            <div style={value}>{data.category || "-"}</div>
          </div>

          {/* 适配信息汇总（更像 AUTODOC 的“Compatibility”语义） */}
          <div style={{ ...card, gridColumn: "1 / span 3" }}>
            <div style={label}>适配信息</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {data.brand && <Tag>{data.brand}</Tag>}
              {data.model && <Tag>{data.model}</Tag>}
              {data.year && <Tag>{String(data.year)}</Tag>}
              {!data.brand && !data.model && !data.year && <span>-</span>}
            </div>
          </div>

          {/* 备注 */}
          <div style={{ ...card, gridColumn: "1 / span 3" }}>
            <div style={label}>备注</div>
            <div
              style={{
                minHeight: 60,
                border: "1px solid #eef2f7",
                borderRadius: 12,
                padding: "10px 12px",
                background: "#fff",
                lineHeight: 1.6,
              }}
            >
              {data.note || "-"}
            </div>
          </div>
        </div>
      </div>

      {/* 操作按钮区 */}
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <a href="/stock" style={btnSecondary}>
          返回列表
        </a>
        <a href="https://wa.me/0000000000" target="_blank" rel="noreferrer" style={btnPrimary}>
          WhatsApp 询价
        </a>
        <a href="https://t.me/your_handle" target="_blank" rel="noreferrer" style={btnBlue}>
          Telegram 询价
        </a>
      </div>

      {/* 调试：原始数据 */}
      <details style={{ marginTop: 16 }}>
        <summary>原始数据（调试用）</summary>
        <pre style={{ background: "#0b1020", color: "#D1D5DB", padding: 12, borderRadius: 8, overflow: "auto" }}>
{JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        border: "1px solid #e5e7eb",
        background: "#fff",
        borderRadius: 9999,
        padding: "4px 10px",
        fontSize: 14,
      }}
    >
      {children}
    </span>
  );
}

const card: React.CSSProperties = {
  border: "1px solid #eef2f7",
  borderRadius: 16,
  padding: "10px 12px",
  background: "#fff",
  minHeight: 68,
};

const label: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  marginBottom: 6,
};

const value: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 500,
};

const btnSecondary: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  textDecoration: "none",
  color: "#111827",
  background: "#fff",
};

const btnPrimary: React.CSSProperties = {
  ...btnSecondary,
  background: "#111827",
  color: "#fff",
  border: "1px solid #111827",
};

const btnBlue: React.CSSProperties = {
  ...btnSecondary,
  background: "#2563eb",
  color: "#fff",
  border: "1px solid #2563eb",
};
