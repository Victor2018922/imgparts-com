'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';

/* ------------------ 常量与工具（与列表页保持一致） ------------------ */
type AnyObj = Record<string, any>;

const CROP_TOP_PCT = 6;     // 裁掉顶部去水印
const CROP_BOTTOM_PCT = 16; // 裁掉底部去水印

function preconnectOnce() {
  if (typeof document === 'undefined') return;
  if ((window as any).__img_preconnected_detail__) return;
  const add = (rel: string, href: string) => {
    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    document.head.appendChild(link);
  };
  add('preconnect', 'https://images.weserv.nl');
  add('dns-prefetch', '//images.weserv.nl');
  add('preconnect', 'https://niuniuparts.com');
  add('dns-prefetch', '//niuniuparts.com');
  (window as any).__img_preconnected_detail__ = true;
}

function absolutize(url: string): string {
  if (!url) return url;
  let u = url.trim();
  if (u.startsWith('//')) return 'http:' + u;
  if (u.startsWith('/')) return 'http://niuniuparts.com' + u;
  return u;
}
function toProxy(raw?: string | null, w = 1200, h = 900, q = 78): string | null {
  if (!raw) return null;
  let u = absolutize(raw);
  if (/^data:image\//i.test(u)) return u;
  u = u.replace(/^https?:\/\//i, '');
  return `https://images.weserv.nl/?url=${encodeURIComponent(u)}&w=${w}&h=${h}&fit=contain&we=auto&q=${q}&il`;
}

/* 从文本与对象中挖图片 URL（与列表页同策略） */
function extractUrlsFromText(text: string): string[] {
  const urls = new Set<string>();
  if (!text) return [];
  const reExt = /(https?:\/\/[^\s"'<>]+?\.(?:jpg|jpeg|png|gif|webp))(?:[?#][^\s"'<>]*)?/gi;
  const reImg = /<img\b[^>]*src=['"]?([^'">\s]+)['"]?/gi;
  const reRel = /(\/(?:upload|uploads|images|img|files)\/[^\s"'<>]+?\.(?:jpg|jpeg|png|gif|webp))(?:[?#][^\s"'<>]*)?/gi;
  const reAny = /(https?:\/\/[^\s"'<>]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = reExt.exec(text))) urls.add(m[1]);
  while ((m = reImg.exec(text))) urls.add(m[1]);
  while ((m = reRel.exec(text))) urls.add('http://niuniuparts.com' + m[1]);
  while ((m = reAny.exec(text))) urls.add(m[1]);
  return Array.from(urls);
}
function collectCandidateUrls(obj: any, max = 1000): string[] {
  const ret = new Set<string>();
  const seen = new Set<any>();
  const stack: any[] = [obj];
  const imgKeys = [
    'image','imageurl','image_url','imagePath','imageList','images',
    'pics','pictures','photos','thumbnail','thumb','thumburl',
    'cover','logo','banner','mainpic','main_pic','img','imgurl','图片','主图'
  ];
  while (stack.length && ret.size < max) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
    seen.add(cur);
    for (const k of Object.keys(cur)) {
      const v = (cur as AnyObj)[k];
      if (imgKeys.some((kw) => k.toLowerCase().includes(kw.toLowerCase()))) {
        if (typeof v === 'string') {
          extractUrlsFromText(v).forEach((u) => ret.add(u));
          if (/\.(jpg|jpeg|png|gif|webp)(\?|#|$)/i.test(v)) ret.add(v);
        } else if (Array.isArray(v)) {
          v.forEach((x) => {
            if (typeof x === 'string') {
              extractUrlsFromText(x).forEach((u) => ret.add(u));
              if (/\.(jpg|jpeg|png|gif|webp)(\?|#|$)/i.test(x)) ret.add(x);
            } else if (x && typeof x === 'object') {
              ['url','src','path'].forEach((kk) => {
                if (typeof (x as any)[kk] === 'string') {
                  const s = (x as any)[kk] as string;
                  ret.add(s);
                  extractUrlsFromText(s).forEach((u) => ret.add(u));
                }
              });
            }
          });
        } else if (v && typeof v === 'object') {
          ['url','src','path'].forEach((kk) => {
            if (typeof (v as any)[kk] === 'string') {
              const s = (v as any)[kk] as string;
              ret.add(s);
              extractUrlsFromText(s).forEach((u) => ret.add(u));
            }
          });
        }
      }
      if (typeof v === 'string') extractUrlsFromText(v).forEach((u) => ret.add(u));
      if (Array.isArray(v) || (v && typeof v === 'object')) stack.push(v);
    }
  }
  return Array.from(ret);
}

function pick(obj: AnyObj | null | undefined, keys: string[], fallback: any = '-') {
  if (!obj) return fallback;
  const alias: Record<string, string[]> = {
    title: ['标题','名称','品名','title','product','name'],
    brand: ['品牌','brand'],
    model: ['车型','model'],
    year:  ['年份','年款','year'],
    oe:    ['OE','oe','配件号','编号'],
    num:   ['num','编码','编号','货号'],
    price: ['价格','单价','售价','price'],
    stock: ['库存','库存数量','数量','在库','stock'],
  };
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    const group = alias[k];
    if (group) for (const a of group) {
      if (obj[a] !== undefined && obj[a] !== null && obj[a] !== '') return obj[a];
    }
  }
  return fallback;
}

/* ------------------ 购物车/订单（与列表页共享键名） ------------------ */
type CartItem = {
  num: string;
  title: string;
  price: number;
  qty: number;
  img: string | null;
  oe?: string;
  brand?: string;
  model?: string;
};
const CART_KEY = 'imgparts_cart_v1';
const CUSTOMER_KEY = 'imgparts_customer_v1';
const ORDER_LAST_KEY = 'imgparts_last_order_v1';
const ORDERS_KEY = 'imgparts_orders_v1';

function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]') as CartItem[]; } catch { return []; }
}
function saveCart(items: CartItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}
function money(v: number) {
  if (Number.isNaN(v)) return '-';
  return v.toFixed(2);
}

/* ------------------ 详情页组件 ------------------ */
export default function StockDetailPage() {
  const router = useRouter();
  const params = useParams<{ num: string }>();
  const sp = useSearchParams();

  const [list, setList] = useState<any[]>([]);
  const [item, setItem] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // 画廊
  const [imgs, setImgs] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);

  // 数量
  const [qty, setQty] = useState(1);

  // 购物车抽屉
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  type Step = 'cart' | 'checkout' | 'success';
  const [drawerStep, setDrawerStep] = useState<Step>('cart');
  const cartCount = useMemo(() => cart.reduce((s, x) => s + x.qty, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((s, x) => s + x.price * x.qty, 0), [cart]);

  // 结算表单
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [note, setNote] = useState('');
  const [shipping, setShipping] = useState<'standard' | 'express'>('standard');
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    preconnectOnce();
    setCart(loadCart());

    // 客户缓存
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOMER_KEY) || 'null');
      if (saved) {
        setName(saved.name || '');
        setPhone(saved.phone || '');
        setEmail(saved.email || '');
        setCountry(saved.country || '');
        setCity(saved.city || '');
        setAddress(saved.address || '');
        setPostcode(saved.postcode || '');
      }
    } catch {}

    (async () => {
      try {
        // 拉列表（含全部字段，便于取图片）
        const res = await fetch('https://niuniuparts.com:6001/scm-product/v1/stock2?size=500&page=0', { cache: 'no-store' });
        const data = await res.json().catch(() => ({} as AnyObj));
        const arr: any[] =
          data?.data?.list ?? data?.data?.records ?? data?.list ?? data?.records ?? data?.data ?? [];
        setList(arr);

        const found = arr.find((x) => String(pick(x, ['num'], '')).toLowerCase() === String(params.num).toLowerCase()) || null;

        // 如果列表找不到该条，拼一个兜底对象（用 URL 参数）
        const fallbackObj = {
          num: params.num,
          title: sp.get('title') || '-',
          oe: sp.get('oe') || '',
          brand: sp.get('brand') || '-',
          model: sp.get('model') || '-',
          year: sp.get('year') || '-',
          price: sp.get('price') || '-',
          stock: sp.get('stock') || '-',
        };
        const it = found || fallbackObj;
        setItem(it);

        // 收集候选图片
        const candidates = collectCandidateUrls(it);
        // 去除非常大的重复、带 ?size 参数的等
        const normalized = Array.from(new Set(candidates.map((u) => u.split('?')[0])));
        setImgs(normalized.slice(0, 60)); // 最多 60 张，前 12 张直接显示
      } finally {
        setLoading(false);
      }
    })();
  }, [params.num]);

  useEffect(() => {
    if (cartOpen) setDrawerStep('cart');
  }, [cartOpen]);

  /* 便捷字段 */
  const field = (k: 'title'|'brand'|'model'|'year'|'oe'|'num'|'price'|'stock') =>
    pick(item || {}, [k], k === 'price' ? '-' : '-');

  /* 上一条/下一条 */
  const prevNext = useMemo(() => {
    const num = String(field('num'));
    const idx = list.findIndex((x) => String(pick(x,['num'],'')).toLowerCase() === num.toLowerCase());
    if (idx < 0) return { prev: null as any, next: null as any };
    const buildHref = (it: any) => {
      const q = new URLSearchParams({
        title: String(pick(it,['title'],'-')),
        oe: String(pick(it,['oe'],'')),
        brand: String(pick(it,['brand'],'-')),
        model: String(pick(it,['model'],'-')),
        price: String(pick(it,['price'],'-')),
        stock: String(pick(it,['stock'],'-')),
      }).toString();
      return `/stock/${encodeURIComponent(String(pick(it,['num'],'')))}` + `?${q}`;
    };
    return {
      prev: list[idx - 1] ? buildHref(list[idx - 1]) : null,
      next: list[idx + 1] ? buildHref(list[idx + 1]) : null,
    };
  }, [list, item]);

  /* 加入购物车 */
  const addToCart = () => {
    if (!item) return;
    const priceNum = parseFloat(String(field('price')).toString().replace(/[^\d.]+/g, '')) || 0;
    const candidates = collectCandidateUrls(item);
    const firstRaw = candidates[0] || null;
    const cartItem: CartItem = {
      num: String(field('num')),
      title: String(field('title')),
      price: priceNum,
      qty: Math.max(1, Math.floor(qty)),
      img: firstRaw ? toProxy(firstRaw, 160, 120, 60) : null,
      oe: String(field('oe')) || undefined,
      brand: String(field('brand')),
      model: String(field('model')),
    };
    const copy = [...cart];
    const idx = copy.findIndex((x) => x.num === cartItem.num);
    if (idx >= 0) copy[idx].qty += cartItem.qty; else copy.push(cartItem);
    setCart(copy); saveCart(copy);
    setCartOpen(true);
  };

  const updateQtyInCart = (numKey: string, newQty: number) => {
    const copy = cart.map((x) => (x.num === numKey ? { ...x, qty: Math.max(1, Math.floor(newQty)) } : x));
    setCart(copy); saveCart(copy);
  };
  const removeItem = (numKey: string) => { const copy = cart.filter((x) => x.num !== numKey); setCart(copy); saveCart(copy); };
  const clearCart = () => { setCart([]); saveCart([]); };

  /* 结算 */
  const saveCustomer = () => {
    try { localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ name, phone, email, country, city, address, postcode })); } catch {}
  };
  const submitOrder = () => {
    if (!name.trim()) return alert('请填写姓名');
    if (!phone.trim()) return alert('请填写手机');
    if (!address.trim()) return alert('请填写地址');
    if (cart.length === 0) return alert('购物车为空');

    const id = 'IP' + Date.now();
    const order = {
      id,
      items: cart,
      total: cartTotal,
      customer: { name, phone, email, country, city, address, postcode, note, shipping },
      createdAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(ORDER_LAST_KEY, JSON.stringify(order));
      const list = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
      list.unshift(order);
      localStorage.setItem(ORDERS_KEY, JSON.stringify(list));
    } catch {}

    clearCart();
    saveCustomer();
    setOrderId(id);
    setDrawerStep('success');
  };

  /* 缩略图窗口（12张可见，横向滚动查看更多） */
  const MAX_VISIBLE = 12;
  const thumbs = useMemo(() => imgs.slice(0, MAX_VISIBLE), [imgs]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <Link href="/stock" className="rounded border px-4 py-2 hover:bg-gray-50">← 返回列表</Link>
        <div className="flex items-center gap-2">
          {prevNext.prev && <Link href={prevNext.prev} className="rounded border px-3 py-2 hover:bg-gray-50">上一条</Link>}
          {prevNext.next && <Link href={prevNext.next} className="rounded border px-3 py-2 hover:bg-gray-50">下一条</Link>}
          <a
            href="https://niuniuparts.com:6001/scm-product/v1/stock2/excel?size=20&page=0"
            target="_blank" rel="noreferrer"
            className="rounded bg-blue-600 hover:bg-blue-700 text-white px-4 py-2"
          >
            下载库存 Excel
          </a>
        </div>
      </header>

      {loading || !item ? (
        <div className="text-gray-500">加载中…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：大图 + 缩略图 */}
          <div>
            <div
              className="relative w-full"
              style={{ height: 520, background: '#fafafa', overflow: 'hidden', borderRadius: 12 }}
              onClick={() => setZoomOpen(true)}
              title="点击放大查看"
            >
              {imgs[active] ? (
                <img
                  src={toProxy(imgs[active], 1280, 960, 80) || undefined}
                  alt={String(field('title'))}
                  loading="eager"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full"
                  style={{ objectFit: 'contain', clipPath: `inset(${CROP_TOP_PCT}% 0% ${CROP_BOTTOM_PCT}% 0%)` }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">无图</div>
              )}
            </div>

            {/* 缩略图条 */}
            <div className="mt-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {thumbs.length === 0 && <div className="text-gray-400">无图</div>}
                {thumbs.map((u, i) => (
                  <button
                    key={u + i}
                    onClick={() => setActive(i)}
                    className={`relative flex-none w-28 h-20 rounded border ${active === i ? 'border-blue-600' : 'border-gray-200'} bg-white overflow-hidden`}
                    title="切换大图"
                  >
                    <img
                      src={toProxy(u, 240, 180, 65) || undefined}
                      alt={`thumb-${i}`}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-full h-full"
                      style={{ objectFit: 'contain', clipPath: `inset(${CROP_TOP_PCT}% 0% ${CROP_BOTTOM_PCT}% 0%)` }}
                    />
                  </button>
                ))}
              </div>
              {imgs.length > MAX_VISIBLE && (
                <div className="mt-1 text-xs text-gray-500">已载 {MAX_VISIBLE}/{imgs.length} 张（横向滚动查看更多）</div>
              )}
            </div>
          </div>

          {/* 右侧：信息 + 购物操作 */}
          <div className="space-y-4">
            <div className="text-2xl font-bold">{String(field('title'))}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-[15px]">
              <div><span className="text-gray-500">Num：</span>{String(field('num'))}</div>
              <div><span className="text-gray-500">Brand：</span>{String(field('brand'))}</div>
              <div><span className="text-gray-500">OE：</span>{String(field('oe'))}</div>
              <div><span className="text-gray-500">Model：</span>{String(field('model'))}</div>
              <div><span className="text-gray-500">Year：</span>{String(field('year'))}</div>
              <div><span className="text-gray-500">Stock：</span>{String(field('stock'))}</div>
            </div>

            <div className="text-3xl font-bold text-emerald-700">¥ {money(parseFloat(String(field('price')).toString().replace(/[^\d.]+/g, '')) || 0)}</div>

            <div className="flex items-center gap-3">
              <div className="flex items-center border rounded overflow-hidden">
                <button className="px-3 py-2 hover:bg-gray-50" onClick={() => setQty((v) => Math.max(1, v - 1))}>-</button>
                <input className="w-14 text-center" value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || '1', 10)))} />
                <button className="px-3 py-2 hover:bg-gray-50" onClick={() => setQty((v) => v + 1)}>+</button>
              </div>
              <button onClick={addToCart} className="rounded bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2">
                加入购物车
              </button>
              <button onClick={() => setCartOpen(true)} className="rounded border px-4 py-2 hover:bg-gray-50">
                打开购物车 {cartCount > 0 ? `(${cartCount})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 放大预览 */}
      {zoomOpen && imgs[active] && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setZoomOpen(false)}>
          <img
            src={toProxy(imgs[active], 1800, 1350, 82) || undefined}
            alt="zoom"
            referrerPolicy="no-referrer"
            className="max-w-[95vw] max-h-[95vh]"
            style={{ objectFit: 'contain', clipPath: `inset(${CROP_TOP_PCT}% 0% ${CROP_BOTTOM_PCT}% 0%)` }}
          />
        </div>
      )}

      {/* 悬浮购物车按钮（移动端友好） */}
      <button
        onClick={() => setCartOpen(true)}
        className="fixed right-4 bottom-4 z-40 rounded-full shadow-lg bg-gray-900 text-white px-4 py-3"
        aria-label="打开购物车"
      >
        购物车 {cartCount > 0 ? `(${cartCount})` : ''}
      </button>

      {/* 抽屉：购物车 → 结算 → 成功 */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setCartOpen(false)}>
          <div
            className="absolute right-0 top-0 h-full w-full sm:w-[460px] bg-white shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="font-semibold">
                {drawerStep === 'cart' && '购物车'}
                {drawerStep === 'checkout' && '填写收件信息'}
                {drawerStep === 'success' && '下单成功'}
              </div>
              <button className="px-2 py-1 rounded border hover:bg-gray-50" onClick={() => setCartOpen(false)}>关闭</button>
            </div>

            <div className="p-4 overflow-auto flex-1">
              {drawerStep === 'cart' && (
                <>
                  {cart.length === 0 ? (
                    <div className="text-gray-500">购物车是空的</div>
                  ) : (
                    <div className="space-y-3">
                      {cart.map((it) => (
                        <div key={it.num} className="flex items-center gap-3 border rounded p-2">
                          <div className="w-20 h-16 flex items-center justify-center bg-gray-50 overflow-hidden">
                            {it.img ? (
                              <img
                                src={it.img}
                                alt={it.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full"
                                style={{ objectFit: 'contain', clipPath: `inset(${CROP_TOP_PCT}% 0% ${CROP_BOTTOM_PCT}% 0%)` }}
                              />
                            ) : (
                              <div className="text-gray-400">无图</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate" title={it.title}>{it.title}</div>
                            <div className="text-sm text-gray-500">Num: {it.num}</div>
                            {it.oe && <div className="text-sm text-gray-500">OE: {it.oe}</div>}
                            <div className="mt-1 text-emerald-700 font-semibold">¥ {money(it.price)}</div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center border rounded overflow-hidden">
                              <button className="px-2 py-1 hover:bg-gray-50" onClick={() => updateQtyInCart(it.num, it.qty - 1)}>-</button>
                              <input
                                className="w-12 text-center"
                                value={it.qty}
                                onChange={(e) => updateQtyInCart(it.num, parseInt(e.target.value || '1', 10))}
                              />
                              <button className="px-2 py-1 hover:bg-gray-50" onClick={() => updateQtyInCart(it.num, it.qty + 1)}>+</button>
                            </div>
                            <button className="text-red-600 text-sm hover:underline" onClick={() => removeItem(it.num)}>删除</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {drawerStep === 'checkout' && (
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submitOrder(); }}>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex gap-2">
                      <label className="w-24 text-gray-600 py-2">姓名*</label>
                      <input className="flex-1 border rounded px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div className="flex gap-2">
                      <label className="w-24 text-gray-600 py-2">手机*</label>
                      <input className="flex-1 border rounded px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                    </div>
                    <div className="flex gap-2">
                      <label className="w-24 text-gray-600 py-2">邮箱</label>
                      <input type="email" className="flex-1 border rounded px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <label className="w-24 text-gray-600 py-2">国家/地区</label>
                      <input className="flex-1 border rounded px-3 py-2" value={country} onChange={(e) => setCountry(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <label className="w-24 text-gray-600 py-2">城市</label>
                      <input className="flex-1 border rounded px-3 py-2" value={city} onChange={(e) => setCity(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <label className="w-24 text-gray-600 py-2">地址*</label>
                      <input className="flex-1 border rounded px-3 py-2" value={address} onChange={(e) => setAddress(e.target.value)} required />
                    </div>
                    <div className="flex gap-2">
                      <label className="w-24 text-gray-600 py-2">邮编</label>
                      <input className="flex-1 border rounded px-3 py-2" value={postcode} onChange={(e) => setPostcode(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <label className="w-24 text-gray-600 py-2">备注</label>
                      <textarea className="flex-1 border rounded px-3 py-2" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
                    </div>
                    <div className="flex gap-2 items-center">
                      <label className="w-24 text-gray-600">配送方式</label>
                      <div className="flex-1 flex gap-4">
                        <label className="flex items-center gap-2">
                          <input type="radio" name="shipping" checked={shipping === 'standard'} onChange={() => setShipping('standard')} />
                          标准运输
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="radio" name="shipping" checked={shipping === 'express'} onChange={() => setShipping('express')} />
                          加急运输
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 border-t pt-3">
                    <div className="flex items-center justify-between text-lg">
                      <span>应付合计</span>
                      <strong>¥ {money(cartTotal)}</strong>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button type="button" onClick={() => { saveCustomer(); setDrawerStep('cart'); }} className="rounded border px-4 py-2 hover:bg-gray-50">
                      返回购物车
                    </button>
                    <button type="submit" className="rounded bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 flex-1" disabled={cart.length === 0}>
                      提交订单
                    </button>
                  </div>
                </form>
              )}

              {drawerStep === 'success' && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600">下单成功</div>
                  <div className="mt-2 text-gray-600">订单号：{orderId}</div>
                  <div className="mt-2 text-gray-600">应付合计：¥ {money(cartTotal)}</div>
                  <div className="mt-6 flex items-center gap-2 justify-center">
                    <button className="rounded bg-gray-900 hover:bg-black text-white px-4 py-2" onClick={() => { setCartOpen(false); setDrawerStep('cart'); }}>
                      继续购物
                    </button>
                    <button
                      className="rounded border px-4 py-2 hover:bg-gray-50"
                      onClick={() => {
                        try {
                          const last = localStorage.getItem(ORDER_LAST_KEY) || '';
                          navigator.clipboard?.writeText(last);
                          alert('订单信息已复制');
                        } catch { alert('复制失败'); }
                      }}
                    >
                      复制订单信息
                    </button>
                  </div>
                </div>
              )}
            </div>

            {drawerStep === 'cart' && (
              <div className="mt-2 px-4 py-3 border-t">
                <div className="flex items-center justify-between">
                  <div className="text-gray-600">合计</div>
                  <div className="text-xl font-bold text-gray-900">¥ {money(cartTotal)}</div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={clearCart} className="rounded border px-4 py-2 hover:bg-gray-50" disabled={cart.length === 0}>清空</button>
                  <button onClick={() => setDrawerStep('checkout')} className="rounded bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 flex-1" disabled={cart.length === 0}>
                    去结算
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

