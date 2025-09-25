'use client';

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';

/* ================== 类型 ================== */
type DetailItem = {
  num?: string;         // 编号
  product?: string;     // 标题
  name?: string;
  title?: string;
  oe?: string;          // OE
  brand?: string;       // 品牌
  model?: string;       // 车型
  year?: string;        // 年款
  image?: string | null;// 可能的单图
  img?: string | null;
  imgUrl?: string | null;
  pic?: string | null;
  picture?: string | null;
  url?: string | null;
  images?: any[];
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

/* ================== 常量 ================== */
const API_BASE = 'https://niuniuparts.com:6001/scm-product/v1/stock2';
const BASE_ORIGIN = new URL(API_BASE).origin;
const PAGE_SIZE = 20;
const MAX_PAGES_TO_SCAN = 30;

const FALLBACK_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-size="16">
        No Image
      </text>
    </svg>`
  );

/* ================== 图片工具 ================== */
function extractFirstUrl(s: string): string | null {
  if (!s || typeof s !== 'string') return null;
  const m1 = s.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m1?.[1]) return m1[1];
  const m2 = s.match(/https?:\/\/[^\s"'<>\\)]+/i);
  if (m2?.[0]) return m2[0];
  const m3 = s.match(/(^|[^:])\/\/[^\s"'<>\\)]+/i);
  if (m3) {
    const raw = m3[0];
    const hit = raw.slice(raw.indexOf('//'));
    if (hit.startsWith('//')) return hit;
  }
  const m4 = s.match(/\/[^\s"'<>\\)]+/);
  if (m4?.[0]) return m4[0];
  return null;
}

function isImgUrl(s: string): boolean {
  if (!s || typeof s !== 'string') return false;
  const v = s.trim();
  if (/^https?:\/\//i.test(v) || v.startsWith('//') || v.startsWith('/')) return true;
  if (/\.(png|jpe?g|webp|gif|bmp|svg|jfif|avif)(\?|#|$)/i.test(v)) return true;
  if (/\/(upload|image|images|img|media|file|files)\//i.test(v)) return true;
  if (/[?&](file|img|image|pic|path)=/i.test(v)) return true;
  return false;
}

function absolutize(u: string | null): string | null {
  if (!u) return null;
  let s = u.trim();
  if (!s) return null;
  if (s.startsWith('data:image')) return s;
  if (s.startsWith('//')) return 'http:' + s;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/')) return BASE_ORIGIN + s;
  return BASE_ORIGIN + '/' + s.replace(/^\.\//, '');
}
function toProxy(u: string): string {
  const clean = u.replace(/^https?:\/\//i, '');
  return `https://images.weserv.nl/?url=${encodeURIComponent(clean)}`;
}

function collectUrlsFromAny(v: any): string[] {
  const out: string[] = [];
  const push = (s: string | null) => {
    const url = s && (extractFirstUrl(s) || s);
    if (url && isImgUrl(url)) out.push(url);
  };
  if (!v) return out;
  if (typeof v === 'string') { push(v); return out; }
  if (Array.isArray(v)) { v.forEach((it) => out.push(...collectUrlsFromAny(it))); return out; }
  if (typeof v === 'object') {
    for (const k of Object.keys(v)) out.push(...collectUrlsFromAny(v[k]));
  }
  return out;
}

/** 深挖多图：最多 18 张 */
function pickMultiImages(x: any, max = 18): string[] {
  if (!x) return [];
  const FIELDS = [
    'image','imgUrl','img_url','imageUrl','image_url','picture','pic','picUrl','pic_url','thumbnail','thumb','url','path','src',
    'images','pictures','pics','photos','gallery','media','attachments',
    'content','html','desc','description'
  ];
  const bag: string[] = [];
  for (const k of FIELDS) if (k in x) bag.push(...collectUrlsFromAny((x as any)[k]));
  if (bag.length < max) bag.push(...collectUrlsFromAny(x));

  const uniq: string[] = [];
  for (const raw of bag) {
    const abs = absolutize(raw);
    if (!abs) continue;
    const final = abs.startsWith('http://') ? toProxy(abs) : abs;
    if (!uniq.includes(final)) uniq.push(final);
    if (uniq.length >= max) break;
  }
  return uniq.length ? uniq : [];
}

/* ================== 其它工具 ================== */
function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try { const raw = localStorage.getItem('cart') || '[]'; const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; }
  catch { return []; }
}
function saveCart(arr: CartItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('cart', JSON.stringify(arr));
}
function safeDecodeItem(encoded: string | null): DetailItem | null {
  if (!encoded) return null;
  try {
    const b64 = decodeURIComponent(encoded);
    const json = decodeURIComponent(escape(atob(b64)));
    const obj = JSON.parse(json);
    return (obj && typeof obj === 'object') ? (obj as DetailItem) : null;
  } catch { return null; }
}
function extractArray(js: any): any[] {
  if (Array.isArray(js)) return js;
  const cand =
    js?.content ??
    js?.data?.content ??
    js?.data?.records ??
    js?.data?.list ??
    js?.data ??
    js?.records ??
    js?.list ??
    null;
  return Array.isArray(cand) ? cand : [];
}

