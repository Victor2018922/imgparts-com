'use client';

import React, { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

/* ================= 常量 & 类型 ================= */
const API_BASE = 'https://niuniuparts.com:6001/scm-product/v1/stock2';
const BASE_ORIGIN = new URL(API_BASE).origin;
const PAGE_SIZE = 20;

type ApiItem = {
  num?: string;
  product?: string;
  name?: string;
  title?: string;
  oe?: string;
  brand?: string;
  model?: string;
  year?: string;
  [k: string]: any;
};

type CardItem = {
  num?: string;
  product: string;
  oe?: string;
  brand?: string;
  model?: string;
  year?: string;
  image?: string | null;
  raw: any;
};

type CartItem = {
  key: string;
  num?: string;
  product: string;
  oe?: string;
  brand?: string;
  model?: string;
  year?: string;
  qty: number;
  image?: string | null;
};

type TradeMode = 'B2C' | 'B2B';

const FALLBACK_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-size="12">No Image</text>
    </svg>`
  );

/* ================= 工具函数 ================= */
function extractArray(js: any): any[] {
  if (Array.isArray(js)) return js;
  const cand =
    js?.content ??
    js?.data?.content ??
    js?.data?.records ??
    js?.data?.list ??
    js?.data ??
    js?.records ??
    js?.list ??
    null;
  return Array.isArray(cand) ? cand : [];
}

function extractFirstUrl(s: string): string | null {
  if (!s || typeof s !== 'string') return null;
  const m1 = s.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m1?.[1]) return m1[1];
  const m2 = s.match(/https?:\/\/[^\s"'<>\\)]+/i);
  if (m2?.[0]) return m2[0];
  const m3 = s.match(/(^|[^:])\/\/[^\s"'<>\\)]+/i);
  if (m3) {
    const raw = m3[0];
    const hit = raw.slice(raw.indexOf('//'));
    if (hit.startsWith('//')) return hit;
  }
  const m4 = s.match(/\/[^\s"'<>\\)]+/);
  if (m4?.[0]) return m4[0];
  return null;
}
function isImgUrl(s: string): boolean {
  if (!s || typeof s !== 'string') return false;
  const v = s.trim();
  if (/^https?:\/\//i.test(v) || v.startsWith('//') || v.startsWith('/')) return true;
  if (/\.(png|jpe?g|webp|gif|bmp|svg|jfif|avif)(\?|#|$)/i.test(v)) return true;
  if (/\/(upload|image|images|img|media|file|files)\//i.test(v)) return true;
  if (/[?&](file|img|image|pic|path)=/i.test(v)) return true;
  return false;
}
function absolutize(u: string | null): string | null {
  if (!u) return null;
  let s = u.trim();
  if (!s) return null;
  if (s.startsWith('data:image')) return s;
  if (s.startsWith('//')) return 'http:' + s;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/')) return BASE_ORIGIN + s;
  return BASE_ORIGIN + '/' + s.replace(/^\.\//, '');
}
function toProxy(u: string): string {
  const clean = u.replace(/^https?:\/\//i, '');
  return `https://images.weserv.nl/?url=${encodeURIComponent(clean)}`;
}
function deepFindImage(obj: any, depth = 0): string | null {
  if (!obj || depth > 4) return null;
  if (typeof obj === 'string') {
    const url = extractFirstUrl(obj) || obj;
    return url && isImgUrl(url) ? url : null;
  }
  if (Array.isArray(obj)) {
    for (const it of obj) {
      const hit = deepFindImage(it, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof obj === 'object') {
    const FIELDS = [
      'image','imgUrl','img_url','imageUrl','image_url','picture','pic','picUrl','pic_url','thumbnail','thumb','url','path','src',
      'images','pictures','pics','photos','gallery','media','attachments','content','html','desc','description'
    ];
    for (const k of FIELDS) {
      if (k in obj) {
        const hit = deepFindImage(obj[k], depth + 1);
        if (hit) return hit;
      }
    }
    for (const k of Object.keys(obj)) {
      const hit = deepFindImage(obj[k], depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}
function pickImage(x: any): string {
  const raw = deepFindImage(x);
  const abs = absolutize(raw);
  if (!abs) return FALLBACK_IMG;
  return abs.startsWith('http://') ? toProxy(abs) : abs;
}
function encodeItemForUrl(item: any): string {
  const compact = {
    num: item?.num,
    product: item?.product ?? item?.name ?? item?.title,
    oe: item?.oe,
    brand: item?.brand,
    model: item?.model,
    year: item?.year,
    image: deepFindImage(item) ?? null,
  };
  const json = JSON.stringify(compact);
  // @ts-ignore
  return encodeURIComponent(btoa(unescape(encodeURIComponent(json))));
}
const normalize = (s?: string | null) => (s ?? '').toString().trim();

/* ============== 本地存储 ============== */
function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const v = localStorage.getItem('cart') || '[]';
    const arr = JSON.parse(v);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveCart(v: CartItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('cart', JSON.stringify(v));
}
function loadMode(): TradeMode {
  if (typeof window === 'undefined') return 'B2C';
  const v = localStorage.getItem('tradeMode') as TradeMode | null;
  return v === 'B2B' ? 'B2B' : 'B2C';
}
function saveMode(v: TradeMode) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('tradeMode', v);
}

/* ============== 页面外壳 (Suspense) ============== */
export default function StockPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">加载中…</div>}>
      <StockInner />
    </Suspense>
  );
}

/* ============== 主体 ============== */
function StockInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL 参数
  const checkoutParam = searchParams?.get('checkout');
  const urlQ = searchParams?.get('q') ?? '';
  const urlBrand = searchParams?.get('brand') ?? '';
  const urlModel = searchParams?.get('model') ?? '';
  const urlYear = searchParams?.get('year') ?? '';

  // 顶部状态
  const [mode, setMode] = useState<TradeMode>('B2C');
  const [q, setQ] = useState(urlQ);
  const [brandFilter, setBrandFilter] = useState(urlBrand);
  const [modelFilter, setModelFilter] = useState(urlModel);
  const [yearFilter, setYearFilter] = useState(urlYear);

  // 数据/分页
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<CardItem[]>([]);
  const [hasMore, setHasMore] = useState(true);

  // 购物车
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const cartCount = useMemo(() => cart.reduce((s, it) => s + it.qty, 0), [cart]);

  // 迷你购物车下拉
  const [miniOpen, setMiniOpen] = useState(false);
  const miniRef = useRef<HTMLDivElement | null>(null);

  // 轻提示
  const [toast, setToast] = useState<string | null>(null);

  // 结算表单
  const [form, setForm] = useState({
    company: '',
    taxId: '',
    contact: '',
    phone: '',
    email: '',
    country: '',
    city: '',
    address: '',
    postcode: '',
  });

  /* 初始化 */
  useEffect(() => {
    setMode(loadMode());
    setCart(loadCart());
  }, []);
  useEffect(() => {
    if (checkoutParam === '1') setCartOpen(true);
  }, [checkoutParam]);

  /* 拉一页（首屏 & 加载更多） */
  const loadPage = async (p: number) => {
    if (loading) return;
    setLoading(true);
    try {
      const url = `${API_BASE}?size=${PAGE_SIZE}&page=${p}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const js = await res.json();
      const arr = extractArray(js);

      const mapped: CardItem[] = arr.map((x: ApiItem) => ({
        num: x.num,
        product: x.product ?? x.name ?? x.title ?? 'IMG',
        oe: x.oe,
        brand: normalize(x.brand),
        model: normalize(x.model),
        year: normalize(x.year),
        image: pickImage(x),
        raw: x,
      }));

      setItems((prev) => (p === 0 ? mapped : [...prev, ...mapped]));
      setHasMore(arr.length === PAGE_SIZE);
      setPage(p + 1);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  // 首屏
  useEffect(() => {
    setItems([]);
    setPage(0);
    setHasMore(true);
    loadPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* URL 写回（便于分享 / 回访） */
  const syncUrl = (next: { q?: string; brand?: string; model?: string; year?: string }) => {
    const sp = new URLSearchParams(searchParams?.toString() ?? '');
    if (next.q !== undefined) next.q ? sp.set('q', next.q) : sp.delete('q');
    if (next.brand !== undefined) next.brand ? sp.set('brand', next.brand) : sp.delete('brand');
    if (next.model !== undefined) next.model ? sp.set('model', next.model) : sp.delete('model');
    if (next.year !== undefined) next.year ? sp.set('year', next.year) : sp.delete('year');
    router.replace(`?${sp.toString()}`);
  };

  /* 选项列表（与已选项联动） */
  const brandOptions = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      const b = normalize(it.brand);
      if (b) set.add(b);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const modelOptions = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (brandFilter && normalize(it.brand) !== normalize(brandFilter)) continue;
      const m = normalize(it.model);
      if (m) set.add(m);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items, brandFilter]);

  const yearOptions = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (brandFilter && normalize(it.brand) !== normalize(brandFilter)) continue;
      if (modelFilter && normalize(it.model) !== normalize(modelFilter)) continue;
      const y = normalize(it.year);
      if (y) set.add(y);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items, brandFilter, modelFilter]);

  /* 过滤（搜索 + 三级筛选） */
  const filtered = useMemo(() => {
    const key = normalize(q).toLowerCase();
    return items.filter((it) => {
      if (brandFilter && normalize(it.brand) !== normalize(brandFilter)) return false;
      if (modelFilter && normalize(it.model) !== normalize(modelFilter)) return false;
      if (yearFilter && normalize(it.year) !== normalize(yearFilter)) return false;
      if (!key) return true;
      const text = [it.product, it.oe, it.brand, it.model, it.year, it.num]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(key);
    });
  }, [items, q, brandFilter, modelFilter, yearFilter]);

  /* 购物车操作（通用） */
  const openCheckout = () => { setMiniOpen(false); setCartOpen(true); };
  const closeCheckout = () => setCartOpen(false);
  const dec = (k: string) => setCart((prev) => prev.map((it) => (it.key === k ? { ...it, qty: Math.max(1, it.qty - 1) } : it)));
  const inc = (k: string) => setCart((prev) => prev.map((it) => (it.key === k ? { ...it, qty: it.qty + 1 } : it)));
  const rm = (k: string) => setCart((prev) => prev.filter((it) => it.key !== k));
  const clearCart = () => setCart([]);

  useEffect(() => { saveCart(cart); }, [cart]);

  /* 模式切换 */
  const setTradeMode = (m: TradeMode) => { setMode(m); saveMode(m); };

  /* 提交（演示） */
  const submitOrder = () => {
    if (!form.email.trim()) { alert('请填写邮箱（必填）'); return; }
    if (mode === 'B2B' && !form.company.trim()) { alert('公司名称为必填项（B2B）'); return; }
    const payload = { mode, cart, form };
    console.log('提交订单（演示）:', payload);
    alert('订单已提交（演示提交）。我们将尽快与您联系！');
    setCart([]);
    setCartOpen(false);
  };

  /* 快捷加入购物车（列表卡片） */
  const quickAdd = (ci: CardItem) => {
    const key = `${ci.num || ''}|${ci.oe || ''}|${Date.now()}`;
    const next: CartItem = {
      key,
      num: ci.num,
      product: ci.product,
      oe: ci.oe,
      brand: ci.brand,
      model: ci.model,
      year: ci.year,
      qty: 1,
      image: ci.image || null,
    };
    setCart((prev) => [...prev, next]);
    setToast(`已加入：${ci.product}`);
    setTimeout(() => setToast(null), 1200);
  };

  /* 迷你购物车下拉：点击外部关闭 */
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!miniRef.current) return;
      if (!miniRef.current.contains(e.target as Node)) setMiniOpen(false);
    };
    if (miniOpen) document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [miniOpen]);

  /* 清除筛选（确保已定义） */
  const clearOne = (k: 'brand' | 'model' | 'year') => {
    if (k === 'brand') {
      setBrandFilter('');
      setModelFilter('');
      setYearFilter('');
      syncUrl({ brand: '', model: '', year: '' });
    } else if (k === 'model') {
      setModelFilter('');
      setYearFilter('');
      syncUrl({ model: '', year: '' });
    } else if (k === 'year') {
      setYearFilter('');
      syncUrl({ year: '' });
    }
  };
  const clearAllFilters = () => {
    setBrandFilter('');
    setModelFilter('');
    setYearFilter('');
    setQ('');
    syncUrl({ brand: '', model: '', year: '', q: '' });
  };

  /* ================== 渲染 ================== */
  return (
    <main className="container mx-auto p-4">
      {/* 顶部：标题 / 模式 / 购物车 + 迷你下拉 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 relative">
        <div className="text-2xl font-bold">ImgParts 预览站</div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">交易模式：</span>
          <button
            onClick={() => setTradeMode('B2C')}
            className={`rounded-lg border px-3 py-1 text-sm ${mode === 'B2C' ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'}`}
          >
            B2C（个人）
          </button>
          <button
            onClick={() => setTradeMode('B2B')}
            className={`rounded-lg border px-3 py-1 text-sm ${mode === 'B2B' ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'}`}
          >
            B2B（公司）
          </button>
        </div>

        <div className="relative" ref={miniRef}>
          <button
            onClick={() => setMiniOpen((v) => !v)}
            className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50"
            aria-expanded={miniOpen}
          >
            购物车 / 结算（{cartCount}）
          </button>

          {/* 迷你购物车下拉 */}
          {miniOpen && (
            <div className="absolute right-0 mt-2 w-[360px] rounded-xl border bg-white shadow-lg z-50">
              <div className="p-3 text-sm font-medium">购物车预览</div>
              <div className="max-h-[50vh] overflow-auto divide-y">
                {cart.slice(0, 5).map((it) => (
                  <div key={it.key} className="p-3 flex items-center gap-3">
                    <img src={it.image || FALLBACK_IMG} alt="" className="h-12 w-12 rounded border object-contain" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm line-clamp-1">{it.product}</div>
                      {it.oe && <div className="text-[12px] text-gray-500 mt-0.5">OE：{it.oe}</div>}
                      <div className="mt-1 flex items-center gap-2">
                        <button className="rounded border px-2 text-xs" onClick={() => dec(it.key)}>-</button>
                        <span className="text-xs w-5 text-center">{it.qty}</span>
                        <button className="rounded border px-2 text-xs" onClick={() => inc(it.key)}>+</button>
                        <button className="ml-2 rounded border px-2 text-xs text-red-600" onClick={() => rm(it.key)}>移除</button>
                      </div>
                    </div>
                  </div>
                ))}
                {cart.length === 0 && <div className="p-6 text-center text-sm text-gray-400">购物车为空</div>}
              </div>
              <div className="p-3 flex items-center justify-between">
                <button className="text-xs text-gray-500 hover:text-gray-700" onClick={clearCart}>清空</button>
                <button className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white" onClick={openCheckout}>去结算</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 检索条：搜索 + 三级筛选 + 清空 */}
      <div className="mb-3 grid grid-cols-1 lg:grid-cols-[1fr_auto_auto_auto_auto] gap-2">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); syncUrl({ q: e.target.value }); }}
          placeholder="搜索：OE号 / 商品名 / 品牌 / 车型"
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
        <select
          value={brandFilter}
          onChange={(e) => { setBrandFilter(e.target.value); setModelFilter(''); setYearFilter(''); syncUrl({ brand: e.target.value, model: '', year: '' }); }}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">品牌（全部）</option>
          {brandOptions.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select
          value={modelFilter}
          onChange={(e) => { setModelFilter(e.target.value); setYearFilter(''); syncUrl({ model: e.target.value, year: '' }); }}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">车型（全部）</option>
          {modelOptions.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select
          value={yearFilter}
          onChange={(e) => { setYearFilter(e.target.value); syncUrl({ year: e.target.value }); }}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">年款（全部）</option>
          {yearOptions.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <button onClick={clearAllFilters} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
          清空筛选
        </button>
      </div>

      {/* 活动筛选 Chip */}
      {(brandFilter || modelFilter || yearFilter || q) && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500">已选：</span>
          {q && (
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
              关键词：{q}
              <button className="text-gray-400 hover:text-gray-600" onClick={() => { setQ(''); syncUrl({ q: '' }); }}>✕</button>
            </span>
          )}
          {brandFilter && (
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
              品牌：{brandFilter}
              <button className="text-gray-400 hover:text-gray-600" onClick={() => clearOne('brand')}>✕</button>
            </span>
          )}
          {modelFilter && (
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
              车型：{modelFilter}
              <button className="text-gray-400 hover:text-gray-600" onClick={() => clearOne('model')}>✕</button>
            </span>
          )}
          {yearFilter && (
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
              年款：{yearFilter}
              <button className="text-gray-400 hover:text-gray-600" onClick={() => clearOne('year')}>✕</button>
            </span>
          )}
        </div>
      )}

      {/* 列表（卡片含“加入”按钮；标题/图片仍可点进详情） */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((it) => {
          const d = encodeItemForUrl(it.raw);
          const href = `/stock/${encodeURIComponent(it.num || '')}?d=${d}`;
          return (
            <div key={(it.num || '') + (it.oe || '')} className="relative rounded-2xl border bg-white p-4 hover:shadow">
              {/* 加入按钮（防止触发链接） */}
              <button
                onClick={() => quickAdd(it)}
                className="absolute right-3 top-3 rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                title="加入购物车"
              >
                加入
              </button>

              <div className="flex gap-4">
                <Link href={href} className="h-24 w-24 shrink-0 rounded-lg bg-white overflow-hidden border">
                  <img
                    src={it.image || FALLBACK_IMG}
                    alt={it.product}
                    className="h-full w-full object-contain"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG; }}
                  />
                </Link>

                <div className="min-w-0">
                  <Link href={href} className="font-semibold line-clamp-1 hover:underline">
                    {it.product}
                  </Link>
                  <div className="text-xs text-gray-500 mt-1">
                    {it.brand || 'IMG'} {it.model ? `· ${it.model}` : ''} {it.year ? `· ${it.year}` : ''}
                  </div>
                  {it.oe && <div className="text-xs text-gray-500 mt-1">OE: {it.oe}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 加载更多 */}
      <div className="my-6 flex justify-center">
        {hasMore ? (
          <button
            disabled={loading}
            onClick={() => loadPage(page)}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? '加载中…' : '加载更多'}
          </button>
        ) : (
          <div className="text-sm text-gray-400">已加载全部</div>
        )}
      </div>

      {/* 轻提示 */}
      {toast && (
        <div className="fixed right-4 bottom-4 z-50 rounded-lg bg-black/80 text-white text-sm px-3 py-2">
          {toast}
        </div>
      )}

      {/* 结算弹窗 */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/20 flex items-center justify-center p-4">
          <div className="max-h-[90vh] w-[960px] overflow-auto rounded-2xl bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">结算</div>
              <button className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50" onClick={closeCheckout}>关闭</button>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border">
                <div className="p-3 text-sm text-gray-500 flex items-center justify-between">
                  <div>购物车（{cartCount}）</div>
                  <button className="text-xs text-gray-400 hover:text-gray-600" onClick={clearCart}>清空购物车</button>
                </div>
                <div className="divide-y">
                  {cart.map((it) => (
                    <div key={it.key} className="p-3 flex gap-3 items-center">
                      <img src={it.image || FALLBACK_IMG} alt="" className="h-14 w-14 rounded border object-contain" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm line-clamp-1">{it.product}</div>
                        {it.oe && <div className="text-xs text-gray-500 mt-0.5">OE：{it.oe}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="rounded border px-2" onClick={() => dec(it.key)}>-</button>
                        <div className="w-8 text-center">{it.qty}</div>
                        <button className="rounded border px-2" onClick={() => inc(it.key)}>+</button>
                        <button className="ml-2 rounded border px-2 text-red-600" onClick={() => rm(it.key)}>移除</button>
                      </div>
                    </div>
                  ))}
                  {cart.length === 0 && <div className="p-6 text-center text-sm text-gray-400">购物车为空</div>}
                </div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm text-gray-500">交易模式：</span>
                  <button
                    onClick={() => setTradeMode('B2C')}
                    className={`rounded-lg border px-2 py-1 text-xs ${mode==='B2C'?'bg-blue-600 text-white border-blue-600':'hover:bg灰-50'}`}
                  >B2C（个人）</button>
                  <button
                    onClick={() => setTradeMode('B2B')}
                    className={`rounded-lg border px-2 py-1 text-xs ${mode==='B2B'?'bg-blue-600 text白 border-blue-600':'hover:bg-gray-50'}`}
                  >B2B（公司）</button>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {mode === 'B2B' && (
                    <>
                      <input
                        className="rounded-lg border px-3 py-2 text-sm"
                        placeholder="公司名称 *"
                        value={form.company}
                        onChange={(e)=>setForm({...form, company:e.target.value})}
                      />
                      <input
                        className="rounded-lg border px-3 py-2 text-sm"
                        placeholder="统一税号（可选）"
                        value={form.taxId}
                        onChange={(e)=>setForm({...form, taxId:e.target.value})}
                      />
                    </>
                  )}

                  <input
                    className="rounded-lg border px-3 py-2 text-sm"
                    placeholder="联系人姓名 *"
                    value={form.contact}
                    onChange={(e)=>setForm({...form, contact:e.target.value})}
                  />
                  <input
                    className="rounded-lg border px-3 py-2 text-sm"
                    placeholder="联系电话 *"
                    value={form.phone}
                    onChange={(e)=>setForm({...form, phone:e.target.value})}
                  />
                  <input
                    className="rounded-lg border px-3 py-2 text-sm"
                    placeholder="邮箱（必填） *"
                    value={form.email}
                    onChange={(e)=>setForm({...form, email:e.target.value})}
                  />
                  <input
                    className="rounded-lg border px-3 py-2 text-sm"
                    placeholder="国家"
                    value={form.country}
                    onChange={(e)=>setForm({...form, country:e.target.value})}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="rounded-lg border px-3 py-2 text-sm"
                      placeholder="城市"
                      value={form.city}
                      onChange={(e)=>setForm({...form, city:e.target.value})}
                    />
                    <input
                      className="rounded-lg border px-3 py-2 text-sm"
                      placeholder="邮编"
                      value={form.postcode}
                      onChange={(e)=>setForm({...form, postcode:e.target.value})}
                    />
                  </div>
                  <textarea
                    className="rounded-lg border px-3 py-2 text-sm"
                    placeholder="详细地址"
                    rows={3}
                    value={form.address}
                    onChange={(e)=>setForm({...form, address:e.target.value})}
                  />
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button onClick={submitOrder} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">提交订单</button>
                  <button onClick={closeCheckout} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">继续浏览</button>
                </div>
              </div>
            </div>

            <div className="mt-3 text-xs text-gray-400">数据源： niuniuparts.com（测试预览用途）</div>
          </div>
        </div>
      )}
    </main>
  );
}

