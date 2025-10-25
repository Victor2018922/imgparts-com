"use client";
import React, { useEffect, useState } from "react";

interface Product {
  id: string;
  productName?: string;
  partName?: string;
  brandName?: string;
  model?: string;
  price?: number;
  imageUrl?: string;
}

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(
          "https://niuniuparts.com:6001/scm-product/v1/products?keyword=&page=0&size=500"
        );
        if (!res.ok) {
          throw new Error(`接口返回错误状态码：${res.status}`);
        }
        const data = await res.json();

        // 自动识别正确字段
        if (data?.content && Array.isArray(data.content)) {
          setProducts(data.content);
        } else if (Array.isArray(data)) {
          setProducts(data);
        } else {
          throw new Error("接口返回数据结构不符合预期");
        }
      } catch (err: any) {
        setError(err.message || "加载失败");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <h1 style={{ color: "green", fontSize: "28px", marginBottom: "10px" }}>
        ✅ ImgParts 库存页正常运行中
      </h1>

      {loading && <p>⏳ 正在加载产品数据，请稍候...</p>}

      {error && (
        <p style={{ color: "red", fontSize: "18px" }}>
          ❌ 加载产品数据出错：{error}
        </p>
      )}

      {!loading && !error && products.length === 0 && (
        <p style={{ color: "orange", fontSize: "18px" }}>⚠ 未获取到任何产品数据</p>
      )}

      {!loading && !error && products.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "20px",
            marginTop: "20px",
          }}
        >
          {products.map((item) => (
            <div
              key={item.id}
              style={{
                border: "1px solid #ccc",
                borderRadius: "10px",
                padding: "10px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                backgroundColor: "#fff",
              }}
            >
              <img
                src={item.imageUrl || "/no-image.png"}
                alt={item.productName || "无图"}
                style={{
                  width: "100%",
                  height: "160px",
                  objectFit: "contain",
                  borderRadius: "8px",
                  marginBottom: "8px",
                }}
              />
              <h3>{item.productName || item.partName || "未命名商品"}</h3>
              <p>品牌：{item.brandName || "未知品牌"}</p>
              <p>型号：{item.model || "未知型号"}</p>
              <p style={{ color: "green", fontWeight: "bold" }}>
                ￥{item.price ?? "未标价"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

