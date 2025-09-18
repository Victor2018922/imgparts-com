'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

/** ---------- 工具 & 兜底 ---------- */
function cdn(url: string, w = 560) {
  if (!url) return '';
  try {
    const u = new URL(url);
    const bare = `${u.hostname}${u.pathname}${u.search}`;
    return `https://wsrv.nl/?url=${encodeURIComponent(bare)}&w=${w}&output=webp&q=82`;
  } catch {
    return url;
  }
}
function pick<T extends Record<string, any>, K extends string>(obj: T | null | undefined, keys: K[], dft: any = '') {
  for (const k of keys) {
    const v = (obj as any)?.[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return dft;
}
function num(v: any, dft = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dft;
}

/** ---------- 轻量购物车（存 localStorage） ---------- */
type CartItem = {
  num: string;
  title: string;
  price: number;
  image?: string;
  qty: number;
};
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
    setItems(prev => {
      const i = prev.findIndex(x => x.num === it.num);
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
    setItems(prev => prev.map(x => (x.num === numNo ? { ...x, qty: Math.max(1, qty) } : x)));
  }, []);
  const remove = useCallback((numNo: string) => {
    setItems(prev => prev.filter(x => x.num !== numNo));
  }, []);
  const clear = useCallback(() => setItems([]), []);
  const total = useMemo(() => items.reduce((s, x) => s + x.price * x.qty, 0), [items]);

  return { open, setOpen, items, add, setQty, remove, clear, total };
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
      {/* 悬浮按钮 */}
      <button
        onClick={() => cart.setOpen(true)}
        className="fixed z-40 right-6 bottom-6 rounded-full bg-emerald-600 text-white px-4 py-3 shadow-lg hover:bg-emerald-500"
      >
        🛒 购物车（{cart.items.reduce((s, x) => s + x.qty, 0)}）
      </button>

      {/* 抽屉 */}
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
            cart.items.map((it) => (
              <div key={it.num} className="flex gap-3 items-center">
                <img src={cdn(it.image || '', 120)} alt="" className="w-16 h-16 object-contain rounded bg-slate-50" />
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
        </div>

        <div className="border-t p-4">
          <div className="flex justify-between mb-3">
            <span className="text-slate-500">合计</span>
            <span className="text-lg font-bold text-emerald-600">￥{cart.total.toFixed(2)}</span>
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

      {/* 成功弹窗 */}
      {done && (
        <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-[420px] shadow-xl">
            <div className="text-center text-emerald-600 text-xl font-bold mb-2">下单成功</div>
            <div className="text-center text-slate-600 mb-4">订单号：{done.id}</div>
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

/** ---------- 列表页（保留现有逻辑，补上按钮 & 购物车） ---------- */
type RawItem = Record<string, any>;

export default function StockListPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RawItem[]>([]);
  const [page, setPage] = useState(num(search?.get('page') ?? 1, 1));
  const [size, setSize] = useState(num(search?.get('size') ?? 20, 20));
  const cart = useCart();

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        setLoading(true);
        const url = `https://niuniuparts.com:6001/scm-product/v1/stock2?size=${size}&page=${page - 1}`;
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json();
        if (!stop) setRows(Array.isArray(data?.content) ? data.content : []);
      } catch {
        if (!stop) setRows([]);
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, [page, size]);

  const go = (p: number, s = size) => {
    setPage(p);
    setSize(s);
    const q = new URLSearchParams(search?.toString() || '');
    q.set('page', String(p));
    q.set('size', String(s));
    router.replace(`/stock?${q.toString()}`);
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-4 mb-4">
        <button disabled={page <= 1} onClick={() => go(page - 1)} className="px-3 py-1.5 border rounded disabled:opacity-50">
          上一页
        </button>
        <div className="text-slate-600">第 {page} / 1 页</div>
        <button onClick={() => go(page + 1)} className="px-3 py-1.5 border rounded">
          下一页
        </button>
        <div className="ml-6 text-slate-600">每页</div>
        <select
          value={size}
          onChange={(e) => go(1, Number(e.target.value))}
          className="border rounded px-2 py-1"
        >
          {[20, 30, 40, 60].map((n) => (
            <option key={n} value={n}>
              {n} 条
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-slate-400">加载中…</div>
      ) : rows.length === 0 ? (
        <div className="text-slate-400">暂无数据</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {rows.map((row, idx) => {
            const title = pick(row, ['title', 'product', 'name'], '-');
            const oe = pick(row, ['oe', 'OE', 'oeCode'], '-');
            const brand = pick(row, ['brand', 'brandName', 'brand_name'], '-');
            const numNo = String(pick(row, ['num', 'Num', 'code', 'id'], ''));
            const price = num(pick(row, ['price', 'salePrice', 'price_cny'], 0), 0);
            const pic =
              pick(row, ['image'], '') ||
              (Array.isArray(row?.images) ? row.images[0] : '') ||
              pick(row, ['imageUrl', 'img', 'pic'], '');

            const link = `/stock/${encodeURIComponent(numNo)}?title=${encodeURIComponent(title)}&oe=${encodeURIComponent(
              oe
            )}&brand=${encodeURIComponent(brand)}&price=${price}&image=${encodeURIComponent(pic)}&idx=${idx}`;

            return (
              <div key={numNo + idx} className="rounded-xl border bg-white/70 backdrop-blur p-3 hover:shadow-md transition">
                <div className="aspect-[4/3] rounded-lg bg-slate-50 overflow-hidden mb-3">
                  <img src={cdn(pic, 720)} alt="" className="w-full h-full object-contain" />
                </div>
                <div className="font-medium mb-1 line-clamp-2">{title}</div>
                <div className="text-slate-500 text-sm">Brand: {brand}</div>
                <div className="text-slate-500 text-sm">OE: {oe}</div>
                <div className="text-slate-500 text-sm mb-2">Num: {numNo}</div>
                <div className="text-emerald-600 font-bold mb-3">¥ {price.toFixed(2)}</div>

                <div className="flex gap-2">
                  <button
                    className="flex-1 bg-emerald-600 text-white rounded px-3 py-2 hover:bg-emerald-500"
                    onClick={() => cart.add({ num: numNo, title, price, image: pic }, 1)}
                  >
                    加入购物车
                  </button>
                  <Link href={link} className="flex-1 border rounded px-3 py-2 text-center hover:bg-slate-50">
                    查看详情
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 购物车抽屉 */}
      <CartDrawer cart={cart} />
    </div>
  );
}
