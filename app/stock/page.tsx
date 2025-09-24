'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

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

function pickRawImageUrl(x: StockItem): string | null {
  const keys = ['image', 'img', 'imgUrl', 'pic', 'picture', 'url'];
  for (const k of keys) {
    const v = (x as any)?.[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  const media = (x as any)?.media;
  if (Array.isArray(media) && media[0]?.url) return media[0].url;
  return null;
}

// 把 http 升级到 https（大多数 CDN/站点支持 https；不支持则走兜底）
function normalizeImageUrl(u: string | null): string | null {
  if (!u) return null;
  if (u.startsWith('//')) return 'https:' + u;
  if (u.startsWith('http://')) return 'https://' + u.slice(7);
  return u;
}

// 内联 SVG 占位（无需新增文件）
const FALLBACK_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-size="14">
        No Image
      </text>
    </svg>`
  );

export default function StockPage() {
  const [data, setData] = useState<StockItem[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const url = process.env.NEXT_PUBLIC_STOCK_API!;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(Array.isArray(json) ? json : []);
      } catch (e: any) {
        setErr(e?.message || 'Load failed');
      }
    }
    load();
  }, []);

  if (err) {
    return (
      <main className="container mx-auto p-4">
        <div className="text-red-600">加载失败：{err}</div>
      </main>
    );
  }

  return (
    <main className="container mx-auto p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.map((item) => {
        const raw = pickRawImageUrl(item);
        const src = normalizeImageUrl(raw) || FALLBACK_DATA_URL;
        const alt =
          [item.brand, item.product, item.model, item.oe].filter(Boolean).join(' ') || 'Product Image';

        return (
          <Link
            key={item.num}
            href={`/stock/${item.num}`}
            className="group block rounded-2xl border p-3 hover:shadow"
          >
            <div className="flex gap-3">
              <div
                className="relative rounded-xl overflow-hidden bg-white shrink-0"
                style={{ width: 120, height: 120 }}
              >
                {/* 用原生 <img>，避免域白名单限制；onError 兜底 */}
                <img
                  src={src}
                  alt={alt}
                  width={120}
                  height={120}
                  style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                  onError={(e) => {
                    const el = e.currentTarget as HTMLImageElement;
                    if (el.src !== FALLBACK_DATA_URL) el.src = FALLBACK_DATA_URL;
                  }}
                  loading="lazy"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold group-hover:underline truncate">{item.product}</div>
                <div className="text-sm text-gray-500 truncate">
                  {[item.brand, item.model, item.year].filter(Boolean).join(' · ')}
                </div>
                {item.oe && <div className="text-xs text-gray-400 mt-1">OE: {item.oe}</div>}
              </div>
            </div>
          </Link>
        );
      })}
    </main>
  );
}
