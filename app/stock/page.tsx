"use client";

import React, { useEffect, useState } from "react";

interface Product {
  id: number;
  productName?: string;
  partName?: string;
  brandName?: string;
  price?: number;
  stockQty?: number;
  imageUrl?: string;
}

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(
          "https://niuniuparts.com:6001/scm-product/v1/stock2?size=20&page=0"
        );
        const data = await res.json();
        setProducts(data.content || []);
      } catch (error) {
        console.error("❌ 数据加载失败:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleAddToCart = (item: Product) => {
    alert(`✅ 已加入购物车：${item.productName || item.partName || "未命名商品"}`);
  };

  const handleCheckout = () => {
    alert("🛒 去结算：功能连接正常（尚未跳转实现）");
  };

  const handleViewDetail = (item: Product) => {
    alert(`🔍 查看详情：${item.productName || item.partName}`);
  };

  return (
    <main
      style={{
        fontFamily: "Microsoft YaHei, sans-serif",
        padding: "40px",
        backgroundColor: "#f9f9f9",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ textAlign: "center", color: "green", fontSize: "28px" }}>
        ✅ ImgParts 库存页正常运行中
      </h1>

      {loading ? (
        <p style={{ textAlign: "center", marginTop: "40px" }}>数据加载中...</p>
      ) : products.length === 0 ? (
        <p style={{ textAlign: "center", marginTop: "40px", color: "red" }}>
          ⚠️ 未获取到任何产品数据
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: "20px",
            marginTop: "30px",
          }}
        >
          {products.map((item) => (
            <div
              key={item.id}
              style={{
                background: "#fff",
                borderRadius: "10px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                padding: "20px",
                textAlign: "center",
              }}
            >
              <img
                src={item.imageUrl || "/no-image.png"}
                alt={item.productName || "暂无图片"}
                style={{
                  width: "100%",
                  height: "160px",
                  objectFit: "contain",
                  marginBottom: "10px",
                }}
              />
              <h3 style={{ fontSize: "18px", marginBottom: "6px" }}>
                {item.productName || item.partName || "未命名商品"}
              </h3>
              <p style={{ color: "#666", fontSize: "14px" }}>
                品牌：{item.brandName || "未知"}
              </p>
              <p style={{ color: "#333", fontWeight: "bold" }}>
                库存：{item.stockQty || 0}
              </p>
              <p style={{ color: "green", fontWeight: "bold" }}>
                ￥{item.price || 0}
              </p>

              <div style={{ marginTop: "10px" }}>
                <button
                  onClick={() => handleAddToCart(item)}
                  style={{
                    margin: "5px",
                    padding: "6px 12px",
                    background: "#007bff",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  加入购物车
                </button>
                <button
                  onClick={() => handleCheckout()}
                  style={{
                    margin: "5px",
                    padding: "6px 12px",
                    background: "#28a745",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  去结算
                </button>
                <button
                  onClick={() => handleViewDetail(item)}
                  style={{
                    margin: "5px",
                    padding: "6px 12px",
                    background: "#17a2b8",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  查看详情
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

