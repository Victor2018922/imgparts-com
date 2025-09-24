'use client';

import React, { useEffect, useState, useCallback } from 'react';
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

const API_BASE = 'https://niuniuparts.com:6001/scm-product/v1/stock2';
const PAGE_SIZE = 20;

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

function normalizeImageUrl(u: string | null): string | null {
  if (!u) return null;
  if (u.startsWith('//')) return 'https:' + u;
  if (u.startsWith('http://')) return 'https://' + u.slice(7);
  return u;
}

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

function extractArrayPayload(json: any): any[] {
  if (Array.isArray(json)) return json;
  const candidates = ['content', 'data', 'items', 'records', 'list', 'result'];
  for (const k of candidates) {
    const v = json?.[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') {
      const deep = v.list || v.items || v.content || v.records;
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
        item.img ??
        item.imgUrl ??
        item.pic ??
        item.picture ??
        item.url ??
        null,
    };
    const s = JSON.stringify(compact);
    return encodeURIComponent(btoa(unescape(encodeURIComponent(s))));
  } catch {
    return '';
  }
}

export default function StockPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
            setItems(prev => (p === 0 ? arr : [...prev, ...arr]));
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(item => {
          const raw = pickRawImageUrl(item);
          const src = normalizeImageUrl(raw) || FALLBACK_DATA_URL;
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
                    onError={e => {
                      const el = e.currentTarget as HTMLImageElement;
                      if (el.src !== FALLBACK_DATA_URL) el.src = FALLBACK_DATA_URL;
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
    </main>
  );
}
