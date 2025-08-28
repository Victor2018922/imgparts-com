"use client";

import { useEffect, useMemo, useState } from "react";

interface Product {
  brand: string;     // 车辆品牌（如 HONDA）
  car: string;       // 车型（如 飞度）
  carCode: string;   // 车系代号
  name: string;      // 产品名称
  num: string;       // 编号
  oe: string;        // OE号
  vin?: string;      // 车架号（如果有）
  pics: string[];    // 图片数组
}

type SearchType = "all" | "name" | "oe" | "car" | "vin";

const PAGE_SIZE = 12;

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  // 过滤条件
  const [keyword, setKeyword] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("all");
  const [brandFilter, setBrandFilter] = useState("");      // 车辆品牌
  const [partBrandFilter, setPartBrandFilter] = useState(""); // 配件品牌（后续若有数据字段可对接）

  // 拉取数据（分页）
  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/stock?size=${PAGE_SIZE}&page=${page}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!ignore) setProducts(json.data || []);
      } catch (err) {
        console.error("加载库存失败", err);
        if (!ignore) setProducts([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchData();
    return () => { ignore = true; };
  }, [page]);

  // 本页内过滤（在已拉取的 products 上做）
  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return (products || []).filter((p) => {
      // 关键词匹配
      const hit =
        !kw ||
        (searchType === "all" &&
          (
            p.name?.toLowerCase().includes(kw) ||
            p.oe?.toLowerCase().includes(kw) ||
            p.car?.toLowerCase().includes(kw) ||
            p.carCode?.toLowerCase().includes(kw) ||
            p.num?.toLowerCase().includes(kw) ||
            p.brand?.toLowerCase().includes(kw) ||
            (p as any).vin?.toLowerCase?.().includes(kw)
          )) ||
        (searchType === "name" && p.name?.toLowerCase().includes(kw)) ||
        (searchType === "oe"   && p.oe?.toLowerCase().includes(kw))   ||
        (searchType === "car"  && (p.car?.toLowerCase().includes(kw) || p.carCode?.toLowerCase().includes(kw))) ||
        (searchType === "vin"  && (p as any).vin?.toLowerCase?.().includes(kw));

      // 车辆品牌筛选
      const hitBrand =
        !brandFilter.trim() ||
        p.brand?.toLowerCase().includes(brandFilter.trim().toLowerCase());

      // 配件品牌筛选（目前接口里暂未见独立字段，先预留）
      const hitPartBrand =
        !partBrandFilter.trim() ||
        false; 

      return hit && hitBrand && (partBrandFilter ? hitPartBrand : true);
    });
  }, [products, keyword, searchType, brandFilter, partBrandFilter]);

  return (
    <div style={{ padding: 20 }}>
      <h1>库存产品列表</h1>

      {/* 搜索与筛选区 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 160px 1fr 1fr 120px",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        {/* 关键词 */}
        <input
          placeholder="输入关键词（名称/OE/车型/VIN）"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ padding: "10px 12px", border: "1px solid #ccc", borderRadius: 8 }}
        />

        {/* 匹配范围 */}
        <select
          value={searchType}
          onChange={(e) => setSearchType(e.target.value as SearchType)}
          style={{ padding: "10px 12px", border: "1px solid #ccc", borderRadius: 8 }}
        >
          <option value="all">全部字段</option>
          <option value="name">仅 产品名称</option>
          <option value="oe">仅 OE号</option>
          <option value="car">仅 车型/车系</option>
          <option value="vin">仅 车架号</option>
        </select>

        {/* 车辆品牌 */}
        <input
          placeholder="车辆品牌（例：HONDA）"
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          style={{ padding: "10px 12px", border: "1px solid #ccc", borderRadius: 8 }}
        />

        {/* 配件品牌（预留，待接口字段对接） */}
        <input
          placeholder="配件品牌（预留）"
          value={partBrandFilter}
          onChange={(e) => setPartBrandFilter(e.target.value)}
          style={{ padding: "10px 12px", border: "1px solid #ccc", borderRadius: 8 }}
        />

        {/* 翻页 */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #ccc", background: "#fff" }}
          >
            上一页
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={loading}
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #ccc", background: "#fff" }}
          >
            下一页
          </button>
        </div>
      </div>

      {/* 列表 */}
      {loading ? (
        <p>正在加载数据...</p>
      ) : filtered.length === 0 ? (
        <p>没有匹配的结果</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {filtered.map((item, idx) => {
            const href = `/stock/${encodeURIComponent(item.num || String(idx))}`;
            return (
              <a
                key={`${item.num}-${idx}`}
                href={href}
                onClick={() => {
                  try {
                    sessionStorage.setItem(
                      `stock:item:${item.num || String(idx)}`,
                      JSON.stringify(item)
                    );
                  } catch {}
                }}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div style={{ border: "1px solid #e5e5e5", padding: 12, borderRadius: 8 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>{item.name}</div>
                  <div style={{ fontSize: 13, color: "#444", lineHeight: 1.6 }}>
                    <div>车辆品牌：{item.brand || "-"}</div>
                    <div>车型/代码：{item.car || "-"}（{item.carCode || "-"}）</div>
                    <div>OE号：{item.oe || "-"}</div>
                    <div>编号：{item.num || "-"}</div>
                  </div>
                  {item.pics?.[0] && (
                    <img
                      src={item.pics[0]}
                      alt={item.name}
                      style={{ width: "100%", height: 160, objectFit: "contain", marginTop: 8, background: "#fafafa" }}
                    />
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}

      {/* 页码展示 */}
      <div style={{ marginTop: 16, color: "#666" }}>当前页：{page + 1}</div>
    </div>
  );
}
