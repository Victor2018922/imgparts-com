'use client';

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

/* ========= 类型 ========= */

type DetailItem = {
  num?: string;
  product: string;
  oe?: string;
  brand?: string;
  model?: string;
  year?: string;
  image?: string | null;
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

/* ========= 常量 ========= */

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

/* ========= 工具：图片提取 + 代理 ========= */

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

function isLikelyImageUrl(s: string): boolean {
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

function buildImageSources(raw: string | null): { direct: string; proxy: string } {
  const abs = absolutize(raw || '') || '';
  if (!abs) return { direct: '', proxy: '' };
  if (abs.startsWith('http://')) {
    const p = toProxy(abs);
    return { direct: p, proxy: p };
  }
  return { direct: abs, proxy: toProxy(abs) };
}

/* ========= 其它工具 ========= */

function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('cart') || '[]';
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveCart(arr: CartItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('cart', JSON.stringify(arr));
}

/** 解码列表页塞进来的 d：修复乱码关键点 —— 需要 escape() 再 decodeURIComponent */
function safeDecodeItem(d: string | null): DetailItem | null {
  if (!d) return null;
  try {
    const b64 = decodeURIComponent(d);
    // 与列表页的 btoa(unescape(encodeURIComponent())) 完全对称
    const json = decodeURIComponent(escape(atob(b64)));
    const obj = JSON.parse(json);
    if (obj && typeof obj === 'object') return obj as DetailItem;
  } catch {}
  return null;
}

/* ========= 页面 ========= */

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

  // 安全读取 d
  const d = useMemo(() => search?.get('d') ?? null, [search]);

  const [item, setItem] = useState<DetailItem | null>(() => safeDecodeItem(d));
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    setItem(safeDecodeItem(d));
  }, [d]);

  const title =
    item?.product || item?.name || item?.title || '未命名配件';
  const sub = [item?.brand, item?.model, item?.year].filter(Boolean).join(' · ') || 'IMG';
  const oe = item?.oe;

  const img = useMemo(() => {
    const raw = item?.image || item?.imgUrl || item?.img || item?.pic || item?.picture || item?.url || null;
    return buildImageSources(raw);
  }, [item]);

  const addToCart = () => {
    if (!item) return;
    const key = `${item.num || ''}|${item.oe || ''}|${Date.now()}`;
    const next: CartItem = {
      key,
      num: item.num,
      product: item.product || title,
      oe: item.oe,
      brand: item.brand,
      model: item.model,
      year: item.year,
      qty: 1,
      image: item.image || null,
    };
    const cart = [...loadCart(), next];
    saveCart(cart);
    setAdded('已加入购物车（本地保存）！');
    setTimeout(() => setAdded(null), 1600);
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
              src={img.direct || img.proxy || FALLBACK_IMG}
              alt={title}
              style={{ objectFit: 'contain', width: '100%', height: '100%' }}
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                const isProxy = el.src.includes('images.weserv.nl/?url=');
                if (!isProxy && img.proxy) el.src = img.proxy;
                else if (el.src !== FALLBACK_IMG) el.src = FALLBACK_IMG;
              }}
            />
          </div>
        </div>

        {/* 文案与操作 */}
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <div className="text-gray-500 mt-1">{sub}</div>
          {oe && <div className="text-gray-400 text-sm mt-2">OE: {oe}</div>}

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
