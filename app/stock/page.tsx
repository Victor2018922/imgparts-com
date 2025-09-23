'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

/* ----------------- 工具 ----------------- */
type AnyObj = Record<string, any>;

function cdn(url: string, w = 800, altHost = false) {
  // 统一用 weserv 压缩，并针对 https 源加 ssl: 前缀
  // 失败时在 <img onError> 做级联回退
  try {
    const u = new URL(url);
    const host = altHost ? 'https://images.weserv.nl' : 'https://wsrv.nl';
    const bare = `${u.protocol === 'https:' ? 'ssl:' : ''}${u.hostname}${u.pathname}${u.search}`;
    return `${host}/?url=${encodeURIComponent(bare)}&w=${w}&output=webp&q=82`;
  } catch {
    return url;
  }
}

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

function extractImages(fromObj: AnyObj | null | undefined): string[] {
  const out: string[] = [];
  const push = (s?: string) => {
    if (!s || typeof s !== 'string') return;
    const t = s.trim();
    if (!t || t === 'null' || t === 'undefined') return;
    out.push(t);
  };
  if (fromObj) {
    const direct = pick(fromObj, ['images', 'imageList', 'imgs'], null);
    if (Array.isArray(direct)) direct.forEach((x: any) => push(String(x || '')));
    else if (typeof direct === 'string') direct.split(/[|,;\s]+/g).forEach((x) => push(x));

    Object.keys(fromObj).forEach((k) => {
      if (/^(img|image|pic|photo)\d*$/i.test(k)) push(String((fromObj as any)[k] || ''));
    });

    push(pick(fromObj, ['image', 'img', 'cover', 'pic', 'picUrl', 'imageUrl', 'url'], ''));
  }
  return Array.from(new Set(out.filter((x) => /^https?:\/\//i.test(x)))).slice(0, 12);
}

/* ----------------- 购物车（与详情页一致，可共享 localStorage） ----------------- */
type CartLine = { num: string; title: string; price: number; image?: string; qty: number };
type Buyer = {
  recipient: string;
  country: string;
  city: string;
  address: string;
  zip: string;
  email: string;
  phone: string;
};
function useCart() {
  const KEY = 'imgparts_cart_v2';
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CartLine[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  const add = useCallback((it: Omit<CartLine, 'qty'>, qty = 1) => {
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
  const total = useMemo(() => items.reduce((s, x) => s + x.price * x.qty, 0), [items]);
  return { open, setOpen, items, add, setQty, remove, clear, total };
}

function CartButton({ cart }: { cart: ReturnType<typeof useCart> }) {
  return (
    <button
      onClick={() => cart.setOpen(true)}
      className="fixed z-40 right-6 bottom-6 rounded-full bg-emerald-600 text-white px-4 py-3 shadow-lg hover:bg-emerald-500"
    >
      🛒 购物车（{cart.items.reduce((s, x) => s + x.qty, 0)}）
    </button>
  );
}

function CartDrawer({ cart }: { cart: ReturnType<typeof useCart> }) {
  const [showForm, setShowForm] = useState(false);
  const [done, setDone] = useState<{ id: string; total: number } | null>(null);
  const [buyer, setBuyer] = useState<Buyer>({
    recipient: '',
    country: '',
    city: '',
    address: '',
    zip: '',
    email: '',
    phone: '',
  });

  const totalText = `￥${cart.total.toFixed(2)}`;

  const validate = () => {
    const must = ['recipient', 'country', 'city', 'address', 'zip', 'email', 'phone'] as (keyof Buyer)[];
    for (const k of must) if (!buyer[k].trim()) return false;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(buyer.email)) return false;
    if (!/^[0-9+\-\s]{5,20}$/.test(buyer.phone)) return false;
    if (!/^[A-Za-z0-9\-]{3,10}$/.test(buyer.zip)) return false;
    return true;
  };

  const checkout = () => {
    if (cart.items.length === 0) return;
    setShowForm(true);
  };

  const submitOrder = () => {
    if (!validate()) return alert('请完整填写正确信息（包含电话/邮箱/邮编）');
    const id = 'IP' + String(Date.now()).slice(-10);
    setShowForm(false);
    setDone({ id, total: cart.total });
    cart.clear();
  };

  return (
    <>
      <div
        className={`fixed z-50 top-0 right-0 h-full w-[360px] bg-white shadow-2xl transition-transform duration-200 ${
          cart.open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold">购物车</div>
          <button onClick={() => cart.setOpen(false)} className="text-slate-500 hover:text-slate-700">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-3 overflow-auto h-[calc(100%-170px)]">
          {cart.items.length === 0 ? (
            <div className="text-slate-400 text-sm">购物车是空的～</div>
          ) : (
            cart.items.map((it) => {
              const s1 = cdn(it.image || '', 120, false);
              const s2 = cdn(it.image || '', 120, true);
              const raw = it.image || '';
              return (
                <div key={it.num} className="flex gap-3 items-center">
                  <img
                    src={s1}
                    onError={(e) => {
                      const cur = (e.currentTarget as HTMLImageElement).src;
                      if (cur === s1) (e.currentTarget as HTMLImageElement).src = s2;
                      else if (cur === s2) (e.currentTarget as HTMLImageElement).src = raw;
                    }}
                    alt=""
                    className="w-16 h-16 object-contain rounded bg-slate-50"
                  />
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
              );
            })
          )}
        </div>
        <div className="border-t p-4">
          <div className="flex justify-between mb-3">
            <span className="text-slate-500">合计</span>
            <span className="text-lg font-bold text-emerald-600">{totalText}</span>
          </div>
          <div className="flex gap-2">
            <button className="flex-1 border rounded px-3 py-2" onClick={cart.clear}>
              清空
            </button>
            <button className="flex-1 bg-emerald-600 text-white rounded px-3 py-2 hover:bg-emerald-500" onClick={checkout}>
              去结算
            </button>
          </div>
        </div>
      </div>

      {/* 订单信息表单 */}
      {showForm && (
        <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-[520px] shadow-xl">
            <div className="text-center text-lg font-semibold mb-4">填写订单信息</div>
            <div className="grid grid-cols-2 gap-3">
              <input className="border rounded px-3 py-2 col-span-2" placeholder="收件人/公司（必填）"
                value={buyer.recipient} onChange={(e)=>setBuyer({...buyer, recipient:e.target.value})}/>
              <input className="border rounded px-3 py-2" placeholder="国家（必填）"
                value={buyer.country} onChange={(e)=>setBuyer({...buyer, country:e.target.value})}/>
              <input className="border rounded px-3 py-2" placeholder="城市（必填）"
                value={buyer.city} onChange={(e)=>setBuyer({...buyer, city:e.target.value})}/>
              <input className="border rounded px-3 py-2 col-span-2" placeholder="详细地址（必填）"
                value={buyer.address} onChange={(e)=>setBuyer({...buyer, address:e.target.value})}/>
              <input className="border rounded px-3 py-2" placeholder="邮政编码（必填）"
                value={buyer.zip} onChange={(e)=>setBuyer({...buyer, zip:e.target.value})}/>
              <input className="border rounded px-3 py-2" placeholder="邮箱（必填）"
                value={buyer.email} onChange={(e)=>setBuyer({...buyer, email:e.target.value})}/>
              <input className="border rounded px-3 py-2 col-span-2" placeholder="联系电话（必填）"
                value={buyer.phone} onChange={(e)=>setBuyer({...buyer, phone:e.target.value})}/>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="flex-1 border rounded px-3 py-2" onClick={()=>setShowForm(false)}>返回购物车</button>
              <button className="flex-1 bg-emerald-600 text-white rounded px-3 py-2 hover:bg-emerald-500" onClick={submitOrder}>
                提交订单（{totalText}）
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 下单成功 */}
      {done && (
        <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-[420px] shadow-xl">
            <div className="text-center text-emerald-600 text-xl font-bold mb-2">下单成功</div>
            <div className="text-center text-slate-600 mb-2">订单号：{done.id}</div>
            <div className="text-center text-slate-700 mb-6">应付合计：￥{done.total.toFixed(2)}</div>
            <div className="flex gap-2">
              <button className="flex-1 border rounded px-3 py-2" onClick={() => setDone(null)}>
                继续购物
              </button>
              <button
                className="flex-1 bg-slate-900 text-white rounded px-3 py-2"
                onClick={() => {
                  navigator.clipboard?.writeText(`订单号：${done.id}，合计：￥${done.total.toFixed(2)}`);
                  setDone(null);
                }}
              >
                复制订单信息
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ----------------- 列表页 ----------------- */
export default function StockListPage() {
  const router = useRouter();
  const cart = useCart();

  const [page, setPage] = useState(0); // 0-based
  const [size, setSize] = useState(20);
  const [list, setList] = useState<AnyObj[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let stop = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`https://niuniuparts.com:6001/scm-product/v1/stock2?size=${size}&page=${page}`, { cache: 'no-store' });
        const data = await res.json();
        const rows: AnyObj[] = data?.content || data?.list || data?.rows || data?.data || [];
        if (!stop) {
          setList(rows);
          setTotalPages(toNum(data?.totalPages ?? data?.pages ?? 1, 1));
        }
      } catch {
        if (!stop) {
          setList([]);
          setTotalPages(1);
        }
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, [page, size]);

  const goDetail = (it: AnyObj, idxInPage: number) => {
    const num = String(pick(it, ['num', 'Num', 'code', 'partNo'], ''));
    const title = String(pick(it, ['product', 'title', 'name'], ''));
    const oe = String(pick(it, ['oe', 'OE'], ''));
    const brand = String(pick(it, ['brand', 'Brand'], ''));
    const price = toNum(pick(it, ['price', 'Price'], 0), 0);
    const imgs = extractImages(it);
    const image = imgs[0] || '';
    const idx = page * size + idxInPage;
    router.push(
      `/stock/${encodeURIComponent(num)}?title=${encodeURIComponent(title)}&oe=${encodeURIComponent(
        oe
      )}&brand=${encodeURIComponent(brand)}&price=${price}&image=${encodeURIComponent(image)}&idx=${idx}`
    );
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-4 mb-4">
        <button className="border rounded px-3 py-1.5 disabled:opacity-40" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          上一页
        </button>
        <div>第 {page + 1} / {totalPages} 页</div>
        <button className="border rounded px-3 py-1.5 disabled:opacity-40" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
          下一页
        </button>
        <div className="ml-6">每页</div>
        <select className="border rounded px-2 py-1" value={size} onChange={(e)=>{setPage(0); setSize(Number(e.target.value));}}>
          {[20,40,60].map(n=><option key={n} value={n}>{n}</option>)}
        </select>
        <div>条</div>
      </div>

      {loading ? (
        <div className="text-slate-400">加载中…</div>
      ) : list.length === 0 ? (
        <div className="text-slate-400">暂无数据</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {list.map((it, i) => {
            const title = String(pick(it, ['product', 'title', 'name'], ''));
            const oe = String(pick(it, ['oe', 'OE'], ''));
            const brand = String(pick(it, ['brand', 'Brand'], ''));
            const price = toNum(pick(it, ['price', 'Price'], 0), 0);
            const num = String(pick(it, ['num', 'Num', 'code', 'partNo'], ''));
            const imgs = extractImages(it);
            const raw = imgs[0] || '';
            const s1 = cdn(raw, 600, false);
            const s2 = cdn(raw, 600, true);

            return (
              <div key={num + i} className="border rounded-xl p-3 hover:shadow-md transition">
                <div className="aspect-[4/3] bg-slate-50 rounded mb-3 flex items-center justify-center overflow-hidden">
                  {raw ? (
                    <img
                      src={s1}
                      onError={(e) => {
                        const cur = (e.currentTarget as HTMLImageElement).src;
                        if (cur === s1) (e.currentTarget as HTMLImageElement).src = s2;
                        else if (cur === s2) (e.currentTarget as HTMLImageElement).src = raw;
                      }}
                      alt=""
                      className="w-full h-full object-contain"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="text-slate-400">无图</div>
                  )}
                </div>
                <div className="text-base font-medium line-clamp-2 mb-1">{title || ' '}</div>
                <div className="text-sm text-slate-600">Brand: {brand || '-'}</div>
                <div className="text-sm text-slate-600">OE: {oe || '-'}</div>
                <div className="text-emerald-600 font-semibold my-2">￥ {price.toFixed(2)}</div>
                <div className="flex gap-2">
                  <button className="flex-1 bg-emerald-600 text-white rounded px-3 py-1.5 hover:bg-emerald-500"
                    onClick={()=>cart.add({ num, title: title || num, price, image: raw }, 1)}>加入购物车</button>
                  <button className="border rounded px-3 py-1.5" onClick={()=>goDetail(it, i)}>查看详情</button>
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
