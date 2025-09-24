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

const FALLBACK_LIST_API = 'https://niuniuparts.com:6001/scm-product/v1/stock2?size=20&page=0';

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
    const json = decodeURIComponent(escape(atob(s)));
    const obj = JSON.parse(json);
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

  useEffect(() => {
    async function fallbackFetch() {
      if (item) return;
      try {
        const res = await fetch(FALLBACK_LIST_API, { cache: 'no-store' });
        if (!res.ok) {
          setBanner(`⚠️ 详情未携带数据且兜底失败：HTTP ${res.status}`);
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
            image: found.image
