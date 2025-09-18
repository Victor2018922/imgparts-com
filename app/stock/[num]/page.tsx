'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

/** ---------- 工具 ---------- */
function cdn(url: string, w = 1024) {
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

/** ---------- 购物车（与列表页一致，保证共享） ---------- */
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

/** ---------- 详情页主体 ---------- */
export default function StockDetailPage() {
  // ✅ 兼容性读取 useParams，避免被推断为 {num:string}|null
  const p = useParams() as { num?: string } | null;
  const numParam = typeof p?.num === 'string' ? p!.num : '';

  const search = useSearchParams();
  const router = useRouter();
  const cart = useCart();

  const numNo = String(numParam || '');
  const title = decodeURIComponent(search?.get('title') || '') || '-';
  const oe = decodeURIComponent(search?.get('oe') || '') || '-';
  const brand = decodeURIComponent(search?.get('brand') || '') || '-';
  const price = num(search?.get('price') || 0, 0);
  const image0 = decodeURIComponent(search?.get('image') || '');
  const idx = num(search?.get('idx') || -1, -1);

  // 仍按“最多 12 张缩略图”的策略
  const [images, setImages] = useState<string[]>(image0 ? [image0] : []);
  useEffect(() => {
    setImages((prev) => prev.slice(0, 12));
  }, [image0]);

  const [cur, setCur] = useState(0);

  const goto = () => {
    router.push(
      `/stock/${encodeURIComponent(numNo)}?title=${encodeURIComponent(title)}&oe=${encodeURIComponent(
        oe
      )}&brand=${encodeURIComponent(brand)}&price=${price}&image=${encodeURIComponent(image0)}&idx=${idx}`
    );
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-6">
      <Link href="/stock" className="inline-block mb-4 border rounded px-3 py-1.5 hover:bg-slate-50">
        ← 返回列表
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 大图 */}
        <div>
          <div className="aspect-[4/3] rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden">
            {images.length > 0 ? (
              <img src={cdn(images[cur] || '', 1400)} alt="" className="w-full h-full object-contain" />
            ) : (
              <div className="text-slate-400">无图</div>
            )}
          </div>

          {/* 缩略图 */}
          {images.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {images.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setCur(i)}
                  className={`shrink-0 w-24 h-20 rounded bg-slate-50 overflow-hidden border ${
                    i === cur ? 'border-emerald-500' : 'border-transparent'
                  }`}
                >
                  <img src={cdn(src, 360)} className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 信息 & 操作 */}
        <div>
          <h1 className="text-2xl font-semibold mb-2">{title}</h1>
          <div className="space-y-2 text-slate-700">
            <div>Num: {numNo || '-'}</div>
            <div>OE: {oe}</div>
            <div>Brand: {brand}</div>
            <div>Model: -</div>
            <div>Year: -</div>
            <div className="text-emerald-600 text-xl font-bold">Price: ¥ {price.toFixed(2)}</div>
            <div>Stock: -</div>
          </div>

          <div className="mt-4 flex gap-2">
            <QtyButton onAdd={(q) => cart.add({ num: numNo, title, price, image: images[0] }, q)} />
          </div>

          <div className="mt-6 flex gap-2">
            <button className="px-4 py-2 border rounded" onClick={() => goto()}>
              上一条
            </button>
            <button className="px-4 py-2 border rounded" onClick={() => goto()}>
              下一条
            </button>
          </div>
        </div>
      </div>

      <CartDrawer cart={cart} />
    </div>
  );
}

function QtyButton({ onAdd }: { onAdd: (qty: number) => void }) {
  const [qty, setQty] = useState(1);
  return (
    <>
      <div className="flex items-center border rounded">
        <button className="px-3 py-2" onClick={() => setQty(Math.max(1, qty - 1))}>
          -
        </button>
        <input
          className="w-14 text-center outline-none"
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))}
        />
        <button className="px-3 py-2" onClick={() => setQty(Math.min(999, qty + 1))}>
          +
        </button>
      </div>
      <button className="bg-emerald-600 text-white rounded px-4 py-2 hover:bg-emerald-500" onClick={() => onAdd(qty)}>
        加入购物车
      </button>
    </>
  );
}

