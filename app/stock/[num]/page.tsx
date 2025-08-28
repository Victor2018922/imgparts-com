"use client";

import { useEffect, useState } from "react";

type AnyRecord = Record<string, any>;

function pick<T = string>(obj: AnyRecord, keys: string[], fallback = ""): T | string {
  for (const k of keys) {
    const parts = k.split(".");
    let cur: any = obj;
    for (const p of parts) {
      if (!cur || !(p in cur)) { cur = undefined; break; }
      cur = cur[p];
    }
    if (cur !== undefined && cur !== null && cur !== "") return cur as T;
  }
  return fallback;
}

export default function StockDetail({ params }: { params: { num: string } }) {
  const [item, setItem] = useState<AnyRecord | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("last_item");
      if (raw) setItem(JSON.parse(raw));
    } catch {}
  }, []);

  const name  = pick(item || {}, ["name"], "");
  const oe    = pick(item || {}, ["oe", "oenumber", "oe_number", "OE"], "");
  const price = pick<number>(item || {}, ["price", "unitPrice", "salePrice", "amount"], 0) as number | string;
  const stock = pick<number>(item || {}, ["stock", "qty", "quantity", "available", "inventory"], 0) as number | string;
  const img   = pick(item || {}, ["image", "imageUrl", "picture", "thumbnail", "photo", "images.0"], "");
  const car   = pick(item || {}, ["car"], "");
  const carCode = pick(item || {}, ["carCode"], "");
  const brand = pick(item || {}, ["brand", "brandName"], "");
  const num   = pick(item || {}, ["num"], "");
  const partBrand = pick(item || {}, ["partBrand", "maker"], "");

  return (
    <div style={{ padding: 20 }}>
      <a href="/stock">← 返回列表</a>
      <h1 style={{ margin: "12px 0" }}>产品详情</h1>

      {!item ? (
        <p style={{ color: "#666" }}>
          没有读取到产品对象（可能是直接打开了详情页）。
          请先从 <a href="/stock">库存列表</a> 点击“查看详情”进入。
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 24 }}>
          <div>
            {img ? (
              <img
                src={img}
                alt={name}
                style={{ width: 320, height: 320, objectFit: "contain", background: "#fafafa", border: "1px solid #eee" }}
              />
            ) : (
              <div style={{ width: 320, height: 320, display: "flex", alignItems: "center", justifyContent: "center",
                            border: "1px dashed #ccc", color: "#999" }}>
                无图片
              </div>
            )}
          </div>

          <div>
            <h2 style={{ marginTop: 0 }}>{name || "未命名产品"}</h2>
            <div style={{ lineHeight: 1.9, fontSize: 15 }}>
              <div>车辆品牌：{brand || "-"}</div>
              <div>车型/代码：{car || "-"}（{carCode || "-"}）</div>
              <div>OE号：{oe || "-"}</div>
              <div>编号：{num || "-"}</div>
              <div>配件品牌：{partBrand || "-"}</div>
              <div>价格：{price || "-"}</div>
              <div>库存：{stock || "-"}</div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 32, color: "#666" }}>
        数据源：niuniuparts.com（测试预览用途）
      </div>
    </div>
  );
}
