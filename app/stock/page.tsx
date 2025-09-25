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
  media?: any[];
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
const BASE_ORIGIN = new URL(API_BASE).origin;
const PAGE_SIZE = 20;

/* ================== 图片解析与兜底 ================== */

/** 判断“像图片地址” */
function isLikelyImageUrl(s: string): boolean {
  if (!s || typeof s !== 'string') return false;
  const v = s.trim();
  if (/^https?:\/\//i.test(v) || v.startsWith('//') || v.startsWith('/')) return true;
  if (/\.(png|jpe?g|webp|gif|bmp|svg|jfif|avif)(\?|#|$)/i.test(v)) return true;
  if (/\/(upload|image|images|img|media|file|files)\//i.test(v)) return true;
  if (/[?&](file|img|image|pic|path)=/i.test(v)) return true;
  return false;
}

/** 从任意字符串中抽第一个 URL（包含 HTML 片段时也可取出 <img src>） */
function extractFirstUrl(s: string): string | null {
  if (!s || typeof s !== 'string') return null;
  const m1 = s.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m1?.[1]) return m1[1];
  const m2 = s.match(/https?:\/\/[^\s"'<>\\)]+/i);
  if (m2?.[0]) return m2[0];
  const m3 = s.match(/(^|[^:])\/\/[^\s"'<>\\)]+/i);
  if (m3) {
    const raw = m3[0];
    const hit = raw.slice(raw.indexOf('//')); // 取到 //
    if (hit.startsWith('//')) return hit;
  }
  const m4 = s.match(/\/[^\s"'<>\\)]+/);
  if (m4?.[0]) return m4[0];
  return null;
}

/** 将 URL 规范化为可直接访问的绝对地址（但不强制 http→https） */
function absolutize(u: string | null): string | null {
  if (!u) return null;
  let s = u.trim();
  if (!s) return null;
  if (s.startsWith('data:image')) return s;
  if (s.startsWith('//')) return 'http:' + s; // 先保留 http，稍后可代理
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/')) return BASE_ORIGIN + s;
  return BASE_ORIGIN + '/' + s.replace(/^\.\//, '');
}

/** 通过 HTTPS 图片代理，解决 https 页面加载 http 图片被拦截的问题 */
function toProxy(u: string): string {
  // images.weserv.nl 要求不包含协议，或者用 url= 参数
  // 为兼容所有情况，这里统一用 url=，并移除协议
  const clean = u.replace(/^https?:\/\//i, '');
  return `https://images.weserv.nl/?url=${encodeURIComponent(clean)}`;
}

/** 深度扫描对象，尽量挖出第一张图片 URL（原始值） */
function deepFindImage(obj: any, depth = 0): string | null {
  if (!obj || depth > 4) return null;

  if (typeof obj === 'string') {
    const url = extractFirstUrl(obj) || obj;
    if (url && isLikelyImageUrl(url)) return url;
    return null;
  }

  if (Array.isArray(obj)) {
    for (const v of obj) {
      const hit = deepFindImage(v, depth + 1);
      if (hit) return hit;
    }
    return null;
  }

  if (typeof obj === 'object') {
    const PRIORITY_KEYS = [
      'image', 'imgUrl', 'img_url', 'imageUrl', 'image_url',
      'picture', 'pic', 'picUrl', 'pic_url',
      'thumbnail', 'thumb', 'url', 'path', 'src',
      'images', 'pictures', 'pics', 'photos', 'gallery', 'media', 'attachments',
      'content', 'html', 'desc', 'description',
    ];

    for (const k of PRIORITY_KEYS) {
      if (k in obj) {
        const v = (obj as any)[k];
        if (Array.isArray(v)) {
          for (const it of v) {
            const cand =
              typeof it === 'string'
                ? (extractFirstUrl(it) || it)
                : it?.url || it?.src || it?.path || extractFirstUrl(JSON.stringify(it));
            if (cand && isLikelyImageUrl(cand)) return cand;
            const deep = deepFindImage(it, depth + 1);
            if (deep) return deep;
          }
        } else {
          const hit = deepFindImage(v, depth + 1);
          if (hit) return hit;
        }
      }
    }

    for (const k of Object.keys(obj)) {
      const hit = deepFindImage(obj[k], depth + 1);
      if (hit) return hit;
    }
  }

  return null;
}

/** 在条目对象上挑出最可能的图片 URL（原始值，未做协议替换） */
function pickRawImageUrl(x: StockItem | CartItem): string | null {
  const anyx = x as any;
  const DIRECT_KEYS = [
    'image', 'imgUrl', 'img_url', 'imageUrl', 'image_url',
    'picture', 'pic', 'picUrl', 'pic_url', 'thumbnail', 'thumb', 'url', 'path', 'src',
  ];
  for (const k of DIRECT_KEYS) {
    const v = anyx?.[k];
    if (!v) continue;
    if (typeof v === 'string') {
      const url = extractFirstUrl(v) || v;
      if (url && isLikelyImageUrl(url)) return url;
    } else {
      const hit = deepFindImage(v);
      if (hit) return hit;
    }
  }

  const LIST_KEYS = ['images', 'pictures', 'pics', 'photos', 'gallery', 'media', 'attachments'];
  for (const k of LIST_KEYS) {
    const v = anyx?.[k];
    if (Array.isArray(v)) {
      for (const it of v) {
        const url =
          typeof it === 'string'
            ? (extractFirstUrl(it) || it)
            : it?.url || it?.src || it?.path || extractFirstUrl(JSON.stringify(it));
        if (url && isLikelyImageUrl(url)) return url;
      }
    }
  }

  return deepFindImage(anyx);
}

/** 返回：{ direct, proxy }，优先用 direct，失败再切 proxy */
function buildImageSources(raw: string | null): { direct: string; proxy: string } {
  // 先得到绝对地址（可能是 http）
  const abs = absolutize(raw || '') || '';
  if (!abs) {
    return { direct: '', proxy: '' };
  }
  // 如果是 http（或协议相对转成了 http），先用代理；但也提供 direct 作为备用
  if (abs.startsWith('http://')) {
    return { direct: toProxy(abs), proxy: toProxy(abs) };
  }
  // https 直链优先，备用代理
  return { direct: abs, proxy: toProxy(abs) };
}

/* ================== 其它工具与常量 ================== */

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
      const deep = (v as any).list || (v as any).items || (v as any).content || (v as any).records;
      if (Array.isArray(deep)) return deep;
    }
  }
  return [];
}

function mapToStockItem(x: any): StockItem {
  const num = x.num || x.sku || x.code || x.partNo || x.part || x.id || '';
  const product = x.product || x.name || x.title || x.desc || x.description || 'Part';
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
        (item as any).imgUrl ??
        (item as any).pic ??
        (item as any).picture ??
        (item as any).url ??
        (item as any).img ??
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

/* ================== 页面组件 ================== */

export default function StockPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">加载中…</div>}>
      <StockPageInner />
    </Suspense>
  );
}

function StockPageInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const checkoutOpen = !!(sp && sp.get('checkout'));
  const [q, setQ] = useState<string>(() => (sp?.get('q') || '').trim());
  useEffect(() => {
    setQ((sp?.get('q') || '').trim());
  }, [sp]);

  const [items, setItems] = useState<StockItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [tradeMode, setTradeMode] = useState<'B2C' | 'B2B'>('B2C');
  const [company, setCompany] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'GBP' | 'CNY'>('USD');
  const [incoterm, setIncoterm] = useState<'EXW' | 'FOB' | 'CIF' | 'DAP'>('EXW');
  const [shipping, setShipping] = useState<'Express' | 'Air' | 'Sea'>('Express');
  const [note, setNote] = useState('');
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setCart(loadCart());
    try {
      const pref = localStorage.getItem('preferredTradeMode');
      if (pref === 'B2B' || pref === 'B2C') setTradeMode(pref);
    } catch {}
  }, [checkoutOpen]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'cart') setCart(loadCart());
      if (e.key === 'preferredTradeMode') {
        const pref = e.newValue === 'B2B' ? 'B2B' : 'B2C';
        setTradeMode(pref);
      }
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

  function 公司名称有效(v: string) {
    return v && v.trim().length >= 2;
  }

  const submitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);

    if (!cart.length) return setFormMsg('购物车为空');
    if (!name.trim()) return setFormMsg('请填写联系人姓名');
    if (!phone.trim() || phone.trim().length < 6) return setFormMsg('请填写有效联系电话（至少6位）');
    const emailVal = email.trim();
    const emailOK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal);
    if (!emailVal || !emailOK) return setFormMsg('请填写有效邮箱地址');
    if (tradeMode === 'B2B' && !公司名称有效(company)) return setFormMsg('B2B 模式下，公司名称为必填项');

    const order = {
      id: 'ORD-' + Date.now(),
      mode: tradeMode,
      terms: { currency, incoterm, shipping },
      contact: {
        company: tradeMode === 'B2B' ? company.trim() : undefined,
        name,
        phone,
        email: emailVal,
        country,
        city,
        address,
        postcode,
      },
      note: note.trim() || undefined,
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

  // 搜索过滤（客户端）
  const filteredItems = useMemo(() => {
    const kw = (q || '').toLowerCase();
    if (!kw) return items;
    return items.filter((it) => {
      const bag = [it.num, it.oe, it.product, it.brand, it.model]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return bag.includes(kw);
    });
  }, [items, q]);

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

      {/* 搜索 + 购物车按钮 */}
      <div className="mb-3 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex items-center gap-2 w-full md:w-[520px]">
          <input
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
            placeholder="搜索：OE号 / 商品名 / 品牌 / 车型"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const qs = q ? `?q=${encodeURIComponent(q)}` : '';
                router.push(`/stock${qs}`);
              }
            }}
          />
          <button
            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
            onClick={() => {
              const qs = q ? `?q=${encodeURIComponent(q)}` : '';
              router.push(`/stock${qs}`);
            }}
          >
            搜索
          </button>
          {q && (
            <button
              className="rounded-lg border px-2 py-2 text-xs hover:bg-gray-50"
              onClick={() => {
                setQ('');
                router.push('/stock');
              }}
            >
              清空
            </button>
          )}
        </div>

        <button
          onClick={() => router.push(`/stock?checkout=1`)}
          className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 self-end md:self-auto"
        >
          购物车 / 结算 {totalQty ? `(${totalQty})` : ''}
        </button>
      </div>

      {/* 列表 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.length === 0 ? (
          <div className="col-span-full text-sm text-gray-500">无匹配结果。</div>
        ) : (
          filteredItems.map((item) => {
            const raw = pickRawImageUrl(item);
            const { direct, proxy } = buildImageSources(raw);
            const firstSrc = direct || proxy || FALLBACK_IMG;
            const alt =
              [item.brand, item.product, item.model, item.oe]
                .filter(Boolean)
                .join(' ') || 'Product Image';
            const d = encodeItemForUrl(item);
            const href = `/stock/${encodeURIComponent(item.num || '')}${d ? `?d=${d}` : ''}`;

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
                      src={firstSrc}
                      alt={alt}
                      width={120}
                      height={120}
                      style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                      onError={(e) => {
                        const el = e.currentTarget as HTMLImageElement;
                        // 如果当前不是代理且有代理，先切换到代理；否则用占位图
                        const isProxy = el.src.includes('images.weserv.nl/?url=');
                        if (!isProxy && proxy) el.src = proxy;
                        else if (el.src !== FALLBACK_IMG) el.src = FALLBACK_IMG;
                      }}
                      loading="lazy"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold group-hover:underline truncate">
                      {item.product}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      {[item.brand, item.model, item.year].filter(Boolean).join(' · ')}
                    </div>
                    {item.oe && (
                      <div className="text-xs text-gray-400 mt-1">OE: {item.oe}</div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
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

      {/* ======= 结算面板（?checkout=1） ======= */}
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

            {!submitted ? (
              <>
                {/* 购物车列表 */}
                <div className="mt-4">
                  <h3 className="font-medium mb-2">购物车（{totalQty}）</h3>
                  {cart.length === 0 ? (
                    <div className="text-sm text-gray-500">购物车为空。</div>
                  ) : (
                    <ul className="space-y-3">
                      {cart.map((it) => {
                        const raw = pickRawImageUrl(it);
                        const { direct, proxy } = buildImageSources(raw);
                        const firstSrc = direct || proxy || FALLBACK_IMG;
                        const alt =
                          [it.brand, it.product, it.model, it.oe].filter(Boolean).join(' ') ||
                          'Product';
                        return (
                          <li key={it.key} className="flex gap-3 border rounded-xl p-3">
                            <div
                              className="relative rounded-lg overflow-hidden bg-white shrink-0"
                              style={{ width: 72, height: 72 }}
                            >
                              <img
                                src={firstSrc}
                                alt={alt}
                                width={72}
                                height={72}
                                style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                                onError={(e) => {
                                  const el = e.currentTarget as HTMLImageElement;
                                  const isProxy = el.src.includes('images.weserv.nl/?url=');
                                  if (!isProxy && proxy) el.src = proxy;
                                  else if (el.src !== FALLBACK_IMG) el.src = FALLBACK_IMG;
                                }}
                                loading="lazy"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{it.product}</div>
                              <div className="text-xs text-gray-500 truncate">
                                {[it.brand, it.model].filter(Boolean).join(' · ')}
                              </div>
                              {it.oe && <div className="text-xs text-gray-400">OE: {it.oe}</div>}
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
                      <button className="text-xs text-gray-500 underline" onClick={clearCart}>
                        清空购物车
                      </button>
                    </div>
                  )}
                </div>

                {/* 交易模式：B2C / B2B（默认从首页读取） */}
                <div className="mt-6">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">交易模式：</span>
                    <button
                      className={`rounded-md border px-3 py-1 ${tradeMode === 'B2C' ? 'bg-gray-100' : ''}`}
                      onClick={() => setTradeMode('B2C')}
                      type="button"
                    >
                      B2C（个人）
                    </button>
                    <button
                      className={`rounded-md border px-3 py-1 ${tradeMode === 'B2B' ? 'bg-gray-100' : ''}`}
                      onClick={() => setTradeMode('B2B')}
                      type="button"
                    >
                      B2B（公司）
                    </button>
                  </div>
                </div>

                {/* 国际化贸易条款 */}
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 shrink-0">货币：</span>
                    <select
                      className="border rounded-lg px-2 py-1 w-full"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as any)}
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="CNY">CNY</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 shrink-0">Incoterms：</span>
                    <select
                      className="border rounded-lg px-2 py-1 w-full"
                      value={incoterm}
                      onChange={(e) => setIncoterm(e.target.value as any)}
                    >
                      <option value="EXW">EXW</option>
                      <option value="FOB">FOB</option>
                      <option value="CIF">CIF</option>
                      <option value="DAP">DAP</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 shrink-0">运输：</span>
                    <select
                      className="border rounded-lg px-2 py-1 w-full"
                      value={shipping}
                      onChange={(e) => setShipping(e.target.value as any)}
                    >
                      <option value="Express">Express</option>
                      <option value="Air">Air</option>
                      <option value="Sea">Sea</option>
                    </select>
                  </div>
                </div>

                {/* 收货信息表单 */}
                <form className="mt-4 space-y-3" onSubmit={submitOrder}>
                  <h3 className="font-medium">收货信息</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {tradeMode === 'B2B' && (
                      <input
                        className="border rounded-lg px-3 py-2 md:col-span-2"
                        placeholder="公司名称（必填）"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                      />
                    )}
                    <input className="border rounded-lg px-3 py-2" placeholder="联系人姓名 *" value={name} onChange={(e) => setName(e.target.value)} />
                    <input className="border rounded-lg px-3 py-2" placeholder="联系电话 *" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    <input className="border rounded-lg px-3 py-2 md:col-span-2" placeholder="邮箱（必填）" required value={email} onChange={(e) => setEmail(e.target.value)} />
                    <input className="border rounded-lg px-3 py-2" placeholder="国家" value={country} onChange={(e) => setCountry(e.target.value)} />
                    <input className="border rounded-lg px-3 py-2" placeholder="城市" value={city} onChange={(e) => setCity(e.target.value)} />
                    <input className="border rounded-lg px-3 py-2 md:col-span-2" placeholder="详细地址" value={address} onChange={(e) => setAddress(e.target.value)} />
                    <input className="border rounded-lg px-3 py-2" placeholder="邮编" value={postcode} onChange={(e) => setPostcode(e.target.value)} />
                  </div>

                  <textarea
                    className="border rounded-lg px-3 py-2 w-full"
                    rows={3}
                    placeholder="订单备注（选填：发票抬头/税号、收件时间、包装要求等）"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />

                  {formMsg && <div className="text-sm text-red-600">{formMsg}</div>}

                  <div className="pt-2 flex gap-3">
                    <button type="submit" className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50" disabled={!cart.length}>
                      提交订单
                    </button>
                    <button type="button" className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50" onClick={() => router.push('/stock')}>
                      继续浏览
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="mt-6 text-center">
                <div className="text-lg font-semibold">订单已提交（本地保存）</div>
                <div className="text-sm text-gray-500 mt-2">
                  你可在浏览器本地的 <code>lastOrder</code> 查看订单草稿（包含货币、Incoterms、运输方式与备注），后续可接入后端接口。
                </div>
                <div className="mt-6">
                  <button className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50" onClick={() => router.push('/stock')}>
                    返回库存预览
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

