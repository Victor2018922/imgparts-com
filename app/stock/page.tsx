'use client';

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  Suspense,
} from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

type StockItem = {
  num: string;
  product: string;
  oe?: string;
  brand?: string;
  model?: string;
  year?: string;
  image?: string | null;
  img?: string | null;
  imgUrl?: string | null;
  pic?: string | null;
  picture?: string | null;
  url?: string | null;
  [k: string]: any;
};

type CartItem = {
  key: string;
  num?: string;
  product: string;
  oe?: string;
  brand?: string;
  model?: string;
  year?: string;
  qty: number;
  image?: string | null;
};

const API_BASE = 'https://niuniuparts.com:6001/scm-product/v1/stock2';
const PAGE_SIZE = 20;

function pickRawImageUrl(x: StockItem | CartItem): string | null {
  const anyx = x as any;
  const keys = ['image', 'img', 'imgUrl', 'pic', 'picture', 'url'];
  for (const k of keys) {
    const v = anyx?.[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  const media = anyx?.media;
  if (Array.isArray(media) && media[0]?.url) return media[0].url;
  return null;
}

function normalizeImageUrl(u: string | null): string | null {
  if (!u) return null;
  if (u.startsWith('//')) return 'https:' + u;
  if (u.startsWith('http://')) return 'https://' + u.slice(7);
  return u;
}

const FALLBACK_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-size="14">
        No Image
      </text>
    </svg>`
  );

function extractArrayPayload(json: any): any[] {
  if (Array.isArray(json)) return json;
  const candidates = ['content', 'data', 'items', 'records', 'list', 'result'];
  for (const k of candidates) {
    const v = json?.[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') {
      const deep =
        (v as any).list ||
        (v as any).items ||
        (v as any).content ||
        (v as any).records;
      if (Array.isArray(deep)) return deep;
    }
  }
  return [];
}

function mapToStockItem(x: any): StockItem {
  const num = x.num || x.sku || x.code || x.partNo || x.part || x.id || '';
  const product =
    x.product || x.name || x.title || x.desc || x.description || 'Part';
  const oe = x.oe || x.oeNo || x.oeNumber || x.oe_code || x.oem || '';
  const brand = x.brand || x.make || x.maker || '';
  const model = x.model || x.vehicleModel || x.carModel || '';
  const year = x.year || x.years || x.modelYear || '';
  return { ...x, num, product, oe, brand, model, year };
}

function encodeItemForUrl(item: StockItem): string {
  try {
    const compact = {
      num: item.num,
      product: item.product,
      oe: item.oe,
      brand: item.brand,
      model: item.model,
      year: item.year,
      image:
        item.image ??
        (item as any).img ??
        (item as any).imgUrl ??
        (item as any).pic ??
        (item as any).picture ??
        (item as any).url ??
        null,
    };
    const s = JSON.stringify(compact);
    return encodeURIComponent(btoa(unescape(encodeURIComponent(s))));
  } catch {
    return '';
  }
}

function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('cart') || '[]';
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr;
    return [];
  } catch {
    return [];
  }
}

function saveCart(arr: CartItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('cart', JSON.stringify(arr));
}

/**
 * 外层导出：包裹 Suspense，满足 Next.js 对 useSearchParams 的要求
 */
export default function StockPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">加载中…</div>}>
      <StockPageInner />
    </Suspense>
  );
}

/**
 * 实际页面逻辑（含 useSearchParams）
 */
function StockPageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const checkoutOpen = !!(sp && sp.get('checkout'));

  const [items, setItems] = useState<StockItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // cart & checkout state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Load cart when opening checkout or on initial mount
  useEffect(() => {
    setCart(loadCart());
  }, [checkoutOpen]);

  // Keep cart in sync if other tab changes
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'cart') setCart(loadCart());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const totalQty = useMemo(
    () => cart.reduce((sum, it) => sum + (Number(it.qty) || 0), 0),
    [cart]
  );

  const updateQty = (key: string, delta: number) => {
    setCart((prev) => {
      const next = prev.map((it) =>
        it.key === key ? { ...it, qty: Math.max(1, (it.qty || 1) + delta) } : it
      );
      saveCart(next);
      return next;
    });
  };

  const removeItem = (key: string) => {
    setCart((prev) => {
      const next = prev.filter((it) => it.key !== key);
      saveCart(next);
      return next;
    });
  };

  const clearCart = () => {
    saveCart([]);
    setCart([]);
  };

  const submitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);

    if (!cart.length) {
      setFormMsg('购物车为空');
      return;
    }
    if (!name.trim()) {
      setFormMsg('请填写联系人姓名');
      return;
    }
    if (!phone.trim() || phone.trim().length < 6) {
      setFormMsg('请填写有效联系电话（至少6位）');
      return;
    }

    const order = {
      id: 'ORD-' + Date.now(),
      contact: { name, phone, email, country, city, address, postcode },
      items: cart,
      createdAt: new Date().toISOString(),
      origin: 'imgparts-preview',
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem('lastOrder', JSON.stringify(order));
      clearCart();
    }

    setSubmitted(true);
  };

  // ---- data list: fetch stock2
  const loadPage = useCallback(
    async (p: number) => {
      if (loading) return;
      setLoading(true);
      try {
        const url = `${API_BASE}?size=${PAGE_SIZE}&page=${p}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
          setBanner(`⚠️ 加载失败：HTTP ${res.status}（来源：niuniuparts stock2）`);
          setHasMore(false);
          setErr(`HTTP ${res.status}`);
        } else {
          const json = await res.json();
          const arr = extractArrayPayload(json).map(mapToStockItem);
          if (arr.length > 0) {
            setItems((prev) => (p === 0 ? arr : [...prev, ...arr]));
            setHasMore(arr.length >= PAGE_SIZE);
            setBanner(null);
          } else {
            if (p === 0) setBanner('ℹ️ 接口返回空列表');
            setHasMore(false);
          }
        }
      } catch (e: any) {
        setBanner(`⚠️ 加载异常：${e?.message || '未知错误'}`);
        setHasMore(false);
        setErr(e?.message || 'Load failed');
      } finally {
        setLoading(false);
      }
    },
    [loading]
  );

  useEffect(() => {
    loadPage(0);
  }, [loadPage]);

  // --- UI
  return (
    <main className="container mx-auto p-4">
      {banner && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800 text-sm">
          {banner}
          <div className="mt-1 text-xs text-amber-700">
            数据源：<code>{API_BASE}</code> · 当前页：<code>{page}</code>
          </div>
        </div>
      )}

      {/* 顶部右侧：结算入口（显示购物车数量） */}
      <div className="flex justify-end mb-3">
        <button
          onClick={() => router.push('/stock?checkout=1')}
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          购物车 / 结算 {totalQty ? `(${totalQty})` : ''}
        </button>
      </div>

      {/* 列表 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const raw = pickRawImageUrl(item);
          const src = normalizeImageUrl(raw) || FALLBACK_IMG;
          const alt =
            [item.brand, item.product, item.model, item.oe]
              .filter(Boolean)
              .join(' ') || 'Product Image';
          const d = encodeItemForUrl(item);
          const href = `/stock/${encodeURIComponent(item.num || '')}${
            d ? `?d=${d}` : ''
          }`;

          return (
            <Link
              key={`${item.num}-${item.oe || ''}-${item.product}`}
              href={href}
              className="group block rounded-2xl border p-3 hover:shadow"
            >
              <div className="flex gap-3">
                <div
                  className="relative rounded-xl overflow-hidden bg-white shrink-0"
                  style={{ width: 120, height: 120 }}
                >
                  <img
                    src={src}
                    alt={alt}
                    width={120}
                    height={120}
                    style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                    onError={(e) => {
                      const el = e.currentTarget as HTMLImageElement;
                      if (el.src !== FALLBACK_IMG) el.src = FALLBACK_IMG;
                    }}
                    loading="lazy"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold group-hover:underline truncate">
                    {item.product}
                  </div>
                  <div className="text-sm text-gray-500 truncate">
                    {[item.brand, item.model, item.year]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  {item.oe && (
                    <div className="text-xs text-gray-400 mt-1">OE: {item.oe}</div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* load more */}
      <div className="flex justify-center">
        {hasMore ? (
          <button
            className="mt-6 rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            onClick={() => {
              const next = page + 1;
              setPage(next);
              loadPage(next);
            }}
            disabled={loading}
          >
            {loading ? '加载中…' : '加载更多'}
          </button>
        ) : (
          <div className="mt-6 text-xs text-gray-400">
            {items.length ? '没有更多了' : '暂无数据'}
          </div>
        )}
      </div>

      {err && <div className="mt-6 text-xs text-gray-400">Debug: {err}</div>}

      {/* ======= 结算面板（基于 ?checkout=1 打开） ======= */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 overflow-auto">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-4 md:p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">结算</h2>
              <button
                onClick={() => router.push('/stock')}
                className="rounded-md px-3 py-1.5 text-sm border hover:bg-gray-50"
              >
                关闭
              </button>
            </div>

            {/* 购物车/表单/提交逻辑与之前一致 */}
            <CheckoutPanel
              cart={cart}
              totalQty={totalQty}
              updateQty={updateQty}
              removeItem={removeItem}
              clearCart={clearCart}
              name={name}
              setName={setName}
              phone={phone}
              setPhone={setPhone}
              email={email}
              setEmail={setEmail}
              country={country}
              setCountry={setCountry}
              city={city}
              setCity={setCity}
              address={address}
              setAddress={setAddress}
              postcode={postcode}
              setPostcode={setPostcode}
              formMsg={formMsg}
              submitted={submitted}
              submitOrder={submitOrder}
            />
          </div>
        </div>
      )}
    </main>
  );
}

