// temp change - just to trigger git
"use client";

import { useEffect, useMemo, useState } from "react";

type StockItem = {
  num: string;
  product: string;
  oe: string;
  brand: string;
  model: string;
  year: string;
};

export default function StockPage() {
  const [allItems, setAllItems] = useState<StockItem[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [brand, setBrand] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [initLoading, setInitLoading] = useState<boolean>(true);

  // 首次加载：取全量，用于生成下拉选项
  useEffect(() => {
    (async () => {
      try {
        setInitLoading(true);
        const res = await fetch("/api/stock/item", { cache: "no-store" });
        const data: StockItem[] = await res.json();
        setAllItems(data);
        setItems(data);
      } finally {
        setInitLoading(false);
      }
    })();
  }, []);

  // 条件变化：调用后端筛选
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (brand) params.set("brand", brand);
        if (model) params.set("model", model);
        if (year) params.set("year", year);
        const url = `/api/stock/item${params.toString() ? `?${params.toString()}` : ""}`;
        const res = await fetch(url, { cache: "no-store" });
        const data: StockItem[] = await res.json();
        setItems(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [brand, model, year]);

  // 选项动态 & 级联
  const brandOptions = useMemo(() => {
    const set = new Set(allItems.map((i) => i.brand).filter(Boolean));
    return Array.from(set).sort();
  }, [allItems]);

  const modelOptions = useMemo(() => {
    const filtered = brand ? allItems.filter((i) => i.brand === brand) : allItems;
    const set = new Set(filtered.map((i) => i.model).filter(Boolean));
    return Array.from(set).sort();
  }, [allItems, brand]);

  const yearOptions = useMemo(() => {
    let filtered = allItems;
    if (brand) filtered = filtered.filter((i) => i.brand === brand);
    if (model) filtered = filtered.filter((i) => i.model === model);
    const set = new Set(filtered.map((i) => i.year).filter(Boolean));
    return Array.from(set).sort();
  }, [allItems, brand, model]);

  const onBrandChange = (v: string) => {
    setBrand(v);
    setModel("");
    setYear("");
  };
  const onModelChange = (v: string) => {
    setModel(v);
    setYear("");
  };
  const onYearChange = (v: string) => setYear(v);
  const onClear = () => {
    setBrand("");
    setModel("");
    setYear("");
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Stock</h1>

      {/* 筛选控件 */}
      <div className="flex flex-col md:flex-row gap-3 md:gap-4 mb-4">
        <select
          value={brand}
          onChange={(e) => onBrandChange(e.target.value)}
          className="border rounded px-3 py-2 min-w-[200px]"
          disabled={initLoading || brandOptions.length === 0}
          aria-label="Brand"
        >
          <option value="">All Brands</option>
          {brandOptions.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        <select
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          className="border rounded px-3 py-2 min-w-[200px]"
          disabled={initLoading || modelOptions.length === 0}
          aria-label="Model"
        >
          <option value="">All Models</option>
          {modelOptions.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <select
          value={year}
          onChange={(e) => onYearChange(e.target.value)}
          className="border rounded px-3 py-2 min-w-[160px]"
          disabled={initLoading || yearOptions.length === 0}
          aria-label="Year"
        >
          <option value="">All Years</option>
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <button
          onClick={onClear}
          className="border rounded px-3 py-2 md:ml-2"
          disabled={initLoading && loading}
          aria-label="Clear filters"
        >
          Clear
        </button>
      </div>

      {(initLoading || loading) && (
        <div className="text-sm text-gray-500 mb-2">
          {initLoading ? "Loading initial data..." : "Filtering..."}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((item) => (
          <div key={item.num} className="border p-4 rounded">
            <h3 className="font-bold text-base mb-1">{item.product}</h3>
            <p className="text-sm">OE: {item.oe}</p>
            <p className="text-sm">Brand: {item.brand}</p>
            <p className="text-sm">Model: {item.model}</p>
            <p className="text-sm">Year: {item.year}</p>
          </div>
        ))}
      </div>

      {!initLoading && !loading && items.length === 0 && (
        <div className="text-sm text-gray-500 mt-4">No items found.</div>
      )}
    </div>
  );
}
