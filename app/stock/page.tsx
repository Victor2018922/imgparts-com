'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type AnyObj = Record<string, any>;

/* ======== 与详情页保持一致的图片裁切策略 ======== */
const CROP_TOP_PCT = 6;     // 裁顶部 %
const CROP_BOTTOM_PCT = 16; // 裁底部 %
const MASK_BOTTOM_PX = 12;  // 底部渐变遮罩，列表里减小一点

/* ======== 预连接，降低首包延迟 ======== */
function preconnectOnce() {
  if (typeof document === 'undefined') return;
  if ((window as any).__img_preconnected__) return;
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
  (window as any).__img_preconnected__ = true;
}

/* ======== 图片 URL & 代理（HTTPS + 压缩） ======== */
function absolutize(url: string): string {
  if (!url) return url;
  let u = url.trim();
  if (u.startsWith('//')) return 'http:' + u;
  if (u.startsWith('/')) return 'http://niuniuparts.com' + u;
  return u;
}
function toProxy(raw?: string | null, w = 800, h = 600, q = 75): string | null {
  if (!raw) return null;
  let u = absolutize(raw);
  if (/^data:image\//i.test(u)) return u;
  u = u.replace(/^https?:\/\//i, ''); // weserv 需要无协议
  return `https://images.weserv.nl/?url=${encodeURIComponent(u)}&w=${w}&h=${h}&fit=contain&we=auto&q=${q}&il`;
}

/* ======== 候选图片收集 ======== */
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

/* ======== 取值工具 ======== */
function pick(obj: AnyObj | null | undefined, keys: string[], fallback: any = '-') {
  if (!obj) return fallback;
  const alias: Record<string, string[]> = {
    title: ['标题', '名称', '品名', 'title', 'product', 'name'],
    brand: ['品牌', 'brand'],
    model: ['车型', 'model'],
    year:  ['年份', '年款', 'year'],
    oe:    ['OE', 'oe', '配件号', '编号'],
    num:   ['num', '编码', '编号', '货号'],
    price: ['价格', '单价', '售价', 'price'],
    stock: ['库存', '库存数量', '数量', '在库', 'stock'],
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

/* ======== 购物车（与详情页共用同一键名） ======== */
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

/* ======== 页面组件 ======== */
export default function StockListPage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 购物车
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  type Step = 'cart' | 'checkout' | 'success';
  const [drawerStep, setDrawerStep] = useState<Step>('cart');

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

  // 提交成功信息
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    preconnectOnce();
    setCart(loadCart());

    // 载入客户缓存
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
        const res = await fetch('https://niuniuparts.com:6001/scm-product/v1/stock2?size=20&page=0', { cache: 'no-store' });
        const data = await res.json().catch(() => ({} as AnyObj));
        const arr: any[] =
          data?.data?.list ??
          data?.data?.records ??
          data?.list ??
          data?.records ??
          data?.data ??
          [];
        setList(arr);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 打开/关闭抽屉时重置到购物车视图
  useEffect(() => {
    if (cartOpen) setDrawerStep('cart');
  }, [cartOpen]);

  const cartCount = useMemo(() => cart.reduce((s, x) => s + x.qty, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((s, x) => s + x.price * x.qty, 0), [cart]);

  /* ======== 列表卡片：计算字段 ======== */
  const cardView = (it: AnyObj) => {
    const title = pick(it, ['title'], '-');
    const brand = pick(it, ['brand'], '-');
    const model = pick(it, ['model'], '-');
    const year  = pick(it, ['year'],  '-');
    const oe    = pick(it, ['oe'],    '');
    const num   = pick(it, ['num'],   '');
    const price = pick(it, ['price'], '-');
    const stock = pick(it, ['stock'], '-');

    // 找到第一张候选图，生成缩略图
    const candidates = new Set<string>();
    collectCandidateUrls(it).forEach((u) => candidates.add(u));
    const firstRaw = Array.from(candidates)[0];
    const thumb = firstRaw ? toProxy(firstRaw, 160, 120, 60) : null;

    // 详情页链接（带兜底，打开更快）
    const q = new URLSearchParams({
      title: String(title), oe: String(oe), brand: String(brand),
      model: String(model), price: String(price), stock: String(stock),
    }).toString();
    const href = `/stock/${encodeURIComponent(String(num))}?${q}`;

    return { title, brand, model, year, oe, num, price, stock, thumb, firstRaw, href };
  };

  /* ======== 购物车操作 ======== */
  const addToCart = (it: AnyObj) => {
    const v = cardView(it);
    if (!v.num) return;
    const priceNum = parseFloat(String(v.price).toString().replace(/[^\d.]+/g, '')) || 0;
    const item: CartItem = {
      num: String(v.num),
      title: String(v.title),
      price: priceNum,
      qty: 1,
      img: v.firstRaw ? toProxy(v.firstRaw, 160, 120, 60) : null,
      oe: v.oe ? String(v.oe) : undefined,
      brand: String(v.brand),
      model: String(v.model),
    };
    const copy = [...cart];
    const idx = copy.findIndex((x) => x.num === item.num);
    if (idx >= 0) copy[idx].qty += 1;
    else copy.push(item);
    setCart(copy);
    saveCart(copy);
  };

  const updateQty = (numKey: string, newQty: number) => {
    const copy = cart.map((x) => (x.num === numKey ? { ...x, qty: Math.max(1, Math.floor(newQty)) } : x));
    setCart(copy); saveCart(copy);
  };
  const removeItem = (numKey: string) => { const copy = cart.filter((x) => x.num !== numKey); setCart(copy); saveCart(copy); };
  const clearCart = () => { setCart([]); saveCart([]); };

  /* ======== 结算表单与订单提交 ======== */
  const saveCustomer = () => {
    try {
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ name, phone, email, country, city, address, postcode }));
    } catch {}
  };

  const submitOrder = () => {
    // 简单校验
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

    // 清空购物车并进入成功页
    clearCart();
    saveCustomer();
    setOrderId(id);
    setDrawerStep('success');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* 顶部：标题 + Excel 下载 */}
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">库存预览</h1>
        <a
          href="https://niuniuparts.com:6001/scm-product/v1/stock2/excel?size=20&page=0"
          target="_blank"
          rel="noreferrer"
          className="rounded bg-blue-600 hover:bg-blue-700 text-white px-4 py-2"
        >
          下载库存 Excel
        </a>
      </header>

      {/* 列表 */}
      {loading ? (
        <div className="text-gray-500">加载中…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {list.map((it, idx) => {
            const v = cardView(it);
            return (
              <div key={idx} className="border rounded-lg overflow-hidden bg-white flex flex-col">
                <Link href={v.href} className="block">
                  <div className="relative w-full" style={{ height: 160, background: '#fafafa', overflow: 'hidden' }}>
                    {v.thumb ? (
                      <>
                        <img
                          src={v.thumb}
                          alt={String(v.title)}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 w-full h-full"
                          style={{ objectFit: 'contain', clipPath: `inset(${CROP_TOP_PCT}% 0% ${CROP_BOTTOM_PCT}% 0%)` }}
                        />
                        <div
                          className="absolute left-0 right-0 bottom-0 pointer-events-none"
                          style={{ height: MASK_BOTTOM_PX, background: 'linear-gradient(to bottom, rgba(250,250,250,0), rgba(250,250,250,1))' }}
                        />
                      </>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400">无图</div>
                    )}
                  </div>
                </Link>

                <div className="p-3 flex-1 flex flex-col">
                  <div className="font-semibold line-clamp-2" title={String(v.title)}>{String(v.title)}</div>
                  <div className="text-sm text-gray-500 mt-1">Num：{String(v.num)}</div>
                  {v.oe ? <div className="text-sm text-gray-500">OE：{String(v.oe)}</div> : null}
                  <div className="text-sm text-gray-500">Brand：{String(v.brand)}</div>
                  <div className="text-sm text-gray-500">Model：{String(v.model)}</div>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-emerald-700 font-bold">¥ {money(parseFloat(String(v.price).toString().replace(/[^\d.]+/g, '')) || 0)}</div>
                    <button
                      onClick={() => addToCart(it)}
                      className="rounded bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5"
                      title="加入购物车"
                    >
                      加入购物车
                    </button>
                  </div>

                  <div className="mt-1 text-xs text-gray-500">Stock：{String(v.stock)}</div>

                  <Link
                    href={v.href}
                    className="mt-3 inline-flex items-center justify-center rounded border px-3 py-2 hover:bg-gray-50"
                  >
                    查看详情
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 右下角悬浮购物车按钮 */}
      <button
        onClick={() => setCartOpen(true)}
        className="fixed right-4 bottom-4 z-40 rounded-full shadow-lg bg-gray-900 text-white px-4 py-3"
        aria-label="打开购物车"
        title="打开购物车"
      >
        购物车 {cartCount > 0 ? `(${cartCount})` : ''}
      </button>

      {/* 购物车/结算/成功 抽屉 */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setCartOpen(false)}>
          <div
            className="absolute right-0 top-0 h-full w-full sm:w-[460px] bg-white shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 顶部 */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="font-semibold">
                {drawerStep === 'cart' && '购物车'}
                {drawerStep === 'checkout' && '填写收件信息'}
                {drawerStep === 'success' && '下单成功'}
              </div>
              <button className="px-2 py-1 rounded border hover:bg-gray-50" onClick={() => setCartOpen(false)}>关闭</button>
            </div>

            {/* 内容 */}
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
                                style={{
                                  width: '100%', height: '100%', objectFit: 'contain',
                                  clipPath: `inset(${CROP_TOP_PCT}% 0% ${CROP_BOTTOM_PCT}% 0%)`,
                                }}
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
                              <button className="px-2 py-1 hover:bg-gray-50" onClick={() => updateQty(it.num, it.qty - 1)}>-</button>
                              <input
                                className="w-12 text-center"
                                value={it.qty}
                                onChange={(e) => updateQty(it.num, parseInt(e.target.value || '1', 10))}
                              />
                              <button className="px-2 py-1 hover:bg-gray-50" onClick={() => updateQty(it.num, it.qty + 1)}>+</button>
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
                <form
                  className="space-y-3"
                  onSubmit={(e) => { e.preventDefault(); submitOrder(); }}
                >
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
                    <button
                      type="button"
                      onClick={() => { saveCustomer(); setDrawerStep('cart'); }}
                      className="rounded border px-4 py-2 hover:bg-gray-50"
                    >
                      返回购物车
                    </button>
                    <button
                      type="submit"
                      className="rounded bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 flex-1"
                      disabled={cart.length === 0}
                    >
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
                    <button
                      className="rounded bg-gray-900 hover:bg-black text-white px-4 py-2"
                      onClick={() => { setCartOpen(false); setDrawerStep('cart'); }}
                    >
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

            {/* 底部（仅购物车视图显示） */}
            {drawerStep === 'cart' && (
              <div className="mt-2 px-4 py-3 border-t">
                <div className="flex items-center justify-between">
                  <div className="text-gray-600">合计</div>
                  <div className="text-xl font-bold text-gray-900">¥ {money(cartTotal)}</div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={clearCart}
                    className="rounded border px-4 py-2 hover:bg-gray-50"
                    disabled={cart.length === 0}
                  >
                    清空
                  </button>
                  <button
                    onClick={() => setDrawerStep('checkout')}
                    className="rounded bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 flex-1"
                    disabled={cart.length === 0}
                  >
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