/* ================== 页面 ================== */
export default function StockDetailPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">加载中…</div>}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const params = useParams<{ num: string }>();
  const search = useSearchParams();

  const d = useMemo(() => search?.get('d') ?? null, [search]);
  const [item, setItem] = useState<DetailItem | null>(() => safeDecodeItem(d));

  const [images, setImages] = useState<string[]>(() => pickMultiImages(safeDecodeItem(d) || {}, 18));
  const [active, setActive] = useState(0);
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    const obj = safeDecodeItem(d);
    setItem(obj);
    const fromD = pickMultiImages(obj || {}, 18);
    if (fromD.length) { setImages(fromD); setActive(0); }
  }, [d]);

  // 兜底：按 num 扫描 API
  useEffect(() => {
    const hasEnough = images.length > 0 && (item?.product || item?.name || item?.title);
    if (hasEnough) return;

    const num = params?.num;
    if (!num) return;

    let cancelled = false;
    (async () => {
      try {
        for (let page = 0; page < MAX_PAGES_TO_SCAN; page++) {
          const url = `${API_BASE}?size=${PAGE_SIZE}&page=${page}`;
          const res = await fetch(url, { cache: 'no-store' });
          if (!res.ok) break;
          const json = await res.json();
          const arr = extractArray(json);
          if (!arr?.length) break;

          const found = arr.find((x: any) => String(x?.num || '').trim() === String(num).trim());
          if (found) {
            if (cancelled) return;
            const imgs = pickMultiImages(found, 18);
            setImages((prev) => (prev.length ? prev : imgs));
            setItem((prev) => ({
              ...prev,
              num: found.num ?? prev?.num,
              product: found.product ?? found.name ?? found.title ?? prev?.product,
              oe: found.oe ?? prev?.oe,
              brand: found.brand ?? prev?.brand,
              model: found.model ?? prev?.model,
              year: found.year ?? prev?.year,
              image: found.image ?? prev?.image ?? null,
              ...found,
            }));
            setActive(0);
            break;
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [params?.num, images.length, item?.product]);

  const title = item?.product || item?.name || item?.title || '未命名配件';
  const sub = [item?.brand, item?.model, item?.year].filter(Boolean).join(' · ') || 'IMG';
  const oe  = item?.oe;

  const mainSrc = images[active] || FALLBACK_IMG;
  const prev = () => setActive((i) => (images.length ? (i - 1 + images.length) % images.length : 0));
  const next = () => setActive((i) => (images.length ? (i + 1) % images.length : 0));

  const addToCart = () => {
    const firstImg = images[0] || null;
    const key = `${item?.num || ''}|${item?.oe || ''}|${Date.now()}`;
    const nextItem: CartItem = {
      key, num: item?.num, product: title, oe: item?.oe,
      brand: item?.brand, model: item?.model, year: item?.year,
      qty: 1, image: firstImg,
    };
    const list = loadCart();
    list.push(nextItem);
    saveCart(list);
    setAdded('已加入购物车（本地保存）！');
    setTimeout(() => setAdded(null), 1500);
  };

  return (
    <main className="container mx-auto p-4">
      <div className="mb-4 text-sm text-gray-500">
        <Link href="/stock" className="underline hover:text-gray-700">← 返回库存预览</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 多图画廊 */}
        <div className="rounded-2xl border bg-white p-3">
          <div className="relative rounded-xl overflow-hidden bg-white" style={{ width: '100%', height: 480 }}>
            <img
              src={mainSrc}
              alt={title}
              style={{ objectFit: 'contain', width: '100%', height: '100%' }}
              onError={(e) => { const el = e.currentTarget as HTMLImageElement; if (el.src !== FALLBACK_IMG) el.src = FALLBACK_IMG; }}
            />
            {images.length > 1 && (
              <>
                <button aria-label="上一张" onClick={prev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 px-3 py-2 text-gray-700 hover:bg-white shadow">‹</button>
                <button aria-label="下一张" onClick={next}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 px-3 py-2 text-gray-700 hover:bg-white shadow">›</button>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {images.map((src, idx) => (
                <button key={src + idx} onClick={() => setActive(idx)}
                  className={`h-16 w-16 shrink-0 rounded border ${idx === active ? 'ring-2 ring-blue-500' : 'opacity-80 hover:opacity-100'}`}
                  title={`图片 ${idx + 1}`}>
                  <img src={src} alt={`thumb-${idx + 1}`} className="h-full w-full object-contain"
                       onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG; }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 文案与操作 */}
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <div className="text-gray-500 mt-1">{sub}</div>
          {item?.num && <div className="text-gray-500 mt-1">编号：{item.num}</div>}
          {oe && <div className="text-gray-500 mt-1">OE：{oe}</div>}

          <div className="mt-6 flex gap-3">
            <button className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50" onClick={addToCart}>加入购物车</button>
            <button className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50" onClick={() => router.push('/stock?checkout=1')}>去结算</button>
          </div>

          {added && <div className="mt-3 text-green-600 text-sm">{added}</div>}

          <div className="mt-8 text-xs text-gray-400">数据源：niuniuparts.com（测试预览用途）</div>
        </div>
      </div>
    </main>
  );
}
