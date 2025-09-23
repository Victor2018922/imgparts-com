'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

/* ----------------- 工具 ----------------- */
type AnyObj = Record<string, any>;

function cdn(url: string, w = 1200, altHost = false) {
  try {
    const u = new URL(url);
    const host = altHost ? 'https://images.weserv.nl' : 'https://wsrv.nl';
    const bare = `${u.protocol === 'https:' ? 'ssl:' : ''}${u.hostname}${u.pathname}${u.search}`;
    return `${host}/?url=${encodeURIComponent(bare)}&w=${w}&output=webp&q=82`;
  } catch {
    return url;
  }
}

function pick<T = any>(obj: AnyObj | null | undefined, keys: string[], dft: any = ''): T {
  for (const k of keys) {
    const v = (obj as any)?.[k];
    if (v !== undefined && v !== null && v !== '') return v as T;
  }
  return dft as T;
}

function toNum(v: any, dft = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dft;
}

function extractImages(fromObj: AnyObj | null | undefined, urlImage?: string): string[] {
  const out: string[] = [];
  const push = (s?: string) => {
    if (!s || typeof s !== 'string') return;
    const t = s.trim();
    if (!t || t === 'null' || t === 'undefined') return;
    out.push(t);
  };
  push(urlImage);
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

/* ----------------- 购物车（带结算表单-含电话） ----------------- */
type CartItem = { num: string; title: string; price: number; image?: string; qty: number };
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

/* ----------------- 详情页主体 ----------------- */
export default function StockDetailPage() {
  const params = useParams() as { num?: string } | null;
  const numParam = decodeURIComponent(params?.num ?? '');
  const search = useSearchParams();
  const router = useRouter();
  const cart = useCart();

  const titleQ = decodeURIComponent(search?.get('title') ?? '');
  const oeQ = decodeURIComponent(search?.get('oe') ?? '');
  const brandQ = decodeURIComponent(search?.get('brand') ?? '');
  const priceQ = toNum(search?.get('price') ?? '', 0);
  const imageQ = decodeURIComponent(search?.get('image') ?? '');
  const idxQ = toNum(search?.get('idx') ?? '', -1);

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

  useEffect(() => {
    let stop = false;
    const run = async () => {
      if (navIdx >= 0) {
        try {
          const size = 20;
          const page = Math.floor(navIdx / size);
          const res = await fetch(`https://niuniuparts.com:6001/scm-product/v1/stock2?size=${size}&page=${page}`, { cache: 'no-store' });
          const data = await res.json();
          const list: AnyObj[] = data?.content || data?.list || data?.rows || data?.data || [];
          if (!stop) setPageList(list);
          const found = list.find(
            (x) => String(pick(x, ['num', 'Num', 'code', 'partNo'], '')).toLowerCase() === numParam.toLowerCase()
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

  useEffect(() => {
    const arr = extractImages(meta, imageQ);
    setImgs(arr);
    setCur(0);
  }, [meta, imageQ]);

  const title = String(pick(meta, ['product', 'title', 'name'], ''));
  const oe = String(pick(meta, ['oe', 'OE'], ''));
  const brand = String(pick(meta, ['brand', 'Brand'], ''));
  const price = toNum(pick(meta, ['price', 'Price'], priceQ), priceQ);

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
        _oe
      )}&brand=${encodeURIComponent(_brand)}&price=${_price}&image=${encodeURIComponent(_image)}&idx=${nextIdx}`
    );
  };

  const addToCart = () => {
    cart.add({ num: numParam, title: title || numParam, price, image: imgs[0] || imageQ || '' }, 1);
  };

  const big1 = imgs[cur] ? cdn(imgs[cur], 1400, false) : '';
  const big2 = imgs[cur] ? cdn(imgs[cur], 1400, true) : '';

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-6">
      <div className="mb-4">
        <Link href="/stock" className="inline-flex items-center gap-2 border rounded px-3 py-1.5 hover:bg-slate-50">
          ← 返回列表
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="aspect-[4/3] bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center">
            {imgs.length ? (
              <img
                key={imgs[cur]}
                src={big1}
                onError={(e) => {
                  const curSrc = (e.currentTarget as HTMLImageElement).src;
                  if (curSrc === big1) (e.currentTarget as HTMLImageElement).src = big2;
                  else if (curSrc === big2) (e.currentTarget as HTMLImageElement).src = imgs[cur];
                }}
                alt=""
                decoding="async"
                loading="eager"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-slate-400">无图</div>
            )}
          </div>

          {!!imgs.length && (
            <div className="mt-3 flex gap-2 overflow-auto pb-1">
              {imgs.map((src, i) => {
                const s1 = cdn(src, 300, false);
                const s2 = cdn(src, 300, true);
                return (
                  <button
                    key={src + i}
                    onClick={() => setCur(i)}
                    className={`shrink-0 w-24 h-20 rounded border ${
                      i === cur ? 'border-emerald-600' : 'border-slate-200'
                    } bg-white`}
                    title={`图 ${i + 1}`}
                  >
                    <img
                      src={s1}
                      onError={(e) => {
                        const curSrc = (e.currentTarget as HTMLImageElement).src;
                        if (curSrc === s1) (e.currentTarget as HTMLImageElement).src = s2;
                        else if (curSrc === s2) (e.currentTarget as HTMLImageElement).src = src;
                      }}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-contain"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

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
              <span className="text-slate-500 mr-2">Model:</span>-</div>
            <div>
              <span className="text-slate-500 mr-2">Year:</span>-</div>
            <div className="text-emerald-600 text-xl font-bold mt-2">Price: ￥ {price.toFixed(2)}</div>
            <div>
              <span className="text-slate-500 mr-2">Stock:</span>-</div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button onClick={addToCart} className="bg-emerald-600 text-white rounded px-4 py-2 hover:bg-emerald-500">
              加入购物车
            </button>
            <button
              onClick={() => gotoBy(-1)}
              className="border rounded px-4 py-2 disabled:opacity-40"
              disabled={navIdx <= 0}
            >
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
