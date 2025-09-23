'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

/** ------------- 工具 ------------- */
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
function extractImages(fromObj: AnyObj | null, extra?: string): string[] {
  const out: string[] = [];
  const push = (s?: string) => {
    if (!s) return;
    const t = String(s).trim();
    if (!t || t === 'null' || t === 'undefined') return;
    if (/^https?:\/\//i.test(t)) out.push(t);
  };
  if (extra) push(extra);
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
function wsrv1(url: string, w = 1200) {
  const clean = url.replace(/^https?:\/\//, '');
  return `https://wsrv.nl/?url=${encodeURIComponent(clean)}&w=${w}&q=80&output=webp`;
}
function wsrv2(url: string, w = 1200) {
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
  w = 1280,
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
      loading="eager"
      decoding="async"
      onError={() => {
        if (i < cands.length - 1) setI(i + 1);
      }}
    />
  );
}

/** ------------- 购物车（与列表相同） ------------- */
type CartItem = { num: string; title: string; price: number; image?: string; qty: number };
type OrderContact = {
  country: string;
  city: string;
  address: string;
  postcode: string;
  email: string;
  receiver: string;
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
      if (cRaw) setContact((c) => ({ ...c, ...JSON.parse(cRaw) }));
    } catch {}
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
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full border rounded px-3 py-2" />
    </label>
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
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold">
            {cart.phase === 'cart' ? '购物车' : cart.phase === 'checkout' ? '填写订单信息' : '下单成功'}
          </div>
          <button onClick={() => cart.setOpen(false)} className="text-slate-500 hover:text-slate-700">
            ✕
          </button>
        </div>

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

/** ------------- 详情页 ------------- */
export default function StockDetailPage() {
  const params = useParams() as { num?: string } | null;
  const numParam = decodeURIComponent(params?.num ?? '');

  // 用 window 解析 URL 参数，避免 useSearchParams 的 Suspense 提示
  const getQ = (key: string) => {
    if (typeof window === 'undefined') return '';
    return decodeURIComponent(new URLSearchParams(window.location.search).get(key) ?? '');
  };

  const idxQ = toNum(getQ('idx') || -1, -1);
  const titleQ = getQ('title');
  const oeQ = getQ('oe');
  const brandQ = getQ('brand');
  const priceQ = toNum(getQ('price'), 0);
  const imageQ = getQ('image');

  const cart = useCart();

  const [meta, setMeta] = useState<AnyObj | null>(() => ({
    num: numParam,
    product: titleQ,
    oe: oeQ,
    brand: brandQ,
    price: priceQ,
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
          const found = list.find((x) => String(pick(x, ['num', 'Num', 'code', 'partNo'], '')).toLowerCase() === numParam.toLowerCase());
          if (!stop && found) setMeta((m) => ({ ...(m || {}), ...found }));
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
    const size = 20;
    const page = Math.floor(navIdx / size);
    const nextIdx = Math.max(0, Math.min(navIdx + step, pageList.length - 1));
    const it = pageList[nextIdx];
    const numNo = String(pick(it, ['num', 'Num', 'code', 'partNo'], ''));
    const _title = String(pick(it, ['product', 'title', 'name'], ''));
    const _oe = String(pick(it, ['oe', 'OE'], ''));
    const _brand = String(pick(it, ['brand', 'Brand'], ''));
    const _price = toNum(pick(it, ['price', 'Price'], 0), 0);
    const imgs2 = extractImages(it);
    const _image = imgs2[0] || '';

    setNavIdx(nextIdx);
    setMeta({ ...it });
    if (typeof window !== 'undefined') {
      window.history.replaceState(
        null,
        '',
        `/stock/${encodeURIComponent(numNo)}?title=${encodeURIComponent(_title)}&oe=${encodeURIComponent(_oe)}&brand=${encodeURIComponent(
          _brand
        )}&price=${_price}&image=${encodeURIComponent(_image)}&idx=${page * size + (nextIdx % size)}`
      );
    }
  };

  const addToCart = () => {
    const first = imgs[0] || imageQ || '';
    cart.add({ num: numParam, title: title || numParam, price, image: first }, 1);
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-6">
      <div className="mb-4">
        <Link href="/stock" className="inline-flex items-center gap-2 border rounded px-3 py-1.5 hover:bg-slate-50">
          ← 返回列表
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 左侧：大图 + 缩略图 */}
        <div>
          <div className="aspect-[4/3] bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center">
            {imgs.length ? (
              <MultiImg src={imgs[cur]} w={1400} className="w-full h-full object-contain" />
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
                >
                  <MultiImg src={src} w={320} className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 右侧：信息 + 操作 */}
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
