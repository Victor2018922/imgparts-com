'use client';

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

/** ================= 常量/工具 ================= */
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
    for (const k of FIELDS) if (k in obj) {
      const hit = deepFindImage(obj[k], depth + 1);
      if (hit) return hit;
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
  return encodeURIComponent(btoa(unescape(encodeURIComponent(json))));
}

function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try { const v = localStorage.getItem('cart') || '[]'; const arr = JSON.parse(v); return Array.isArray(arr) ? arr : []; }
  catch { return []; }
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

/** ================= 页面（带 Suspense） ================= */
export default function StockPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">加载中…</div>}>
      <StockInner />
    </Suspense>
  );
}

/** ================= 主体 ================= */
function StockInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkoutParam = searchParams?.get('checkout');

  const [mode, setMode] = useState<TradeMode>('B2C');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<CardItem[]>([]);
  const [hasMore, setHasMore] = useState(true);

  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const cartCount = useMemo(() => cart.reduce((s, it) => s + it.qty, 0), [cart]);

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

  // 初始化
  useEffect(() => { setMode(loadMode()); setCart(loadCart()); }, []);
  useEffect(() => { if (checkoutParam === '1') setCartOpen(true); }, [checkoutParam]);

  // 拉取一页
  const loadPage = async (p = page) => {
    if (loading || !hasMore) return;
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
        brand: x.brand,
        model: x.model,
        year: x.year,
        image: pickImage(x),
        raw: x,
      }));
      setItems((prev) => [...prev, ...mapped]);
      setHasMore(arr.length === PAGE_SIZE);
      setPage(p + 1);
    } catch { setHasMore(false); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadPage(0); }, []); // 首次加载一页

  // 搜索（前端包含匹配）
  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const key = q.trim().toLowerCase();
    return items.filter((it) => {
      const text = [
        it.product, it.oe, it.brand, it.model, it.year, it.num
      ].filter(Boolean).join(' ').toLowerCase();
      return text.includes(key);
    });
  }, [items, q]);

  // 打开/关闭结算
  const openCheckout = () => setCartOpen(true);
  const closeCheckout = () => setCartOpen(false);

  // 购物车操作
  const dec = (k: string) => setCart((prev) => prev.map(it => it.key === k ? { ...it, qty: Math.max(1, it.qty - 1) } : it));
  const inc = (k: string) => setCart((prev) => prev.map(it => it.key === k ? { ...it, qty: it.qty + 1 } : it));
  const rm  = (k: string) => setCart((prev) => prev.filter(it => it.key !== k));
  const clearCart = () => setCart([]);

  useEffect(() => { saveCart(cart); }, [cart]);

  // 模式切换
  const setTradeMode = (m: TradeMode) => { setMode(m); saveMode(m); };

  // 表单提交（演示：控制台 + 提示）
  const submitOrder = () => {
    // 必填校验
    if (!form.email.trim()) {
      alert('请填写邮箱（必填）');
      return;
    }
    if (mode === 'B2B' && !form.company.trim()) {
      alert('公司名称为必填项（B2B）');
      return;
    }
    const payload = { mode, cart, form };
    console.log('提交订单（演示）:', payload);
    alert('订单已提交（演示提交）。我们将尽快与您联系！');
    setCart([]);
    setCartOpen(false);
  };

  return (
    <main className="container mx-auto p-4">
      {/* 顶部导航 + 模式开关 + 购物车 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-2xl font-bold">ImgParts 预览站</div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">交易模式：</span>
          <button
            onClick={() => setTradeMode('B2C')}
            className={`rounded-lg border px-3 py-1 text-sm ${mode==='B2C' ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'}`}
          >B2C（个人）</button>
          <button
            onClick={() => setTradeMode('B2B')}
            className={`rounded-lg border px-3 py-1 text-sm ${mode==='B2B' ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'}`}
          >B2B（公司）</button>
        </div>

        <button
          onClick={openCheckout}
          className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50"
        >
          购物车 / 结算（{cartCount}）
        </button>
      </div>

      {/* 搜索框 */}
      <div className="mb-4 flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索：OE号 / 商品名 / 品牌 / 车型"
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
        <button
          onClick={() => { /* 前端过滤，无需额外操作 */ }}
          className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
        >
          搜索
        </button>
      </div>

      {/* 列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((it) => {
          const d = encodeItemForUrl(it.raw);
          const href = `/stock/${encodeURIComponent(it.num || '')}?d=${d}`;
          return (
            <Link
              key={(it.num || '') + (it.oe || '')}
              href={href}
              className="rounded-2xl border bg-white p-4 hover:shadow"
            >
              <div className="flex gap-4">
                <div className="h-24 w-24 shrink-0 rounded-lg bg-white overflow-hidden border">
                  <img
                    src={it.image || FALLBACK_IMG}
                    alt={it.product}
                    className="h-full w-full object-contain"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG; }}
                  />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold line-clamp-1">{it.product}</div>
                  <div className="text-xs text-gray-500 mt-1">{it.brand || 'IMG'}</div>
                  {it.oe && <div className="text-xs text-gray-500 mt-1">OE: {it.oe}</div>}
                </div>
              </div>
            </Link>
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

      {/* 结算弹窗 */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/20 flex items-center justify-center p-4">
          <div className="max-h-[90vh] w-[960px] overflow-auto rounded-2xl bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">结算</div>
              <button className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50" onClick={closeCheckout}>关闭</button>
            </div>

            {/* 顶部：购物车条目 */}
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

              {/* 收货信息（随模式变化） */}
              <div className="rounded-xl border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm text-gray-500">交易模式：</span>
                  <button
                    onClick={() => setTradeMode('B2C')}
                    className={`rounded-lg border px-2 py-1 text-xs ${mode==='B2C'?'bg-blue-600 text-white border-blue-600':'hover:bg-gray-50'}`}
                  >B2C（个人）</button>
                  <button
                    onClick={() => setTradeMode('B2B')}
                    className={`rounded-lg border px-2 py-1 text-xs ${mode==='B2B'?'bg-blue-600 text-white border-blue-600':'hover:bg-gray-50'}`}
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
                        placeholder="税号 / VAT（可选）"
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
                    placeholder="邮箱（必填）*"
                    value={form.email}
                    onChange={(e)=>setForm({...form, email:e.target.value})}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="rounded-lg border px-3 py-2 text-sm"
                      placeholder="国家"
                      value={form.country}
                      onChange={(e)=>setForm({...form, country:e.target.value})}
                    />
                    <input
                      className="rounded-lg border px-3 py-2 text-sm"
                      placeholder="城市"
                      value={form.city}
                      onChange={(e)=>setForm({...form, city:e.target.value})}
                    />
                  </div>
                  <input
                    className="rounded-lg border px-3 py-2 text-sm"
                    placeholder="详细地址"
                    value={form.address}
                    onChange={(e)=>setForm({...form, address:e.target.value})}
                  />
                  <input
                    className="rounded-lg border px-3 py-2 text-sm"
                    placeholder="邮编"
                    value={form.postcode}
                    onChange={(e)=>setForm({...form, postcode:e.target.value})}
                  />

                  <div className="pt-2">
                    <button
                      disabled={cart.length===0}
                      onClick={submitOrder}
                      className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
                    >
                      提交订单
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </main>
  );
}

