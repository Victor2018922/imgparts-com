"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

// ---------- 类型 ----------
type StockItem = {
  brand?: string;
  car?: string;
  carCode?: string;
  count?: number;
  name?: string;
  num: string;
  oe?: string;
  pics?: string[];
  price?: number;
  specs?: string;
  tradePrice?: number;
  weight?: string;
  image?: string; // 有些记录仅给一个主图
};

type ApiResp =
  | { data?: StockItem[] | StockItem; status?: string }
  | StockItem
  | StockItem[];

// ---------- 小工具 ----------
const fmtPrice = (n?: number) =>
  typeof n === "number" && !Number.isNaN(n) ? n.toFixed(2) : "N/A";

const firstNonEmpty = (...arr: (string | undefined)[]) =>
  arr.find((x) => !!x && x.trim().length > 0) || "—";

const unique = (arr: string[]) => Array.from(new Set(arr));

// ---------- 本页组件 ----------
export default function StockDetailPage() {
  const { num } = useParams<{ num: string }>();
  const router = useRouter();

  const [item, setItem] = useState<StockItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // 图集
  const pics = useMemo(() => {
    const p = unique(
      [
        ...(item?.pics || []),
        ...(item?.image ? [item.image] : []), // 有些接口只给 image
      ].filter(Boolean) as string[]
    );
    return p;
  }, [item]);

  // 当前大图索引
  const [idx, setIdx] = useState(0);

  // 灯箱
  const [openLightbox, setOpenLightbox] = useState(false);
  const lightboxRef = useRef<HTMLDivElement | null>(null);

  // 缩略图滚动
  const thumbsRef = useRef<HTMLDivElement | null>(null);

  // 轻提示
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1400);
  }, []);

  // ---------- 拉取详情（先尝试站内 API，再降级） ----------
  useEffect(() => {
    let abort = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        // 顺序尝试多个可能存在的站内 API（不改你现有后端就能兼容）
        const tryUrls = [
          `/api/stock/item?num=${encodeURIComponent(num)}`,
          `/api/stock/detail?num=${encodeURIComponent(num)}`,
          `/api/stock/by-num?num=${encodeURIComponent(num)}`,
        ];

        let record: StockItem | null = null;

        for (const u of tryUrls) {
          try {
            const r = await fetch(u, { cache: "no-store" });
            if (!r.ok) continue;
            const j: ApiResp = await r.json();

            // 兼容不同返回形态
            if (Array.isArray(j)) {
              const found = j.find((x) => x.num === num);
              if (found) record = found;
            } else if ("data" in (j as any)) {
              const d = (j as any).data;
              if (Array.isArray(d)) {
                record = d.find((x: StockItem) => x.num === num) ?? d[0];
              } else if (d && typeof d === "object") {
                record = d as StockItem;
              }
            } else if (j && typeof j === "object" && "num" in j) {
              record = j as StockItem;
            }

            if (record) break;
          } catch {
            // 下一条
          }
        }

        // 兜底：如果站内 API 都没命中，就不再扫大列表，直接让页面提示“暂无图片”等，不影响已运行环境
        if (!record) {
          throw new Error("未从站内 API 获取到该商品的数据");
        }

        if (!abort) {
          setItem(record);
          setIdx(0);
        }
      } catch (e: any) {
        if (!abort) setErr(e?.message || "加载失败");
      } finally {
        if (!abort) setLoading(false);
      }
    }

    load();
    return () => {
      abort = true;
    };
  }, [num]);

  // ---------- 交互：复制 OE ----------
  const onCopyOE = useCallback(async () => {
    const text = item?.oe || "";
    try {
      if (text) {
        await navigator.clipboard.writeText(text);
        showToast("OE 已复制");
      }
    } catch {
      showToast("复制失败");
    }
  }, [item, showToast]);

  // ---------- 交互：加入询价单（localStorage） ----------
  const onAddInquiry = useCallback(() => {
    if (!item) return;

    const key = "inq_items";
    const raw = localStorage.getItem(key);
    let arr: any[] = [];
    try {
      arr = raw ? JSON.parse(raw) : [];
    } catch {
      arr = [];
    }

    const cover = pics[0] || item.image || "";

    const existing = arr.find((x) => x.num === item.num);
    if (existing) {
      existing.qty = Math.min((existing.qty || 1) + 1, 9999);
    } else {
      arr.push({
        num: item.num,
        name: item.name,
        brand: item.brand,
        price: item.price ?? 0,
        oe: item.oe,
        cover,
        qty: 1,
      });
    }

    localStorage.setItem(key, JSON.stringify(arr));
    showToast("已加入询价单");
  }, [item, pics, showToast]);

  // ---------- 灯箱：键盘 & 触摸 ----------
  useEffect(() => {
    if (!openLightbox) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenLightbox(false);
      if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + pics.length) % pics.length);
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % pics.length);
    };
    window.addEventListener("keydown", onKey);

    // 触摸滑动
    let startX = 0;
    let endX = 0;
    const el = lightboxRef.current;
    const onTouchStart = (ev: TouchEvent) => {
      startX = ev.touches[0].clientX;
    };
    const onTouchEnd = (ev: TouchEvent) => {
      endX = ev.changedTouches[0].clientX;
      const dx = endX - startX;
      if (Math.abs(dx) > 50) {
        if (dx > 0) setIdx((i) => (i - 1 + pics.length) % pics.length);
        else setIdx((i) => (i + 1) % pics.length);
      }
    };
    el?.addEventListener("touchstart", onTouchStart);
    el?.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("keydown", onKey);
      el?.removeEventListener("touchstart", onTouchStart);
      el?.removeEventListener("touchend", onTouchEnd);
    };
  }, [openLightbox, pics.length]);

  // ---------- 缩略图滚动按钮可用状态 ----------
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateThumbArrows = useCallback(() => {
    const el = thumbsRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 0);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = thumbsRef.current;
    if (!el) return;
    updateThumbArrows();
    const onScroll = () => updateThumbArrows();
    el.addEventListener("scroll", onScroll);
    const r = new ResizeObserver(updateThumbArrows);
    r.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      r.disconnect();
    };
  }, [updateThumbArrows]);

  const scrollThumbs = (dir: "left" | "right") => {
    const el = thumbsRef.current;
    if (!el) return;
    const delta = el.clientWidth * 0.9 * (dir === "left" ? -1 : 1);
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  // ---------- 渲染 ----------
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="animate-pulse h-8 w-48 rounded bg-gray-200 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="aspect-video rounded bg-gray-200" />
          <div className="space-y-3">
            <div className="h-6 bg-gray-200 rounded w-3/4" />
            <div className="h-6 bg-gray-200 rounded w-2/3" />
            <div className="h-6 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (err || !item) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-lg text-red-600 font-medium">加载失败</p>
        <p className="text-sm text-gray-500 mt-2">{err || "未找到该商品"}</p>
        <div className="mt-6">
          <Link
            href="/stock"
            className="inline-flex items-center rounded-md border px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            ← 返回列表
          </Link>
        </div>
      </div>
    );
  }

  const title = firstNonEmpty(item.name);
  const brand = firstNonEmpty(item.brand);
  const model = firstNonEmpty(item.carCode);
  const year = firstNonEmpty(item.car);
  const price = fmtPrice(item.price);
  const stockText = typeof item.count === "number" ? String(item.count) : "N/A";

  const mainSrc = pics[idx];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* 面包屑 */}
      <nav className="text-sm text-gray-500 mb-4 space-x-1">
        <Link href="/" className="hover:underline">首页</Link>
        <span> / </span>
        <Link href="/stock" className="hover:underline">库存预览</Link>
        <span> / </span>
        <span className="text-gray-700">商品详情</span>
      </nav>

      <h1 className="text-xl font-semibold mb-4">Product Detail</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 左：图片 */}
        <div>
          <div className="relative rounded-lg border bg-white">
            {mainSrc ? (
              // 用 <img>，避免 next/image 的域名配置
              <img
                src={mainSrc}
                alt={title}
                className="w-full h-auto object-contain cursor-zoom-in select-none"
                onClick={() => setOpenLightbox(true)}
              />
            ) : (
              <div className="aspect-video flex items-center justify-center text-gray-400">
                （暂无可识别的图片链接）
              </div>
            )}
          </div>

          {/* 缩略图条 */}
          {pics.length > 0 && (
            <div className="mt-3">
              <div className="relative">
                {/* 左/右按钮 */}
                {canLeft && (
                  <button
                    type="button"
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 rounded-full border bg-white/90 shadow px-2 py-1"
                    onClick={() => scrollThumbs("left")}
                    aria-label="向左"
                  >
                    ◀
                  </button>
                )}
                {canRight && (
                  <button
                    type="button"
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 rounded-full border bg-white/90 shadow px-2 py-1"
                    onClick={() => scrollThumbs("right")}
                    aria-label="向右"
                  >
                    ▶
                  </button>
                )}

                <div
                  ref={thumbsRef}
                  className="flex gap-2 overflow-x-auto scroll-smooth px-8"
                  onScroll={updateThumbArrows}
                >
                  {pics.map((src, i) => (
                    <button
                      key={`${src}-${i}`}
                      type="button"
                      className={`shrink-0 border rounded-md overflow-hidden ${
                        i === idx ? "ring-2 ring-emerald-500" : "hover:border-gray-400"
                      }`}
                      onClick={() => setIdx(i)}
                    >
                      <img
                        src={src}
                        alt={`thumb-${i}`}
                        className="h-20 w-28 object-cover"
                        draggable={false}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 右：信息 */}
        <div>
          <div className="text-sm text-gray-500">Num: {item.num}</div>
          <h2 className="mt-1 text-2xl font-semibold">{title}</h2>

          <dl className="mt-4 space-y-1 text-gray-700">
            <div className="flex gap-2">
              <dt className="w-16 text-gray-500">Brand:</dt>
              <dd>{brand}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 text-gray-500">Model:</dt>
              <dd>{model}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 text-gray-500">Year:</dt>
              <dd>{year}</dd>
            </div>
            <div className="flex gap-2 items-center">
              <dt className="w-16 text-gray-500">OE:</dt>
              <dd className="break-all">
                {item.oe || "—"}
                {item.oe && (
                  <button
                    type="button"
                    onClick={onCopyOE}
                    className="ml-2 inline-flex items-center rounded border px-2 py-0.5 text-xs hover:bg-gray-50"
                    title="复制 OE"
                  >
                    复制 OE
                  </button>
                )}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 text-gray-500">Price:</dt>
              <dd className="text-emerald-600 font-semibold">${price}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 text-gray-500">Stock:</dt>
              <dd>{stockText}</dd>
            </div>
          </dl>

          {/* 操作按钮 */}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/stock"
              className="inline-flex items-center rounded-md border px-4 py-2 hover:bg-gray-50"
            >
              ← 返回列表
            </Link>

            {/* 上一条 / 下一条（保持按钮位置，逻辑视你现有实现，此处只做占位跳转回列表） */}
            <button
              type="button"
              className="inline-flex items-center rounded-md border px-4 py-2 hover:bg-gray-50"
              onClick={() => router.back()}
            >
              上一条
            </button>
            <Link
              href="/stock"
              className="inline-flex items-center rounded-md border px-4 py-2 hover:bg-gray-50"
            >
              下一条
            </Link>

            {/* 新增：加入询价单 */}
            <button
              id="add-inquiry"
              type="button"
              className="inline-flex items-center px-4 py-2 rounded-md border bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={onAddInquiry}
            >
              加入询价单
            </button>

            {/* 可选：查看询价单（如果你已有 /inquiry 页面） */}
            <Link
              href="/inquiry"
              className="inline-flex items-center rounded-md border px-4 py-2 hover:bg-gray-50"
            >
              查看询价单
            </Link>
          </div>

          <p className="mt-6 text-xs text-gray-400">
            数据源：niuniuparts.com（测试预览用途）
          </p>
        </div>
      </div>

      {/* 规格参数（保持简洁，展示核心字段） */}
      <section className="mt-10">
        <h3 className="text-lg font-semibold mb-3">产品参数</h3>
        <div className="rounded-lg border divide-y">
          <Row label="商品编号 (Num)" value={item.num} />
          <Row label="品牌 (Brand)" value={brand} />
          <Row label="适配车型 (Model)" value={model} />
          <Row label="价格 (Price)" value={`$${price}`} />
          <Row label="库存 (Stock)" value={stockText} />
        </div>
      </section>

      {/* 轻提示 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-md bg-gray-900 text-white px-4 py-2 shadow">
          {toast}
        </div>
      )}

      {/* 灯箱 */}
      {openLightbox && pics.length > 0 && (
        <div
          ref={lightboxRef}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setOpenLightbox(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white text-2xl"
            onClick={() => setOpenLightbox(false)}
            aria-label="关闭"
          >
            ✕
          </button>

          {/* 上一张 / 下一张 */}
          <button
            type="button"
            className="absolute left-3 md:left-6 text-white text-3xl"
            onClick={(e) => {
              e.stopPropagation();
              setIdx((i) => (i - 1 + pics.length) % pics.length);
            }}
            aria-label="上一张"
          >
            ◀
          </button>
          <button
            type="button"
            className="absolute right-3 md:right-6 text-white text-3xl"
            onClick={(e) => {
              e.stopPropagation();
              setIdx((i) => (i + 1) % pics.length);
            }}
            aria-label="下一张"
          >
            ▶
          </button>

          <img
            src={pics[idx]}
            alt={`${title}-${idx}`}
            className="max-h-[88vh] max-w-[92vw] object-contain select-none"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// 行组件
function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 md:grid-cols-6">
      <div className="col-span-1 bg-gray-50 px-4 py-2 text-sm text-gray-500">{label}</div>
      <div className="col-span-2 md:col-span-5 px-4 py-2 text-sm text-gray-800 break-all">
        {value || "—"}
      </div>
    </div>
  );
}
