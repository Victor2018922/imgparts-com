'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

// ---------- 类型 ----------
type ApiItem = {
  num: string;
  title?: string;
  oe?: string;
  brand?: string;
  model?: string;
  year?: string;
  price?: number | string;
  stock?: number | string;
  images?: string[]; // 服务器是字符串时，下面会做兼容
};

type ApiResp = {
  content: any[];      // 后端实际字段
  totalElements?: number;
  total?: number;      // 兼容另一种字段名
};

// ---------- 工具 ----------
function money(n: number) {
  if (!isFinite(n)) return '-';
  return n.toFixed(2);
}

function parsePrice(v: any): number {
  const s = String(v ?? '').replace(/[^\d.]/g, '');
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

function splitImages(s: string | string[] | undefined | null): string[] {
  if (!s) return [];
  if (Array.isArray(s)) return s.filter(Boolean);
  return s
    .split(/[|,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function safeGet<T>(key: string, def: T): T {
  try {
    if (typeof window === 'undefined') return def;
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : def;
  } catch {
    return def;
  }
}

function safeSet<T>(key: string, val: T) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(val));
    }
  } catch {}
}

// ---------- 本地存储键（与详情页共用） ----------
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

// ---------- 列表页组件 ----------
export default function StockListPage() {
  // 分页 & 列表
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<ApiItem[]>([]);
  const [total, setTotal] = useState(0);

  // 购物车与结算（与详情页同逻辑/同键名）
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(safeGet<CartItem[]>(CART_KEY, []));
  const cartCount = useMemo(() => cart.reduce((s, x) => s + x.qty, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((s, x) => s + x.price * x.qty, 0), [cart]);

  type Step = 'cart' | 'checkout' | 'success';
  const [step, setStep] = useState<Step>('cart');

  // 结算信息
  const savedCustomer = safeGet<any>(CUSTOMER_KEY, null);
  const [name, setName] = useState(savedCustomer?.name || '');
  const [phone, setPhone] = useState(savedCustomer?.phone || '');
  const [email, setEmail] = useState(savedCustomer?.email || '');
  const [country, setCountry] = useState(savedCustomer?.country || '');
  const [city, setCity] = useState(savedCustomer?.city || '');
  const [address, setAddress] = useState(savedCustomer?.address || '');
  const [postcode, setPostcode] = useState(savedCustomer?.postcode || '');
  const [note, setNote] = useState('');
  const [orderId, setOrderId] = useState<string | null>(null);
  // ✅ 锁定应付合计，避免清空购物车后显示 0
  const [paidTotal, setPaidTotal] = useState<number>(0);

  // 加载列表
  useEffect(() => {
    const fetchList = async () => {
      setLoading(true);
      try {
        const url = `https://niuniuparts.com:6001/scm-product/v1/stock2?size=${size}&page=${page}`;
        const res = await fetch(url, { cache: 'no-store' });
        const data: ApiResp = await res.json();

        const rawArr = Array.isArray((data as any)?.content) ? (data as any).content : (data as any) || [];
        const mapped: ApiItem[] = rawArr.map((it: any) => {
          // 后端字段名兼容
          const images = splitImages(it.images ?? it.image);
          const price = it.price ?? it.unitPrice ?? it.unit_price ?? it.amount;
          return {
            num: String(it.num ?? it.code ?? it.id ?? ''),
            title: String(it.title ?? it.name ?? '').trim(),
            oe: it.oe ?? it.oeNo ?? it.oe_num ?? '',
            brand: it.brand ?? it.brandName ?? '',
            model: it.model ?? '',
            year: it.year ?? '',
            price,
            stock: it.stock ?? it.qty ?? '',
            images,
          };
        });

        setList(mapped);
        setTotal(
          typeof data?.totalElements === 'number'
            ? data.totalElements
            : typeof data?.total === 'number'
            ? data.total
            : 500 // 保底
        );

        // 写入给详情页使用的“同页导航”数据
        safeSet('stock:list', mapped);
        safeSet('stock:lastPage', { list: mapped, page, size });

      } catch (err) {
        console.error(err);
        setList([]);
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, [page, size]);

  // 购物车 CRUD（与详情页一致）
  const saveCart = (items: CartItem[]) => {
    setCart(items);
    safeSet(CART_KEY, items);
  };
  const addToCart = (it: ApiItem) => {
    const priceNum = parsePrice(it.price);
    const img = (it.images && it.images[0]) || null;
    const item: CartItem = {
      num: it.num,
      title: it.title || it.num,
      price: priceNum,
      qty: 1,
      img,
      oe: it.oe,
      brand: it.brand,
      model: it.model,
    };
    const copy = [...cart];
    const idx = copy.findIndex((x) => x.num === item.num);
    if (idx >= 0) copy[idx].qty += 1;
    else copy.push(item);
    saveCart(copy);
    setCartOpen(true);
    setStep('cart');
  };
  const updateQty = (numKey: string, newQty: number) => {
    const copy = cart.map((x) => (x.num === numKey ? { ...x, qty: Math.max(1, Math.floor(newQty)) } : x));
    saveCart(copy);
  };
  const removeItem = (numKey: string) => {
    const copy = cart.filter((x) => x.num !== numKey);
    saveCart(copy);
  };
  const clearCart = () => saveCart([]);

  // 下单
  const saveCustomer = () => {
    safeSet(CUSTOMER_KEY, { name, phone, email, country, city, address, postcode });
  };
  const submitOrder = () => {
    if (!name.trim()) return alert('请填写姓名');
    if (!phone.trim()) return alert('请填写手机');
    if (!address.trim()) return alert('请填写地址');
    if (cart.length === 0) return alert('购物车为空');

    const payable = cartTotal; // ✅ 锁定
    setPaidTotal(payable);

    const id = 'IP' + Date.now();
    const order = {
      id,
      items: cart,
      total: payable,
      customer: { name, phone, email, country, city, address, postcode, note },
      createdAt: new Date().toISOString(),
    };

    safeSet(ORDER_LAST_KEY, order);
    const all = safeGet<any[]>(ORDERS_KEY, []);
    all.unshift(order);
    safeSet(ORDERS_KEY, all);

    clearCart();
    saveCustomer();
    setOrderId(id);
    setStep('success');
  };

  // ------ 视图 ------
  const pageCount = Math.max(1, Math.ceil(total / size));
  const canPrev = page > 0;
  const canNext = page < pageCount - 1;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">库存预览</h1>
        <a
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
          href={`https://niuniuparts.com:6001/scm-product/v1/stock2/excel?size=${size}&page=${page}`}
          target="_blank"
          rel="noreferrer"
        >
          下载库存 Excel
        </a>
      </div>

      {/* 分页 */}
      <div className="mt-4 flex items-center gap-3">
        <button
          disabled={!canPrev}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="px-3 py-2 rounded border disabled:opacity-40"
        >
          上一页
        </button>
        <div>
          第 <b>{page + 1}</b> / {pageCount} 页
        </div>
        <button
          disabled={!canNext}
          onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          className="px-3 py-2 rounded border disabled:opacity-40"
        >
          下一页
        </button>

        <span className="ml-4">每页</span>
        <select
          value={size}
          onChange={(e) => { setPage(0); setSize(parseInt(e.target.value, 10)); }}
          className="border rounded px-2 py-1"
        >
          {[20, 30, 40, 50].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span>条</span>
      </div>

      {/* 列表 */}
      <div className="mt-6">
        {loading ? (
          <div className="text-gray-500">加载中…</div>
        ) : list.length === 0 ? (
          <div className="text-gray-500">暂无数据</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.map((it, idx) => {
              const img = (it.images && it.images[0]) || '';
              const priceNum = parsePrice(it.price);
              const params = new URLSearchParams();
              params.set('idx', String(idx));
              if (it.title) params.set('title', String(it.title));
              if (it.oe) params.set('oe', String(it.oe));
              if (it.brand) params.set('brand', String(it.brand));
              if (it.model) params.set('model', String(it.model));
              if (it.year) params.set('year', String(it.year));
              if (it.price != null) params.set('price', String(it.price));
              if (it.stock != null) params.set('stock', String(it.stock));
              if (it.images?.length) params.set('images', it.images.join('|'));

              return (
                <div key={it.num} className="border rounded p-3 flex flex-col">
                  <div className="aspect-[4/3] bg-gray-50 rounded flex items-center justify-center overflow-hidden">
                    {img ? (
                      <img src={img} alt={it.title || it.num} className="max-w-full max-h-full object-contain" loading="lazy" />
                    ) : (
                      <span className="text-gray-400">无图</span>
                    )}
                  </div>

                  <div className="mt-3 flex-1">
                    <div className="font-medium line-clamp-2" title={it.title || it.num}>
                      {it.title || it.num}
                    </div>
                    <div className="mt-1 text-sm text-gray-600">Brand: {it.brand || '-'}</div>
                    <div className="text-sm text-gray-600">OE: {it.oe || '-'}</div>
                    <div className="text-sm text-gray-600">Num: {it.num}</div>
                    <div className="mt-1 text-emerald-700 font-semibold">¥ {money(priceNum)}</div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => addToCart(it)}
                      className="rounded bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2"
                    >
                      加入购物车
                    </button>
                    <Link
                      href={`/stock/${encodeURIComponent(it.num)}?${params.toString()}`}
                      className="rounded border px-3 py-2 hover:bg-gray-50"
                    >
                      查看详情
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 悬浮购物车入口 */}
      <button
        onClick={() => { setCartOpen(true); setStep('cart'); }}
        className="fixed right-4 bottom-4 z-40 rounded-full shadow-lg bg-gray-900 text-white px-4 py-3"
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
                              <img src={it.img} alt={it.title} className="w-full h-full object-contain" />
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
                    <button type="button" onClick={() => { safeSet(CUSTOMER_KEY, { name, phone, email, country, city, address, postcode }); setStep('cart'); }} className="rounded border px-4 py-2 hover:bg-gray-50">
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
