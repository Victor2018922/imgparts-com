'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

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

const API_BASE = 'https://niuniuparts.com:6001/scm-product/v1/stock2?size=20&page=0';

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

function safeDecodeItem(dParam: string | null): DetailItem | null {
  if (!dParam) return null;
  try {
    const s = decodeURIComponent(dParam);
    // 浏览器端：atob 可用
    const json = decodeURIComponent(escape(atob(s)));
    const obj = JSON.parse(json);
    // 确保关键字段存在
    return {
      num: obj.num || '',
      product: obj.product || 'Part',
      oe: obj.oe || '',
      brand: obj.brand || '',
      model: obj.model || '',
      year: obj.year || '',
      image: obj.image ?? null,
    };
  } catch {
    return null;
  }
}

export default function StockDetailPage({ params }: { params: { num: string } }) {
  const search = useSearchParams();
  const d = search.get('d');
  const [item, setItem] = useState<DetailItem | null>(() => safeDecodeItem(d));
  const [banner, setBanner] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // 若没有携带 d 参数，尝试从第一页里找同 num 的条目做兜底
  useEffect(() => {
    async function fallbackFetch() {
      if (item) return;
      try {
        const res = await fetch(API_BASE, { cache: 'no-store' });
        if (!res.ok) {
          setBanner(`⚠️ 详情未携带数据且远端兜底失败：HTTP ${res.status}`);
          return;
        }
        const json = await res.json();
        const arr =
          Array.isArray(json) ? json :
          (json?.content || json?.data?.list || json?.data?.items || json?.items || json?.records || []);
        const found = Array.isArray(arr) ? arr.find((x: any) => (x?.num || x?.sku || x?.partNo || x?.code) === params.num) : null;
        if (found) {
          setItem({
            num: found.num || found.sku || found.partNo || found.code || params.num,
            product: found.product || found.name || 'Part',
            oe: found.oe || found.oeNo || '',
            brand: found.brand || '',
            model: found.model || '',
            year: found.year || '',
            image: found.image ?? found.img ?? found.imgUrl ?? found.pic ?? found.picture ?? found.url ?? null,
            ...found,
          });
          setBanner('ℹ️ 详情未携带数据：已从第一页兜底匹配同 num');
        } else {
          setBanner('⚠️ 详情未携带数据，且第一页未找到相同 num');
        }
      } catch (e: any) {
        setBanner(`⚠️ 详情兜底异常：${e?.message || '未知错误'}`);
        setErr(e?.message || 'Load failed');
      }
    }
    fallbackFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.num]);

  const display = useMemo<DetailItem>(() => {
    return (
      item || {
        num: params.num,
        product: 'Part',
        brand: '',
        model: '',
        year: '',
      }
    );
  }, [item, params.num]);

  const raw = pickRawImageUrl(display);
  const src = normalizeImageUrl(raw) || FALLBACK_DATA_URL;
  const alt = [display.brand, display.product, display.model, display.oe].filter(Boolean).join(' ') || 'Product Image';

  return (
    <main className="container mx-auto p-4">
      {banner && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800 text-sm">
          {banner}
        </div>
      )}

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
          <h1 className="text-xl font-semibold mb-2">{display.product}</h1>
          <p className="text-gray-600">
            {[display.brand, display.model, display.year].filter(Boolean).join(' · ')}
          </p>
          {display.oe && <p className="text-sm text-gray-400 mt-2">OE: {display.oe}</p>}
          <p className="text-xs text-gray-400 mt-4">数据源：niuniuparts.com（测试预览用途）</p>
          {err && <p className="text-xs text-red-500 mt-2">Debug：{err}</p>}
        </section>
      </div>
    </main>
  );
}
