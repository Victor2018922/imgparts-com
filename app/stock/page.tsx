'use client';

import React, { Suspense, useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

/** ---------------- 工具 ---------------- */
function cdn(url: string, w = 640) {
  if (!url) return '';
  try {
    const u = new URL(url);
    const bare = `${u.hostname}${u.pathname}${u.search}`;
    return `https://wsrv.nl/?url=${encodeURIComponent(bare)}&w=${w}&output=webp&q=82`;
  } catch {
    return url;
  }
}
function pick<T extends Record<string, any>>(obj: T | null | undefined, keys: string[], dft: any = '') {
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

/** ---------------- 购物车：与详情页同一套逻辑（localStorage 共享） ---------------- */
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
  const remove = useCallback((numNo: string) => setItems(prev => prev.filter(x => x.num !== numNo)), []);
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
      <button
        onClick={() => cart.setOpen(true)}
        className="fixed z-40 right-6 bottom-6 rounded-full bg-emerald-600 text-white px-4 py-3 shadow-lg hover:bg-emerald-500"
      >
        🛒 购物车（{cart.items.reduce((s, x) => s + x.qty, 0)}）
      </button>

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

/** ---------------- 列表页：用 Suspense 包裹 ---------------- */
export default function StockPage() {
  return (
    <Suspense fallback={<div className="max-w-screen-2xl mx-auto px-4 py-10 text-slate-500">加载中…</div>}>
      <StockListInner />
    </Suspense>
  );
}

type RawItem = Record<string, any>;

function StockListInner() {
  const router = useRouter();
  const search = useSearchParams();
  const cart = useCart();

  // 分页参数（URL 可选：?page=1&size=20）
  const page = Math.max(1, num(search?.get('page') ?? 1, 1));
  const size = Math.max(1, num(search?.get('size') ?? 20, 20));

  const [rows, setRows] = useState<RawItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let stop = false;
    const run = async () => {
      setLoading(true);
      try {
        const url = `https://niuniuparts.com:6001/scm-product/v1/stock2?size=${size}&page=${page - 1}`;
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json();
        // 兼容不同返回结构
        const list: RawItem[] =
          data?.content || data?.list || data?.rows || data?.data || [];
        const totalElements = num(
          data?.totalElements ?? data?.total ?? data?.count ?? list.length,
          list.length
        );
        if (!stop) {
          setRows(list);
          setTotal(totalElements);
        }
      } catch (e) {
        if (!stop) {
          setRows([]);
          setTotal(0);
        }
      } finally {
        if (!stop) setLoading(false);
      }
    };
    run();
    return () => {
      stop = true;
    };
  }, [page, size]);

  const maxPage = Math.max(1, Math.ceil(total / size));

  const gotoPage = (p: number) => {
    const sp = new URLSearchParams(search?.toString() || '');
    sp.set('page', String(p));
    sp.set('size', String(size));
    router.push(`/stock?${sp.toString()}`);
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-2xl font-semibold">库存预览</div>
        <a
          className="px-3 py-2 rounded bg-slate-900 text-white hover:bg-slate-800"
          href={`https://niuniuparts.com:6001/scm-product/v1/stock2/excel?size=${size}&page=${page - 1}`}
          target="_blank"
          rel="noreferrer"
        >
          下载库存 Excel
        </a>
      </div>

      {/* 分页条 */}
      <div className="flex items-center gap-3 mb-4">
        <button className="px-3 py-1.5 border rounded disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => gotoPage(Math.max(1, page - 1))}
        >
          上一页
        </button>
        <div>第 {page} / {maxPage} 页</div>
        <button className="px-3 py-1.5 border rounded disabled:opacity-40"
          disabled={page >= maxPage}
          onClick={() => gotoPage(Math.min(maxPage, page + 1))}
        >
          下一页
        </button>
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="text-slate-500">加载中…</div>
      ) : rows.length === 0 ? (
        <div className="text-slate-500">暂无数据</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {rows.map((it: RawItem, i: number) => {
            const numNo = String(pick(it, ['num', 'Num', 'code', 'partNo'], ''));
            const title = String(pick(it, ['product', 'title', 'name'], '-'));
            const oe = String(pick(it, ['oe', 'OE'], '-'));
            const brand = String(pick(it, ['brand', 'Brand'], '-'));
            const price = num(pick(it, ['price', 'Price'], 0), 0);
            const image = String(
              pick(
                it,
                ['image', 'img', 'imageUrl', 'url', 'cover', 'pic', 'picUrl'],
                ''
              )
            );

            const detailUrl = `/stock/${encodeURIComponent(
              numNo
            )}?title=${encodeURIComponent(title)}&oe=${encodeURIComponent(
              oe
            )}&brand=${encodeURIComponent(brand)}&price=${price}&image=${encodeURIComponent(
              image
            )}&idx=${i}`;

            return (
              <div key={numNo || i} className="rounded-xl border bg-white hover:shadow-md transition">
                <Link href={detailUrl} className="block">
                  <div className="aspect-[4/3] bg-slate-50 rounded-t-xl overflow-hidden flex items-center justify-center">
                    {image ? (
                      <img src={cdn(image, 800)} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <div className="text-slate-400">无图</div>
                    )}
                  </div>
                </Link>

                <div className="p-4">
                  <div className="font-medium line-clamp-2 mb-2">{title}</div>
                  <div className="text-sm text-slate-600 space-y-1 mb-2">
                    <div>Brand: {brand}</div>
                    <div>OE: {oe}</div>
                    <div>Num: {numNo}</div>
                  </div>
                  <div className="text-emerald-600 font-semibold text-lg mb-3">￥ {price.toFixed(2)}</div>

                  <div className="flex gap-2">
                    <button
                      className="flex-1 bg-emerald-600 text-white rounded px-3 py-2 hover:bg-emerald-500"
                      onClick={() =>
                        cart.add({ num: numNo, title, price, image }, 1)
                      }
                    >
                      加入购物车
                    </button>
                    <Link href={detailUrl} className="flex-1 border rounded px-3 py-2 text-center hover:bg-slate-50">
                      查看详情
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 再次提供分页控制 */}
      <div className="mt-6 flex items-center gap-3">
        <button className="px-3 py-1.5 border rounded disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => gotoPage(Math.max(1, page - 1))}
        >
          上一页
        </button>
        <div>第 {page} / {maxPage} 页</div>
        <button className="px-3 py-1.5 border rounded disabled:opacity-40"
          disabled={page >= maxPage}
          onClick={() => gotoPage(Math.min(maxPage, page + 1))}
        >
          下一页
        </button>
      </div>

      <CartDrawer cart={cart} />
    </div>
  );
}
