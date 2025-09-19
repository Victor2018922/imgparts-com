'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

type AnyObj = Record<string, any>;

/* ---------- 工具 ---------- */
function cdn(url: string, w = 1280) {
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

/* ---------- 购物车（与列表页一致） ---------- */
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
  const setQty = useCallback(
    (numNo: string, qty: number) => setItems((prev) => prev.map((x) => (x.num === numNo ? { ...x, qty: Math.max(1, qty) } : x))),
    [],
  );
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

/* ---------- 详情页 ---------- */
export default function StockDetailPage() {
  // params 可能为 null：不用解构，安全读取
  const params = useParams() as { num?: string } | null;
  const numParam = decodeURIComponent((params?.num ?? '') as string);

  // search 也可能为 null：统一用 getQ() 读取
  const search = useSearchParams() as unknown as Readonly<URLSearchParams> | null;
  const getQ = (key: string) => {
    const v = (search as any)?.get?.(key);
    return v ? decodeURIComponent(v) : '';
  };

  const router = useRouter();
  const cart = useCart();

  // URL 兜底
  const titleQ = getQ('title');
  const oeQ = getQ('oe');
  const brandQ = getQ('brand');
  const priceQ = toNum(getQ('price'), 0);
  const imageQ = getQ('image');
  const idxQ = toNum(getQ('idx'), -1);

  // 元数据
  const [meta, setMeta] = useState<AnyObj | null>(() => ({
    num: numParam,
    product: titleQ,
    title: titleQ,
    oe: oeQ,
    brand: brandQ,
    price: priceQ,
    image: imageQ,
  }));

  const [pageList, setPageList] = useState<AnyObj[]>([]);
  const [navIdx, setNavIdx] = useState<number>(idxQ);

  const [imgs, setImgs] = useState<string[]>([]);
  const [cur, setCur] = useState(0);

  // 若有 idx，照列表分页抓当前页（补齐 meta）
  useEffect(() => {
    let stop = false;
    const run = async () => {
      if (navIdx >= 0) {
        try {
          const size = 20;
          const page = Math.floor(navIdx / size);
          const res = await fetch(
            `https://niuniuparts.com:6001/scm-product/v1/stock2?size=${size}&page=${page}`,
            { cache: 'no-store' },
          );
          const data = await res.json();
          const list: AnyObj[] = data?.content || data?.list || data?.rows || data?.data || [];
          if (!stop) setPageList(list);
          const found = list.find(
            (x) =>
              String(pick(x, ['num', 'Num', 'code', 'partNo'], '')).toLowerCase() === String(numParam).toLowerCase(),
          );
          if (!stop && found) setMeta((m) => ({ ...found, ...(m || {}) }));
        } catch {}
      }
    };
    run();
    return () => {
      stop = true;
    };
  }, [navIdx, numParam]);

  // 抽图
  useEffect(() => {
    const arr = extractImages(meta, imageQ);
    setImgs(arr);
    setCur(0);
  }, [meta, imageQ]);

  const title = String(pick(meta, ['product', 'title', 'name'], ''));
  const oe = String(pick(meta, ['oe', 'OE'], ''));
  const brand = String(pick(meta, ['brand', 'Brand'], ''));
  const price = toNum(pick(meta, ['price', 'Price'], priceQ), priceQ);

  // 上/下一条
  const gotoBy = (step: number) => {
    if (pageList.length === 0 || navIdx < 0) return;
    const nextIdx = Math.max(0, Math.min(navIdx + step, pageList.length - 1));
    const it = pageList[nextIdx];
    const numNo = String(pick(it, ['num', 'Num', 'code', 'partNo'], ''));
    const _title = String(pick(it, ['product', 'title', 'name'], ''));
    const _oe = String(pick(it, ['oe', 'OE'], ''));
    const _brand = String(pick(it, ['brand', 'Brand'], ''));
    const _price = toNum(pick(it, ['price', 'Price'], 0), 0);
    const _image = String(pick(it, ['image', 'img', 'imageUrl', 'url', 'cover', 'pic', 'picUrl'], ''));
    setNavIdx(nextIdx);
    setMeta({ ...it });
    router.replace(
      `/stock/${encodeURIComponent(numNo)}?title=${encodeURIComponent(_title)}&oe=${encodeURIComponent(
        _oe,
      )}&brand=${encodeURIComponent(_brand)}&price=${_price}&image=${encodeURIComponent(_image)}&idx=${nextIdx}`,
    );
  };

  const addToCart = () => {
    cart.add({ num: numParam, title: title || numParam, price, image: imgs[0] || imageQ || '' }, 1);
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-6">
      <div className="mb-4">
        <Link href="/stock" className="inline-flex items-center gap-2 border rounded px-3 py-1.5 hover:bg-slate-50">
          ← 返回列表
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 左：大图 + 缩略图 */}
        <div>
          <div className="aspect-[4/3] bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center">
            {imgs.length ? (
              <img key={imgs[cur]} src={cdn(imgs[cur], 1400)} alt="" decoding="async" loading="eager" className="w-full h-full object-contain" />
            ) : (
              <div className="text-slate-400">无图</div>
            )}
          </div>

          {!!imgs.length && (
            <div className="mt-3 flex gap-2 overflow-auto pb-1">
              {imgs.map((src, i) => (
                <button
                  key={src + i}
                  onClick={() => setCur(i)}
                  className={`shrink-0 w-24 h-20 rounded border ${
                    i === cur ? 'border-emerald-600' : 'border-slate-200'
                  } bg-white`}
                  title={`图 ${i + 1}`}
                >
                  <img src={cdn(src, 300)} alt="" loading="lazy" decoding="async" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 右：信息与操作 */}
        <div>
          <h1 className="text-2xl font-semibold mb-4">{title || ' '}</h1>

          <div className="space-y-2 text-slate-700">
            <div>
              <span className="text-slate-500 mr-2">Num:</span>
              {numParam || '-'}
            </div>
            <div>
              <span className="text-slate-500 mr-2">OE:</span>
              {oe || '-'}
            </div>
            <div>
              <span className="text-slate-500 mr-2">Brand:</span>
              {brand || '-'}
            </div>
            <div>
              <span className="text-slate-500 mr-2">Model:</span>-{/* 暂无 */}
            </div>
            <div>
              <span className="text-slate-500 mr-2">Year:</span>-{/* 暂无 */}
            </div>
            <div className="text-emerald-600 text-xl font-bold mt-2">Price: ￥ {price.toFixed(2)}</div>
            <div>
              <span className="text-slate-500 mr-2">Stock:</span>-{/* 暂无 */}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button onClick={addToCart} className="bg-emerald-600 text-white rounded px-4 py-2 hover:bg-emerald-500">
              加入购物车
            </button>

            <button onClick={() => gotoBy(-1)} className="border rounded px-4 py-2 disabled:opacity-40" disabled={navIdx <= 0}>
              上一条
            </button>
            <button
              onClick={() => gotoBy(+1)}
              className="border rounded px-4 py-2 disabled:opacity-40"
              disabled={navIdx < 0 || navIdx >= pageList.length - 1}
            >
              下一条
            </button>
          </div>
        </div>
      </div>

      <CartButton cart={cart} />
      <CartDrawer cart={cart} />
    </div>
  );
}
