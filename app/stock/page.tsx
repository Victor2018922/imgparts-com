'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';

/* ----------------- 小工具 ----------------- */
type AnyObj = Record<string, any>;

function cdn(url: string, w = 800) {
  if (!url) return '';
  try {
    const u = new URL(url);
    const bare = `${u.hostname}${u.pathname}${u.search}`;
    return `https://wsrv.nl/?url=${encodeURIComponent(bare)}&w=${w}&output=webp&q=82`;
  } catch {
    return url;
  }
}

function pick<T extends AnyObj>(obj: T | null | undefined, keys: string[], dft: any = '') {
  for (const k of keys) {
    const v = (obj as any)?.[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return dft;
}
function toNum(v: any, dft = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dft;
}

/** 尽可能从对象中抽取图片（最多 12 张） */
function extractImages(fromObj: AnyObj | null, urlImage?: string): string[] {
  const out: string[] = [];
  const push = (s?: string) => {
    if (!s) return;
    const t = String(s).trim();
    if (!t || t === 'null' || t === 'undefined') return;
    out.push(t);
  };
  push(urlImage);

  if (fromObj) {
    const direct = pick(fromObj, ['images', 'imageList', 'imgs', 'photos'], null);
    if (Array.isArray(direct)) direct.forEach((x: any) => push(String(x || '')));
    else if (typeof direct === 'string') direct.split(/[|,;\s]+/g).forEach(push);

    Object.keys(fromObj).forEach((k) => {
      if (/^(img|image|pic|photo)\d*$/i.test(k)) push(String(fromObj[k] || ''));
    });

    push(pick(fromObj, ['image', 'img', 'cover', 'pic', 'picUrl', 'imageUrl', 'url', 'thumb'], ''));
  }

  const uniq = Array.from(new Set(out.filter((x) => /^https?:\/\//i.test(x))));
  return uniq.slice(0, 12);
}

/* ----------------- 购物车（本页与详情页共享逻辑，一模一样） ----------------- */
type CartItem = { num: string; title: string; price: number; image?: string; qty: number };
function useCart() {
  const KEY = 'imgparts_cart_v2';
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
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
  const [done, setDone] = useState<{ id: string; total: number } | null>(null);
  const checkout = () => {
    if (cart.items.length === 0) return;
    const id = 'IP' + String(Date.now()).slice(-10);
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
          <button onClick={() => cart.setOpen(false)} className="text-slate-500 hover:text-slate-700">✕</button>
        </div>
        <div className="p-4 space-y-3 overflow-auto h-[calc(100%-170px)]">
          {cart.items.length === 0 ? (
            <div className="text-slate-400 text-sm">购物车是空的～</div>
          ) : (
            cart.items.map((it) => (
              <div key={it.num} className="flex gap-3 items-center">
                <img src={cdn(it.image || '', 120)} alt="" className="w-16 h-16 object-contain rounded bg-slate-50" />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm">{it.title}</div>
                  <div className="text-emerald-600 font-semibold">￥{it.price.toFixed(2)}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <button className="px-2 border rounded" onClick={() => cart.setQty(it.num, it.qty - 1)}>-</button>
                    <input className="w-12 text-center border rounded py-0.5" value={it.qty}
                      onChange={(e) => cart.setQty(it.num, Number(e.target.value || 1))}/>
                    <button className="px-2 border rounded" onClick={() => cart.setQty(it.num, it.qty + 1)}>+</button>
                  </div>
                </div>
                <button className="text-slate-400 hover:text-rose-600" onClick={() => cart.remove(it.num)}>删除</button>
              </div>
            ))
          )}
        </div>
        <div className="border-t p-4">
          <div className="flex justify-between mb-3">
            <span className="text-slate-500">合计</span>
            <span className="text-lg font-bold text-emerald-600">￥{cart.total.toFixed(2)}</span>
          </div>
          <div className="flex gap-2">
            <button className="flex-1 border rounded px-3 py-2" onClick={cart.clear}>清空</button>
            <button className="flex-1 bg-emerald-600 text-white rounded px-3 py-2 hover:bg-emerald-500" onClick={checkout}>去结算</button>
          </div>
        </div>
      </div>

      {done && (
        <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-[420px] shadow-xl">
            <div className="text-center text-emerald-600 text-xl font-bold mb-2">下单成功</div>
            <div className="text-center text-slate-600 mb-4">订单号：{done.id}</div>
            <div className="text-center text-slate-700 mb-6">应付合计：￥{done.total.toFixed(2)}</div>
            <div className="flex gap-2">
              <button className="flex-1 border rounded px-3 py-2" onClick={() => setDone(null)}>继续购物</button>
              <button className="flex-1 bg-slate-900 text-white rounded px-3 py-2"
                onClick={() => { navigator.clipboard?.writeText(`订单号：${done.id}，合计：￥${done.total.toFixed(2)}`); setDone(null); }}>
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
  const cart = useCart();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [rows, setRows] = useState<AnyObj[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let stop = false;
    const run = async () => {
      try {
        const res = await fetch(`https://niuniuparts.com:6001/scm-product/v1/stock2?size=${size}&page=${page}`, { cache: 'no-store' });
        const data = await res.json();
        const list: AnyObj[] = data?.content || data?.list || data?.rows || data?.data || [];
        if (!stop) {
          setRows(list);
          setTotal(Number(data?.totalElements ?? data?.total ?? list.length ?? 0));
        }
      } catch {
        if (!stop) {
          setRows([]);
          setTotal(0);
        }
      }
    };
    run();
    return () => { stop = true; };
  }, [page, size]);

  const pages = Math.max(1, Math.ceil(total / Math.max(1, size)));

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-6">
      {/* 分页条 */}
      <div className="flex items-center gap-4 mb-5">
        <button className="border rounded px-3 py-1.5 disabled:opacity-40" disabled={page<=0} onClick={()=>setPage((p)=>Math.max(0,p-1))}>上一页</button>
        <div>第 {page+1} / {pages} 页</div>
        <button className="border rounded px-3 py-1.5 disabled:opacity-40" disabled={page>=pages-1} onClick={()=>setPage((p)=>Math.min(pages-1,p+1))}>下一页</button>
        <div className="flex items-center gap-2">
          <span>每页</span>
          <select className="border rounded px-2 py-1" value={size} onChange={(e)=>{setPage(0); setSize(Number(e.target.value))}}>
            {[20,24,28,32].map(n=><option key={n} value={n}>{n}</option>)}
          </select>
          <span>条</span>
        </div>
      </div>

      {/* 列表 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {rows.map((it, i) => {
          const num   = String(pick(it, ['num','Num','code','partNo'], ''));
          const title = String(pick(it, ['product','title','name'], ''));
          const oe    = String(pick(it, ['oe','OE'], ''));
          const brand = String(pick(it, ['brand','Brand'], ''));
          const price = toNum(pick(it, ['price','Price'], 0), 0);
          const urlImage = String(pick(it, ['image','img','imageUrl','url','cover','pic','picUrl'], ''));
          const imgs = extractImages(it, urlImage);
          const img = imgs[0] || '';

          return (
            <div key={num || i} className="rounded-xl border bg-white">
              <div className="aspect-[4/3] bg-slate-50 rounded-t-xl overflow-hidden flex items-center justify-center">
                {img ? (
                  <img src={cdn(img, 900)} alt="" className="w-full h-full object-contain" loading="lazy" decoding="async" />
                ) : (
                  <div className="text-slate-400">无图</div>
                )}
              </div>

              <div className="p-4">
                <div className="font-medium mb-1 line-clamp-2">{title || ' '}</div>
                <div className="text-slate-600 text-sm">Brand: {brand || '-'}</div>
                <div className="text-slate-600 text-sm">OE: {oe || '-'}</div>
                <div className="text-slate-600 text-sm mb-2">Num: {num || '-'}</div>
                <div className="text-emerald-600 font-bold text-lg mb-3">￥ {price.toFixed(2)}</div>

                <div className="flex gap-2">
                  <button
                    className="flex-1 bg-emerald-600 text-white rounded px-3 py-2 hover:bg-emerald-500"
                    onClick={() => cart.add({ num, title: title || num, price, image: img || '' }, 1)}
                  >
                    加入购物车
                  </button>

                  <Link
                    href={`/stock/${encodeURIComponent(num)}?title=${encodeURIComponent(title)}&oe=${encodeURIComponent(oe)}&brand=${encodeURIComponent(brand)}&price=${price}&image=${encodeURIComponent(img)}&idx=${page*size+i}`}
                    className="border rounded px-3 py-2"
                  >
                    查看详情
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <CartButton cart={cart} />
      <CartDrawer cart={cart} />
    </div>
  );
}
