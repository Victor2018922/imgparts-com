'use client';

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

/* ================== 类型 ================== */
type DetailItem = {
  num?: string;
  product?: string;
  name?: string;
  title?: string;
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

/* ================== 图片工具（与列表页同策略） ================== */
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

function deepFindImage(obj: any, depth = 0): string | null {
  if (!obj || depth > 4) return null;

  if (typeof obj === 'string') {
    const url = extractFirstUrl(obj) || obj;
    if (url && isImgUrl(url)) return url;
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
    const PRIORITY = [
      'image','imgUrl','img_url','imageUrl','image_url',
      'picture','pic','picUrl','pic_url','thumbnail','thumb','url','path','src',
      'images','pictures','pics','photos','gallery','media','attachments',
      'content','html','desc','description'
    ];
    for (const k of PRIORITY) {
      if (!(k in obj)) continue;
      const v = (obj as any)[k];
      if (Array.isArray(v)) {
        for (const it of v) {
          const cand = typeof it === 'string'
            ? (extractFirstUrl(it) || it)
            : it?.url || it?.src || it?.path || extractFirstUrl(JSON.stringify(it));
          if (cand && isImgUrl(cand)) return cand;
          const deep = deepFindImage(it, depth + 1);
          if (deep) return deep;
        }
      } else {
        const hit = deepFindImage(v, depth + 1);
        if (hit) return hit;
      }
    }
    for (const k of Object.keys(obj)) {
      const hit = deepFindImage(obj[k], depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

function pickRawImageUrl(x: any): string | null {
  const DIRECT = [
    'image','imgUrl','img_url','imageUrl','image_url',
    'picture','pic','picUrl','pic_url','thumbnail','thumb','url','path','src'
  ];
  for (const k of DIRECT) {
    const v = (x as any)?.[k];
    if (!v) continue;
    if (typeof v === 'string') {
      const url = extractFirstUrl(v) || v;
      if (url && isImgUrl(url)) return url;
    } else {
      const hit = deepFindImage(v);
      if (hit) return hit;
    }
  }
  const LIST = ['images','pictures','pics','photos','gallery','media','attachments'];
  for (const k of LIST) {
    const v = (x as any)?.[k];
    if (Array.isArray(v)) {
      for (const it of v) {
        const url = typeof it === 'string'
          ? (extractFirstUrl(it) || it)
          : it?.url || it?.src || it?.path || extractFirstUrl(JSON.stringify(it));
        if (url && isImgUrl(url)) return url;
      }
    }
  }
  return deepFindImage(x);
}

function buildSrcs(raw: string | null): { direct: string; proxy: string } {
  const abs = absolutize(raw || '') || '';
  if (!abs) return { direct: '', proxy: '' };
  if (abs.startsWith('http://')) {
    const p = toProxy(abs);
    return { direct: p, proxy: p };
  }
  return { direct: abs, proxy: toProxy(abs) };
}

/* ================== 其它工具 ================== */
function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('cart') || '[]';
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveCart(arr: CartItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('cart', JSON.stringify(arr));
}

/** 关键修复：UTF-8 对称解码，避免标题乱码 */
function safeDecodeItem(encoded: string | null): DetailItem | null {
  if (!encoded) return null;
  try {
    const b64 = decodeURIComponent(encoded);
    const json = decodeURIComponent(escape(atob(b64)));
    const obj = JSON.parse(json);
    return (obj && typeof obj === 'object') ? (obj as DetailItem) : null;
  } catch {
    return null;
  }
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
  const search = useSearchParams();

  const d = useMemo(() => search?.get('d') ?? null, [search]);
  const [item, setItem] = useState<DetailItem | null>(() => safeDecodeItem(d));
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => setItem(safeDecodeItem(d)), [d]);

  // 标题与副标题
  const title = item?.product || item?.name || item?.title || '未命名配件';
  const sub = [item?.brand, item?.model, item?.year].filter(Boolean).join(' · ') || 'IMG';
  const oe = item?.oe;

  // 图片：对 d 里的对象做一次“深挖”
  const src = useMemo(() => {
    const raw = pickRawImageUrl(item || {});
    return buildSrcs(raw);
  }, [item]);

  const addToCart = () => {
    if (!item) return;
    const key = `${item.num || ''}|${item.oe || ''}|${Date.now()}`;
    const next: CartItem = {
      key,
      num: item.num,
      product: title,
      oe: item.oe,
      brand: item.brand,
      model: item.model,
      year: item.year,
      qty: 1,
      image: pickRawImageUrl(item || {}),
    };
    const cart = [...loadCart(), next];
    saveCart(cart);
    setAdded('已加入购物车（本地保存）！');
    setTimeout(() => setAdded(null), 1500);
  };

  return (
    <main className="container mx-auto p-4">
      <div className="mb-4 text-sm text-gray-500">
        <Link href="/stock" className="underline hover:text-gray-700">← 返回库存预览</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 大图 */}
        <div className="rounded-2xl border bg-white p-3">
          <div className="relative rounded-xl overflow-hidden bg-white" style={{ width: '100%', height: 480 }}>
            <img
              src={src.direct || src.proxy || FALLBACK_IMG}
              alt={title}
              style={{ objectFit: 'contain', width: '100%', height: '100%' }}
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                const isProxy = el.src.includes('images.weserv.nl/?url=');
                if (!isProxy && src.proxy) el.src = src.proxy;
                else if (el.src !== FALLBACK_IMG) el.src = FALLBACK_IMG;
              }}
            />
          </div>
        </div>

        {/* 文案与操作 */}
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <div className="text-gray-500 mt-1">{sub}</div>
          <div className="text-gray-500 mt-1">{item?.num ? `编号：${item.num}` : null}</div>
          {oe && <div className="text-gray-500 mt-1">OE：{oe}</div>}

          <div className="mt-6 flex gap-3">
            <button className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50" onClick={addToCart}>
              加入购物车
            </button>
            <button className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50" onClick={() => router.push('/stock?checkout=1')}>
              去结算
            </button>
          </div>

          {added && <div className="mt-3 text-green-600 text-sm">{added}</div>}

          <div className="mt-8 text-xs text-gray-400">
            数据源：niuniuparts.com（测试预览用途）
          </div>
        </div>
      </div>
    </main>
  );
}
