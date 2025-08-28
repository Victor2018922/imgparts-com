// app/stock/[num]/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Product {
  brand?: string;     // 车辆品牌
  car?: string;       // 车型
  carCode?: string;   // 车系代号
  name?: string;      // 产品名称
  num?: string;       // 编号
  oe?: string;        // OE号
  pics?: string[];    // 图片数组
}

export default function StockDetailPage({ params }: { params: { num: string } }) {
  const { num } = params;
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function fetchDetail() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/stock/item?num=${encodeURIComponent(num)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const t = await res.json().catch(() => ({}));
          throw new Error(t?.error || `HTTP ${res.status}`);
        }
        const json = await res.json();
        if (!ignore) setItem(json?.item || null);
      } catch (e: any) {
        console.error("加载详情失败", e);
        if (!ignore) setError(e?.message || "加载失败");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchDetail();
    return () => {
      ignore = true;
    };
  }, [num]);

  return (
    <div style={{ padding: 20 }}>
      <Link href="/stock" style={{ textDecoration: "none", color: "#1677ff" }}>
        ← 返回列表
      </Link>

      <h1 style={{ margin: "12px 0 8px" }}>详情页</h1>
      <div style={{ color: "#666", marginBottom: 12 }}>你访问的编号是：{num}</div>

      {loading ? (
        <p>正在加载数据...</p>
      ) : error ? (
        <p style={{ color: "crimson" }}>加载失败：{error}</p>
      ) : !item ? (
        <p>没有找到该编号的产品</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "360px 1fr",
            columnGap: 24,
            alignItems: "flex-start",
          }}
        >
          {/* 左侧图片区 */}
          <div>
            {item.pics?.length ? (
              <div>
                <img
                  src={item.pics[0]}
                  alt={item.name || ""}
                  style={{
                    width: 360,
                    height: 260,
                    objectFit: "contain",
                    background: "#fafafa",
                    border: "1px solid #eee",
                    borderRadius: 8,
                  }}
                />
                {/* 额外小图预览 */}
                {item.pics.length > 1 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    {item.pics.slice(1, 6).map((p, i) => (
                      <img
                        key={i}
                        src={p}
                        alt={`pic-${i}`}
                        style={{
                          width: 64,
                          height: 64,
                          objectFit: "contain",
                          background: "#fafafa",
                          border: "1px solid #eee",
                          borderRadius: 6,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  width: 360,
                  height: 260,
                  background: "#fafafa",
                  border: "1px solid #eee",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#999",
                }}
              >
                暂无图片
              </div>
            )}
          </div>

          {/* 右侧信息 */}
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
              {item.name || "(未命名产品)"}
            </div>

            <div style={{ lineHeight: 1.8, color: "#333" }}>
              <div>
                <strong>车辆品牌：</strong>
                {item.brand || "-"}
              </div>
              <div>
                <strong>车型/代码：</strong>
                {item.car || "-"}（{item.carCode || "-"}）
              </div>
              <div>
                <strong>OE 号：</strong>
                {item.oe || "-"}
              </div>
              <div>
                <strong>编号：</strong>
                {item.num || "-"}
              </div>
            </div>

            {/* 这里可以继续扩展：价格、库存、产地、适配车型、参数、图纸等 */}
            <div style={{ marginTop: 16, color: "#888", fontSize: 13 }}>
              数据源：niuniuparts.com（测试预览用途）
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
