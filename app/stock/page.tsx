"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Item = {
  num: string;
  product: string;
  oe: string;
  brand: string; // 外部 car
  model: string; // 外部 carCode
  year?: string; // 暂无
  image?: string;
};

type FetchState = "idle" | "loading" | "ok" | "error";

export default function StockPage() {
  // 筛选条件
  const [brand, setBrand] = useState<string>("");
  const [model, setModel] = useState<string>("");

  // 分页
  const [size, setSize] = useState<number>(20);
  const [page, setPage] = useState<number>(0);

  // 数据
  const [items, setItems] = useState<Item[]>([]);
  const [allForOptions, setAllForOptions] = useState<Item[]>([]); // 用于生成下拉选项
  const [state, setState] = useState<FetchState>("idle");
  const [errMsg, setErrMsg] = useState<string>("");

  // 初始化拉一页数据用于生成下拉选项（只拉一次）
  useEffect(() => {
    let aborted = false;
    async function bootstrap() {
      try {
        const url = `/api/stock/item?size=200&page=0`; // 一次拿到足够多的样本
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arr: Item[] = await res.json();
        if (!aborted) setAllForOptions(arr || []);
      } catch (e: any) {
        // 静默：选项拉不到也不影响主查询
        console.warn("bootstrap options failed:", e?.message || e);
      }
    }
    bootstrap();
    return () => {
      aborted = true;
    };
  }, []);

  // 根据 brand / model / 分页 拉取实际展示数据
  useEffect(() => {
    let aborted = false;
    async function run() {
      setState("loading");
      setErrMsg("");
      try {
        const qs = new URLSearchParams();
        qs.set("size", String(size));
        qs.set("page", String(page));
        if (brand) qs.set("brand", brand);
        if (model) qs.set("model", model);
        const url = `/api/stock/item?${qs.toString()}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arr: Item[] = await res.json();
        if (aborted) return;
        setItems(arr || []);
        setState("ok");
      } catch (e: any) {
        if (aborted) return;
        setState("error");
        setErrMsg(e?.message || String(e));
      }
    }
    run();
    return () => {
      aborted = true;
    };
  }, [brand, model, size, page]);

  // 从 allForOptions 计算下拉选项
  const brandOptions = useMemo(() => {
    const s = new Set<string>();
    allForOptions.forEach(it => {
      const val = (it.brand || "").trim();
      if (val) s.add(val);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [allForOptions]);

  const modelOptions = useMemo(() => {
    // 只有选了 brand 才筛对应的 model；否则给出全量 model 供搜索
    const s = new Set<string>();
    allForOptions.forEach(it => {
      const b = (it.brand || "").trim();
      const m = (it.model || "").trim();
      if (!m) return;
      if (!brand || b.toLowerCase() === brand.toLowerCase()) {
        s.add(m);
      }
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [allForOptions, brand]);

  // 翻页控制
  const canPrev = page > 0;
  const goPrev = () => setPage(p => Math.max(0, p - 1));
  const goNext = () => setPage(p => p + 1);

  // 当切换 brand 时，自动清空 model，并回到第 0 页
  useEffect(() => {
    setModel("");
    setPage(0);
  }, [brand]);

  // 当切换 model 或 size 时，回到第 0 页
  useEffect(() => {
    setPage(0);
  }, [model, size]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-semibold mb-4">库存预览</h1>

      {/* 筛选栏 */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
        {/* Brand（车厂） */}
        <div className="flex flex-col">
          <label className="text-sm mb-1">Brand（车厂）</label>
          <select
            className="border rounded px-2 py-2"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          >
            <option value="">全部</option>
            {brandOptions.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* Model（车型/年款段） */}
        <div className="flex flex-col">
          <label className="text-sm mb-1">Model（车型/年款段）</label>
          <select
            className="border rounded px-2 py-2"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            <option value="">全部</option>
            {modelOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Year（暂无外部字段，先只展示占位） */}
        <div className="flex flex-col">
          <label className="text-sm mb-1">Year（年款）</label>
          <select className="border rounded px-2 py-2" disabled>
            <option>外部暂无年款字段</option>
          </select>
        </div>

        {/* 每页数量 */}
        <div className="flex flex-col">
          <label className="text-sm mb-1">每页数量</label>
          <select
            className="border rounded px-2 py-2"
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          >
            {[10, 20, 30, 50, 100, 200].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 状态区 */}
      {state === "loading" && (
        <div className="py-4 text-gray-500">加载中…</div>
      )}
      {state === "error" && (
        <div className="py-4 text-red-600">加载失败：{errMsg}</div>
      )}

      {/* 列表区 */}
      {state === "ok" && (
        <>
          {items.length === 0 ? (
            <div className="py-8 text-gray-500">没有数据（可尝试切换筛选/翻页/增大每页数量）。</div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((it) => (
                <li key={it.num} className="border rounded-lg p-3 hover:shadow">
                  <Link href={`/stock/${encodeURIComponent(it.num)}`} className="block">
                    <div className="w-full aspect-[4/3] bg-gray-100 mb-2 overflow-hidden rounded">
                      {/* 缩略图（取后端映射的 image） */}
                      {it.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.image}
                          alt={it.product || it.num}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          No Image
                        </div>
                      )}
                    </div>
                    <div className="font-medium truncate" title={it.product}>{it.product || "-"}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      <div>SKU/Num：{it.num}</div>
                      <div>OE：{it.oe || "-"}</div>
                      <div>Brand：{it.brand || "-"}</div>
                      <div>Model：{it.model || "-"}</div>
                    </div>
                    <div className="mt-2 text-blue-600 hover:underline text-sm">查看详情 →</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* 翻页条 */}
          <div className="flex items-center gap-3 mt-6">
            <button
              className="px-3 py-2 border rounded disabled:opacity-50"
              onClick={goPrev}
              disabled={!canPrev}
            >
              上一页
            </button>
            <span className="text-sm">第 <b>{page + 1}</b> 页</span>
            <button
              className="px-3 py-2 border rounded"
              onClick={goNext}
            >
              下一页
            </button>
          </div>
        </>
      )}
    </div>
  );
}
