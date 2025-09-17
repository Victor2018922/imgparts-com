'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';

type RawItem = {
  num: string;
  title?: string;
  oe?: string;
  brand?: string;
  model?: string;
  year?: string;
  price?: number | string;
  stock?: number | string;
  images?: string[];
};

// 读取浏览器 localStorage（SSR 安全）
function safeLoad<T>(key: string, df: T): T {
  try {
    if (typeof window === 'undefined') return df;
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : df;
  } catch {
    return df;
  }
}

// 同时兼容两种历史键名：'stock:lastPage' 与 'stock:list'
function loadPageList(): RawItem[] {
  const a = safeLoad<{ list?: RawItem[] }>('stock:lastPage', {} as any);
  if (Array.isArray(a?.list)) return a.list!;
  const b = safeLoad<RawItem[]>('stock:list', []);
  return Array.isArray(b) ? b : [];
}

// 读取 URLSearchParams（兼容某些环境下 useSearchParams 可能异常）
function useSearchGetter() {
  const sp = useSearchParams();
  return (key: string): string | null => {
    try {
      const v = (sp as any)?.get?.(key);
      if (v != null) return v;
    } catch {}
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get(key);
    }
    return null;
  };
}

// 把 "a|b,c" 这类分隔字符串拆成数组（兼容 | 或 ,）
function splitImages(s: string): string[] {
  return s
    .split(/[|,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/* ----------------- 购物车 / 订单 存储键 ----------------- */
type CartItem = {
  num: string;
  title: string;
  price: number;
  qty: number;
  img?: string | null;
  oe?: string;
  brand?: string;
  model?: string;
};

const CART_KEY = 'imgparts_cart_v1';
const CUSTOMER_KEY = 'imgparts_customer_v1';
const ORDER_LAST_KEY = 'imgparts_last_order_v1';
const ORDERS_KEY = 'imgparts_orders_v1';

function loadCart(): CartItem[] {
  try { return safeLoad<CartItem[]>(CART_KEY, []); } catch { return []; }
}
function saveCart(items: CartItem[]) {
  try { if (typeof window !== 'undefined') localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch {}
}
function money(n: number) {
  if (!isFinite(n)) return '-';
  return n.toFixed(2);
}
function parsePrice(v: any): number {
  const s = String(v ?? '').replace(/[^\d.]/g, '');
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

export default function StockDetailPage() {
  // 宽松获取路由参数，避免 TS 报错
  const params = useParams() as any;
  const num: string = String(params?.num ?? '');

  const getQuery = useSearchGetter();
  const router = useRouter();

  // 图片当前索引
  const [curIdx, setCurIdx] = useState<number>(0);
  // 当前详情对象
  const [meta, setMeta] = useState<RawItem | null>(null);
  // 同页导航索引（来自列表点击时带过来的 idx；直达则为 -1）
  const [navIdx, setNavIdx] = useState<number>(() => {
    const v = Number(getQuery('idx') ?? -1);
    return Number.isFinite(v) ? v : -1;
  });
  // 当前页的列表（供“上一条/下一条”使用）
  const [pageList, setPageList] = useState<RawItem[]>([]);

  // 购物车与结算抽屉
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  type Step = 'cart' | 'checkout' | 'success';
  const [step, setStep] = useState<Step>('cart');
  const cartCount = useMemo(() => cart.reduce((s, x) => s + x.qty, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((s, x) => s + x.price * x.qty, 0), [cart]);

  // 购买数量
  const [qty, setQty] = useState(1);

  // 结算信息
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [note, setNote] = useState('');
  const [orderId, setOrderId] = useState<string | null>(null);

  // ✅ 新增：下单成功页展示的应付合计（下单前锁定，避免清空购物车后显示 0）
  const [paidTotal, setPaidTotal] = useState<number>(0);

  useEffect(() => {
    // 缓存的列表
    setPageList(loadPageList());
    // 缓存的购物车
    setCart(loadCart());
    // 客户信息
    try {
      const saved = safeLoad<any>(CUSTOMER_KEY, null);
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
  }, []);

  // 初始兜底：从 URL 参数拼一个对象
  const urlFallback = useMemo<RawItem>(() => {
    const imgsParam = getQuery('images') ?? getQuery('image') ?? '';
    const images = imgsParam ? splitImages(imgsParam) : [];
    const priceRaw = getQuery('price');
    return {
      num,
      title: getQuery('title') ?? '',
      oe: getQuery('oe') ?? '',
      brand: getQuery('brand') ?? '',
      model: getQuery('model') ?? '',
      year: getQuery('year') ?? '',
      price: priceRaw ?? '',
      stock: getQuery('stock') ?? '',
      images,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [num]);

  useEffect(() => {
    // 列表里找当前 num（大小写无关）
    const list = loadPageList();
    setPageList(list);
    const found =
      list.find((x: any) => String(x?.num ?? '').toLowerCase() === String(num).toLowerCase()) ||
      null;

    // 导航索引（优先 URL，其次列表位置）
    if (navIdx === -1) {
      const idx = list.findIndex(
        (x: any) => String(x?.num ?? '').toLowerCase() === String(num).toLowerCase()
      );
      setNavIdx(idx >= 0 ? idx : -1);
    }

    setMeta(found ?? urlFallback);
    setCurIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [num]);

  // 取图片数组（限制 12 张）
  const images = useMemo<string[]>(() => {
    const arr = meta?.images ?? [];
    return Array.isArray(arr) ? arr.slice(0, 12) : [];
  }, [meta]);

  // 上一条 / 下一条
  const goto = (dir: -1 | 1) => {
    if (!pageList.length) return;
    const cur = navIdx >= 0 ? navIdx : pageList.findIndex((x) => x.num === num);
    const next = cur + dir;
    if (next < 0 || next >= pageList.length) return;
    const it = pageList[next];
    const params = new URLSearchParams();
    params.set('idx', String(next));
    if (it.title) params.set('title', String(it.title));
    if (it.oe) params.set('oe', String(it.oe));
    if (it.brand) params.set('brand', String(it.brand));
    if (it.model) params.set('model', String(it.model));
    if (it.year) params.set('year', String(it.year));
    if (it.price != null) params.set('price', String(it.price));
    if (it.stock != null) params.set('stock', String(it.stock));
    if (it.images?.length) params.set('images', it.images.join('|'));
    router.push(`/stock/${encodeURIComponent(it.num)}?${params.toString()}`);
    setStep('cart'); // 切换产品时回到购物车页
  };

  /* ----------------- 购物车操作 ----------------- */
  const addToCart = () => {
    if (!meta) return;
    const priceNum = parsePrice(meta.price);
    const firstImg = images[0] ?? null;
    const item: CartItem = {
      num: meta.num,
      title: meta.title || meta.num,
      price: priceNum,
      qty: Math.max(1, Math.floor(qty)),
      img: firstImg,
      oe: meta.oe,
      brand: meta.brand,
      model: meta.model,
    };
    const copy = [...cart];
    const i = copy.findIndex((x) => x.num === item.num);
    if (i >= 0) copy[i].qty += item.qty;
    else copy.push(item);
    setCart(copy);
    saveCart(copy);
    setCartOpen(true);
    setStep('cart');
  };

  const updateQty = (numKey: string, newQty: number) => {
    const copy = cart.map((x) => (x.num === numKey ? { ...x, qty: Math.max(1, Math.floor(newQty)) } : x));
    setCart(copy); saveCart(copy);
  };
  const removeItem = (numKey: string) => {
    const copy = cart.filter((x) => x.num !== numKey);
    setCart(copy); saveCart(copy);
  };
  const clearCart = () => { setCart([]); saveCart([]); };

  /* ----------------- 结算流程 ----------------- */
  const saveCustomer = () => {
    try {
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ name, phone, email, country, city, address, postcode }));
    } catch {}
  };

  const submitOrder = () => {
    if (!name.trim()) return alert('请填写姓名');
    if (!phone.trim()) return alert('请填写手机');
    if (!address.trim()) return alert('请填写地址');
    if (cart.length === 0) return alert('购物车为空');

    // ✅ 先锁定应付合计，随后再清空购物车，避免成功页显示 0
    const payable = cartTotal;
    setPaidTotal(payable);

    const id = 'IP' + Date.now();
    const order = {
      id,
      items: cart,
      total: payable, // 保存的是锁定后的金额
      customer: { name, phone, email, country, city, address, postcode, note },
      createdAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(ORDER_LAST_KEY, JSON.stringify(order));
      const list = safeLoad<any[]>(ORDERS_KEY, []);
      list.unshift(order);
      localStorage.setItem(ORDERS_KEY, JSON.stringify(list));
    } catch {}

    clearCart();
    saveCustomer();
    setOrderId(id);
    setStep('success');
  };

  const priceDisplay = useMemo(() => money(parsePrice(meta?.price)), [meta]);

  return (
    <div className="p-6">
      <button
        className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-800"
        onClick={() => router.push('/stock')}
      >
        ← 返回列表
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* 左侧：大图 + 缩略图 */}
        <div>
          <div className="w-full aspect-[4/3] bg-gray-50 border rounded flex items-center justify-center overflow-hidden">
            {images.length ? (
              <img
                src={images[curIdx]}
                alt={meta?.title ?? meta?.num ?? ''}
                className="max-w-full max-h-full object-contain"
                loading="eager"
                decoding="async"
                onClick={() => { if (images[curIdx]) window.open(images[curIdx], '_blank'); }}
              />
            ) : (
              <span className="text-gray-400">无图</span>
            )}
          </div>

          {/* 缩略图（最多 12 张） */}
          {images.length > 0 && (
            <div className="mt-4 flex gap-2 overflow-x-auto">
              {images.map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  onClick={() => setCurIdx(i)}
                  className={`shrink-0 w-20 h-16 border rounded overflow-hidden ${
                    i === curIdx ? 'ring-2 ring-blue-500' : ''
                  }`}
                  title={`预览 ${i + 1}`}
                >
                  <img
                    src={src}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    alt={`thumb-${i + 1}`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 右侧：详情 + 购买区 + 导航 */}
        <div>
          <h2 className="text-xl font-semibold mb-4">产品详情</h2>
          <ul className="space-y-3 text-gray-700">
            <li><span className="inline-block w-20 text-gray-500">Num:</span> {meta?.num ?? '-'}</li>
            <li><span className="inline-block w-20 text-gray-500">OE:</span> {meta?.oe ?? '-'}</li>
            <li><span className="inline-block w-20 text-gray-500">Brand:</span> {meta?.brand ?? '-'}</li>
            <li><span className="inline-block w-20 text-gray-500">Model:</span> {meta?.model ?? '-'}</li>
            <li><span className="inline-block w-20 text-gray-500">Year:</span> {meta?.year ?? '-'}</li>
            <li><span className="inline-block w-20 text-gray-500">Price:</span> ¥ {priceDisplay}</li>
            <li><span className="inline-block w-20 text-gray-500">Stock:</span> {meta?.stock ?? '-'}</li>
          </ul>

          {/* 购买区 */}
          <div className="mt-5 flex items-center gap-3">
            <div className="flex items-center border rounded overflow-hidden">
              <button className="px-3 py-2 hover:bg-gray-50" onClick={() => setQty((v) => Math.max(1, v - 1))}>-</button>
              <input className="w-14 text-center" value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || '1', 10)))} />
              <button className="px-3 py-2 hover:bg-gray-50" onClick={() => setQty((v) => v + 1)}>+</button>
            </div>
            <button onClick={addToCart} className="rounded bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2">
              加入购物车
            </button>
            <button onClick={() => { setCartOpen(true); setStep('cart'); }} className="rounded border px-4 py-2 hover:bg-gray-50">
              打开购物车 {cartCount > 0 ? `(${cartCount})` : ''}
            </button>
          </div>

          {/* 上一条 / 下一条 */}
          <div className="flex gap-3 mt-6">
            <button
              className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
              onClick={() => goto(-1)}
              disabled={!pageList.length || (navIdx <= 0 && navIdx !== -1)}
            >
              上一条
            </button>
            <button
              className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
              onClick={() => goto(1)}
              disabled={!pageList.length || (navIdx >= pageList.length - 1 && navIdx !== -1)}
            >
              下一条
            </button>
          </div>
        </div>
      </div>

      {/* 悬浮购物车按钮（移动端友好） */}
      <button
        onClick={() => { setCartOpen(true); setStep('cart'); }}
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
                {step === 'cart' && '购物车'}
                {step === 'checkout' && '填写收件信息'}
                {step === 'success' && '下单成功'}
              </div>
              <button className="px-2 py-1 rounded border hover:bg-gray-50" onClick={() => setCartOpen(false)}>关闭</button>
            </div>

            <div className="p-4 overflow-auto flex-1">
              {step === 'cart' && (
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
                                className="w-full h-full object-contain"
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

              {step === 'checkout' && (
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
                  </div>

                  <div className="mt-4 border-t pt-3">
                    <div className="flex items-center justify-between text-lg">
                      <span>应付合计</span>
                      <strong>¥ {money(cartTotal)}</strong>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button type="button" onClick={() => { saveCustomer(); setStep('cart'); }} className="rounded border px-4 py-2 hover:bg-gray-50">
                      返回购物车
                    </button>
                    <button type="submit" className="rounded bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 flex-1" disabled={cart.length === 0}>
                      提交订单
                    </button>
                  </div>
                </form>
              )}

              {step === 'success' && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600">下单成功</div>
                  <div className="mt-2 text-gray-600">订单号：{orderId}</div>
                  {/* ✅ 成功页显示锁定后的金额 */}
                  <div className="mt-2 text-gray-600">应付合计：¥ {money(paidTotal)}</div>
                  <div className="mt-6 flex items-center gap-2 justify-center">
                    <button className="rounded bg-gray-900 hover:bg-black text-white px-4 py-2" onClick={() => { setCartOpen(false); setStep('cart'); }}>
                      继续购物
                    </button>
                    <button
                      className="rounded border px-4 py-2 hover:bg-gray-50"
                      onClick={() => {
                        try {
                          const last = localStorage.getItem(ORDER_LAST_KEY) || '';
                          (navigator.clipboard && (navigator as any).clipboard?.writeText)
                            ? navigator.clipboard.writeText(last)
                            : null;
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

            {/* 抽屉底部：合计 & 去结算 */}
            {step === 'cart' && (
              <div className="mt-2 px-4 py-3 border-t">
                <div className="flex items-center justify-between">
                  <div className="text-gray-600">合计</div>
                  <div className="text-xl font-bold text-gray-900">¥ {money(cartTotal)}</div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={clearCart} className="rounded border px-4 py-2 hover:bg-gray-50" disabled={cart.length === 0}>清空</button>
                  <button onClick={() => setStep('checkout')} className="rounded bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 flex-1" disabled={cart.length === 0}>
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