function CheckoutPanel(props: {
  cart: CartItem[];
  totalQty: number;
  updateQty: (key: string, delta: number) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
  name: string;
  setName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  country: string;
  setCountry: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  address: string;
  setAddress: (v: string) => void;
  postcode: string;
  setPostcode: (v: string) => void;
  formMsg: string | null;
  submitted: boolean;
  submitOrder: (e: React.FormEvent) => void;
}) {
  const {
    cart,
    totalQty,
    updateQty,
    removeItem,
    clearCart,
    name,
    setName,
    phone,
    setPhone,
    email,
    setEmail,
    country,
    setCountry,
    city,
    setCity,
    address,
    setAddress,
    postcode,
    setPostcode,
    formMsg,
    submitted,
    submitOrder,
  } = props;

  if (!submitted) {
    return (
      <>
        {/* 购物车列表 */}
        <div className="mt-4">
          <h3 className="font-medium mb-2">购物车（{totalQty}）</h3>
          {cart.length === 0 ? (
            <div className="text-sm text-gray-500">购物车为空。</div>
          ) : (
            <ul className="space-y-3">
              {cart.map((it) => {
                const src =
                  normalizeImageUrl(pickRawImageUrl(it)) || FALLBACK_IMG;
                const alt =
                  [it.brand, it.product, it.model, it.oe]
                    .filter(Boolean)
                    .join(' ') || 'Product';
                return (
                  <li key={it.key} className="flex gap-3 border rounded-xl p-3">
                    <div
                      className="relative rounded-lg overflow-hidden bg-white shrink-0"
                      style={{ width: 72, height: 72 }}
                    >
                      <img
                        src={src}
                        alt={alt}
                        width={72}
                        height={72}
                        style={{
                          objectFit: 'contain',
                          width: '100%',
                          height: '100%',
                        }}
                        onError={(e) => {
                          const el = e.currentTarget as HTMLImageElement;
                          if (el.src !== FALLBACK_IMG) el.src = FALLBACK_IMG;
                        }}
                        loading="lazy"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{it.product}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {[it.brand, it.model].filter(Boolean).join(' · ')}
                      </div>
                      {it.oe && (
                        <div className="text-xs text-gray-400">OE: {it.oe}</div>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          className="rounded border px-2 py-0.5 text-sm"
                          onClick={() => updateQty(it.key, -1)}
                        >
                          −
                        </button>
                        <span className="text-sm">{it.qty || 1}</span>
                        <button
                          className="rounded border px-2 py-0.5 text-sm"
                          onClick={() => updateQty(it.key, +1)}
                        >
                          ＋
                        </button>
                        <button
                          className="ml-3 rounded border px-2 py-0.5 text-xs text-red-600"
                          onClick={() => removeItem(it.key)}
                        >
                          移除
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {cart.length > 0 && (
            <div className="mt-2 text-right">
              <button
                className="text-xs text-gray-500 underline"
                onClick={clearCart}
              >
                清空购物车
              </button>
            </div>
          )}
        </div>

        {/* 收货信息表单 */}
        <form className="mt-6 space-y-3" onSubmit={submitOrder}>
          <h3 className="font-medium">收货信息</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="border rounded-lg px-3 py-2"
              placeholder="联系人姓名 *"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="border rounded-lg px-3 py-2"
              placeholder="联系电话 *"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <input
              className="border rounded-lg px-3 py-2 md:col-span-2"
              placeholder="邮箱（可选）"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="border rounded-lg px-3 py-2"
              placeholder="国家"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
            <input
              className="border rounded-lg px-3 py-2"
              placeholder="城市"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <input
              className="border rounded-lg px-3 py-2 md:col-span-2"
              placeholder="详细地址"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <input
              className="border rounded-lg px-3 py-2"
              placeholder="邮编"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
            />
          </div>

          {props.formMsg && (
            <div className="text-sm text-red-600">{props.formMsg}</div>
          )}

          <div className="pt-2 flex gap-3">
            <button
              type="submit"
              className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
              disabled={!cart.length}
            >
              提交订单
            </button>
          </div>
        </form>
      </>
    );
  }

  return (
    <div className="mt-6 text-center">
      <div className="text-lg font-semibold">订单已提交（本地保存）</div>
      <div className="text-sm text-gray-500 mt-2">
        你可在浏览器本地的 <code>lastOrder</code> 查看订单草稿，后续可接入后端接口。
      </div>
    </div>
  );
}

