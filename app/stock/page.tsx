'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';

/** ------------- 小工具 ------------- */
type AnyObj = Record<string, any>;

function toNum(v: any, dft = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dft;
}
function pick(obj: AnyObj | null | undefined, keys: string[], dft: any = '') {
  for (const k of keys) {
    const v = (obj as any)?.[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return dft;
}
function extractImages(fromObj: AnyObj | null): string[] {
  const out: string[] = [];
  const push = (s?: string) => {
    if (!s) return;
    const t = String(s).trim();
    if (!t || t === 'null' || t === 'undefined') return;
    if (/^https?:\/\//i.test(t)) out.push(t);
  };
  if (fromObj) {
    const direct = pick(fromObj, ['images', 'imageList', 'imgs'], null);
    if (Array.isArray(direct)) direct.forEach((x: any) => push(x));
    else if (typeof direct === 'string') direct.split(/[|,;\s]+/g).forEach(push);

    Object.keys(fromObj).forEach((k) => {
      if (/^(img|image|pic|photo)\d*$/i.test(k)) push(fromObj[k]);
    });
    push(pick(fromObj, ['image', 'img', 'cover', 'pic', 'picUrl', 'imageUrl', 'url'], ''));
  }
  return Array.from(new Set(out)).slice(0, 12);
}

/** ------------- 多源回退图片 ------------- */
function wsrv1(url: string, w = 800) {
  const clean = url.replace(/^https?:\/\//, '');
  return `https://wsrv.nl/?url=${encodeURIComponent(clean)}&w=${w}&q=80&output=webp`;
}
function wsrv2(url: string, w = 800) {
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${w}&q=80&output=webp`;
}
function useImgCandidates(src: string, w: number) {
  return useMemo(() => {
    const arr = [wsrv1(src, w), wsrv2(src, w), src].filter(Boolean);
    return Array.from(new Set(arr));
  }, [src, w]);
}
function MultiImg({
  src,
  w = 820,
  alt = '',
  className = '',
}: {
  src: string;
  w?: number;
  alt?: string;
  className?: string;
}) {
  const cands = useImgCandidates(src, w);
  const [i, setI] = useState(0);
  const cur = cands[i];

  if (!src) {
    return (
      <div className={`flex items-center justify-center text-slate-400 ${className}`}>
        无图
      </div>
    );
  }

  return (
    <img
      src={cur}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      loading="lazy"
      decoding="async"
      onError={() => {
        if (i < cands.length - 1) setI(i + 1);
      }}
    />
  );
}

/** ------------- 购物车 & 结算 ------------- */
type CartItem = { num: string; title: string; price: number; image?: string; qty: number };
type OrderContact = {
  country: string;
  city: string;
  address: string;
  postcode: string;
  email: string;
  receiver: string; // 收件人/公司
};

const CART_KEY = 'imgparts_cart_v2';
const CONTACT_KEY = 'imgparts_checkout_contact_v1';

function useCart() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<'cart' | 'checkout' | 'done'>('cart');
  const [items, setItems] = useState<CartItem[]>([]);
  const [orderId, setOrderId] = useState('');
  const [contact, setContact] = useState<OrderContact>({
    country: '',
    city: '',
    address: '',
    postcode: '',
    email: '',
    receiver: '',
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (raw) setItems(JSON.parse(raw));
      const cRaw = localStorage.getItem(CONTACT_KEY);
      if (cRaw) setContact({ ...contact, ...JSON.parse(cRaw) });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);
  useEffect(() => {
    try {
      localStorage.setItem(CONTACT_KEY, JSON.stringify(contact));
    } catch {}
  }, [contact]);

  const total = useMemo(() => items.reduce((s, x) => s + x.price * x.qty, 0), [items]);

  const add = useCallback((it: Omit<CartItem, 'qty'>, qty = 1) => {
    setItems((prev) => {
      const i = prev.findIndex((x) => x.num === it.num);
      if (i > -1) {
        const next = [...prev];
        next[i] = { ...next[i], qty: Math.min(999, next[i].qty + qty) };
        return next;
      }
      return [...prev, { ...it, qty: Math.max(1, qty) }];
    });
    setOpen(true);
  }, []);
  const setQty = useCallback((numNo: string, qty: number) => {
    setItems((prev) => prev.map((x) => (x.num === numNo ? { ...x, qty: Math.max(1, qty) } : x)));
  }, []);
  const remove = useCallback((numNo: string) => setItems((prev) => prev.filter((x) => x.num !== numNo)), []);
  const clear = useCallback(() => setItems([]), []);

  const goCheckout = useCallback(() => {
    if (items.length === 0) return;
    setPhase('checkout');
  }, [items.length]);

  const placeOrder = useCallback(() => {
    // 简单校验
    const err: string[] = [];
    if (!contact.country.trim()) err.push('国家/地区');
    if (!contact.city.trim()) err.push('城市');
    if (!contact.address.trim()) err.push('详细地址');
    if (!contact.postcode.trim()) err.push('邮编');
    if (!/^\S+@\S+\.\S+$/.test(contact.email)) err.push('邮箱');
    if (!contact.receiver.trim()) err.push('收件人/公司');
    if (err.length) {
      alert(`请完善：${err.join('、')}`);
      return;
    }
    const id = 'IP' + String(Date.now());
    setOrderId(id);
    setPhase('done');
    clear();
  }, [clear, contact]);

  return {
    open,
    setOpen,
    phase,
    setPhase,
    items,
    add,
    setQty,
    remove,
    clear,
    total,
    goCheckout,
    placeOrder,
    orderId,
    contact,
    setContact,
  };
}

function CartButton({ cart }: { cart: ReturnType<typeof useCart> }) {
  return (
    <button
      onClick={() => {
        cart.setOpen(true);
        cart.setPhase('cart');
      }}
      className="fixed z-40 right-6 bottom-6 rounded-full bg-emerald-600 text-white px-4 py-3 shadow-lg hover:bg-emerald-500"
    >
      🛒 购物车（{cart.items.reduce((s, x) => s + x.qty, 0)}）
    </button>
  );
}

function CartDrawer({ cart }: { cart: ReturnType<typeof useCart> }) {
  return (
    <>
      <div
        className={`fixed z-50 top-0 right-0 h-full w-[380px] bg-white shadow-2xl transition-transform duration-200 ${
          cart.open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* 顶栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold">
            {cart.phase === 'cart' ? '购物车' : cart.phase === 'checkout' ? '填写订单信息' : '下单成功'}
          </div>
          <button onClick={() => cart.setOpen(false)} className="text-slate-500 hover:text-slate-700">
            ✕
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4 overflow-auto h-[calc(100%-160px)]">
          {cart.phase === 'cart' && (
            <>
              {cart.items.length === 0 ? (
                <div className="text-slate-400 text-sm">购物车是空的～</div>
              ) : (
                cart.items.map((it) => (
                  <div key={it.num} className="flex gap-3 items-center mb-3">
                    <MultiImg src={it.image || ''} w={240} className="w-16 h-16 object-contain rounded bg-slate-50" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm">{it.title}</div>
                      <div className="text-emerald-600 font-semibold">￥{it.price.toFixed(2)}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <button className="px-2 border rounded" onClick={() => cart.setQty(it.num, it.qty - 1)}>
                          -
                        </button>
                        <input
                          className="w-12 text-center border rounded py-0.5"
                          value={it.qty}
                          onChange={(e) => cart.setQty(it.num, Number(e.target.value || 1))}
                        />
                        <button className="px-2 border rounded" onClick={() => cart.setQty(it.num, it.qty + 1)}>
                          +
                        </button>
                      </div>
                    </div>
                    <button className="text-slate-400 hover:text-rose-600" onClick={() => cart.remove(it.num)}>
                      删除
                    </button>
                  </div>
                ))
              )}
            </>
          )}

          {cart.phase === 'checkout' && (
            <div className="space-y-3">
              <Input label="国家/地区" value={cart.contact.country} onChange={(v) => cart.setContact({ ...cart.contact, country: v })} />
              <Input label="城市" value={cart.contact.city} onChange={(v) => cart.setContact({ ...cart.contact, city: v })} />
              <Input label="详细地址" value={cart.contact.address} onChange={(v) => cart.setContact({ ...cart.contact, address: v })} />
              <Input label="邮政编码" value={cart.contact.postcode} onChange={(v) => cart.setContact({ ...cart.contact, postcode: v })} />
              <Input label="邮箱" value={cart.contact.email} onChange={(v) => cart.setContact({ ...cart.contact, email: v })} />
              <Input label="收件人/公司" value={cart.contact.receiver} onChange={(v) => cart.setContact({ ...cart.contact, receiver: v })} />
            </div>
          )}

          {cart.phase === 'done' && (
            <div className="space-y-3">
              <div className="text-emerald-600 font-semibold text-lg">订单已提交</div>
              <div className="text-slate-700">订单号：{cart.orderId}</div>
              <div className="text-slate-700">应付合计：￥{cart.total.toFixed(2)}</div>
              <button
                className="border rounded px-3 py-2"
                onClick={() =>
                  navigator.clipboard?.writeText(
                    `订单号：${cart.orderId}\n合计：￥${cart.total.toFixed(2)}\n收件人/公司：${cart.contact.receiver}\n国家：${cart.contact.country}\n城市：${cart.contact.city}\n地址：${cart.contact.address}\n邮编：${cart.contact.postcode}\n邮箱：${cart.contact.email}`
                  )
                }
              >
                复制订单信息
              </button>
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="border-t p-4">
          {cart.phase === 'cart' && (
            <>
              <div className="flex justify-between mb-3">
                <span className="text-slate-500">合计</span>
                <span className="text-lg font-bold text-emerald-600">￥{cart.total.toFixed(2)}</span>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 border rounded px-3 py-2" onClick={cart.clear}>
                  清空
                </button>
                <button className="flex-1 bg-emerald-600 text-white rounded px-3 py-2 hover:bg-emerald-500" onClick={cart.goCheckout}>
                  去结算
                </button>
              </div>
            </>
          )}
          {cart.phase === 'checkout' && (
            <div className="flex gap-2">
              <button className="flex-1 border rounded px-3 py-2" onClick={() => cart.setPhase('cart')}>
                返回购物车
              </button>
              <button className="flex-1 bg-emerald-600 text-white rounded px-3 py-2 hover:bg-emerald-500" onClick={cart.placeOrder}>
                提交订单
              </button>
            </div>
          )}
          {cart.phase === 'done' && (
            <button className="w-full border rounded px-3 py-2" onClick={() => cart.setPhase('cart')}>
              继续购物
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="text-sm text-slate-600 mb-1">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded px-3 py-2"
      />
    </label>
  );
}

/** ------------- 列表页 ------------- */
export default function StockListPage() {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [list, setList] = useState<AnyObj[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const cart = useCart();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://niuniuparts.com:6001/scm-product/v1/stock2?size=${size}&page=${page}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      const arr: AnyObj[] = data?.content || data?.list || data?.rows || data?.data || [];
      setList(arr);
      setTotalPages(Math.max(1, toNum(data?.totalPages ?? data?.pages ?? 1, 1)));
    } catch {
      setList([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, size]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-4 mb-6">
        <button className="border rounded px-3 py-1.5" onClick={() => setPage((p) => Math.max(0, p - 1))}>
          上一页
        </button>
        <div>
          第 <span className="font-semibold">{page + 1}</span> / {totalPages} 页
        </div>
        <button className="border rounded px-3 py-1.5" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>
          下一页
        </button>

        <div className="ml-auto flex items-center gap-2">
          每页
          <select
            className="border rounded px-2 py-1"
            value={size}
            onChange={(e) => {
              setPage(0);
              setSize(Number(e.target.value));
            }}
          >
            {[20, 30, 40].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          条
        </div>
      </div>

      {loading ? (
        <div className="text-slate-500">加载中…</div>
      ) : list.length === 0 ? (
        <div className="text-slate-500">暂无数据</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {list.map((it, idx) => {
            const num = String(pick(it, ['num', 'Num', 'code', 'partNo'], ''));
            const title = String(pick(it, ['product', 'title', 'name'], ''));
            const oe = String(pick(it, ['oe', 'OE'], ''));
            const brand = String(pick(it, ['brand', 'Brand'], ''));
            const price = toNum(pick(it, ['price', 'Price'], 0), 0);
            const imgs = extractImages(it);
            const first = imgs[0] || '';

            return (
              <div key={num || idx} className="border rounded-xl overflow-hidden bg-white">
                <div className="aspect-[4/3] bg-slate-50 flex items-center justify-center">
                  {first ? (
                    <MultiImg src={first} w={1280} className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-slate-400">无图</div>
                  )}
                </div>

                <div className="p-4 space-y-1">
                  <div className="font-medium line-clamp-2">{title}</div>
                  <div className="text-sm text-slate-600">Brand: {brand || '-'}</div>
                  <div className="text-sm text-slate-600">OE: {oe || '-'}</div>
                  <div className="text-sm text-slate-600">Num: {num || '-'}</div>
                  <div className="text-emerald-600 font-semibold mt-1">¥ {price.toFixed(2)}</div>

                  <div className="mt-3 flex gap-2">
                    <button
                      className="flex-1 bg-emerald-600 text-white rounded px-3 py-2 hover:bg-emerald-500"
                      onClick={() => cart.add({ num, title: title || num, price, image: first }, 1)}
                    >
                      加入购物车
                    </button>
                    <Link
                      className="flex-1 border rounded px-3 py-2 text-center hover:bg-slate-50"
                      href={`/stock/${encodeURIComponent(num)}?title=${encodeURIComponent(title)}&oe=${encodeURIComponent(
                        oe
                      )}&brand=${encodeURIComponent(brand)}&price=${price}&image=${encodeURIComponent(first)}&idx=${page * size + idx}`}
                    >
                      查看详情
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CartButton cart={cart} />
      <CartDrawer cart={cart} />
    </div>
  );
}
