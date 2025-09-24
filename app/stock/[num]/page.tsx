'use client';

import React, { useEffect, useState } from 'react';

type DetailItem = {
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

function pickRawImageUrl(x: DetailItem): string | null {
  const keys = ['image', 'img', 'imgUrl', 'pic', 'picture', 'url'];
  for (const k of keys) {
    const v = (x as any)?.[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  const media = (x as any)?.media;
  if (Array.isArray(media) && media[0]?.url) return media[0].url;
  return null;
}

function normalizeImageUrl(u: string | null): string | null {
  if (!u) return null;
  if (u.startsWith('//')) return 'https:' + u;
  if (u.startsWith('http://')) return 'https://' + u.slice(7);
  return u;
}

const FALLBACK_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-size="16">
        No Image
      </text>
    </svg>`
  );

export default function StockDetailPage({ params }: { params: { num: string } }) {
  const [item, setItem] = useState<DetailItem | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const url = `${process.env.NEXT_PUBLIC_STOCK_API_DETAIL!}?num=${encodeURIComponent(
          params.num
        )}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setItem(json);
      } catch (e: any) {
        setErr(e?.message || 'Load failed');
      }
    }
    load();
  }, [params.num]);

  if (err) {
    return (
      <main className="container mx-auto p-4">
        <div className="text-red-600">加载失败：{err}</div>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="container mx-auto p-4">
        <div>加载中…</div>
      </main>
    );
  }

  const raw = pickRawImageUrl(item);
  const src = normalizeImageUrl(raw) || FALLBACK_DATA_URL;
  const alt = [item.brand, item.product, item.model, item.oe].filter(Boolean).join(' ') || 'Product Image';

  return (
    <main className="container mx-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="relative rounded-xl overflow-hidden bg-white" style={{ width: 360, height: 360 }}>
          <img
            src={src}
            alt={alt}
            width={360}
            height={360}
            style={{ objectFit: 'contain', width: '100%', height: '100%' }}
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              if (el.src !== FALLBACK_DATA_URL) el.src = FALLBACK_DATA_URL;
            }}
            loading="eager"
          />
        </div>

        <section>
          <h1 className="text-xl font-semibold mb-2">{item.product}</h1>
          <p className="text-gray-600">
            {[item.brand, item.model, item.year].filter(Boolean).join(' · ')}
          </p>
          {item.oe && <p className="text-sm text-gray-400 mt-2">OE: {item.oe}</p>}

          {/* 这里可继续补充规格、价格、库存、加入购物车等 */}
        </section>
      </div>
    </main>
  );
}
