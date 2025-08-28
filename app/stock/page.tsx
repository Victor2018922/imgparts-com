"use client";

import { useEffect, useState } from "react";

interface Product {
  brand: string;
  car: string;
  carCode: string;
  name: string;
  num: string;
  oe: string;
  pics: string[];
}

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/stock?size=10&page=0");
        const json = await res.json();
        setProducts(json.data || []);
      } catch (err) {
        console.error("加载库存失败", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <p>正在加载数据...</p>;

  return (
    <div style={{ padding: "20px" }}>
      <h1>库存产品列表</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
        {products.map((item, idx) => (
          <div key={idx} style={{ border: "1px solid #ccc", padding: "10px", borderRadius: "8px" }}>
            <h3>{item.name}</h3>
            <p>品牌：{item.brand}</p>
            <p>车型：{item.car} ({item.carCode})</p>
            <p>OE号：{item.oe}</p>
            <p>编号：{item.num}</p>
            {item.pics?.[0] && (
              <img src={item.pics[0]} alt={item.name} style={{ width: "100%", height: "auto" }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
