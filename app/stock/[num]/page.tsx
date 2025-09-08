'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type AnyItem = Record<string, any>;

function pickFirst<T = any>(...candidates: T[]) {
  for (const c of candidates) {
    if (c === undefined || c === null) continue;
    if (typeof c === 'string' && c.trim() === '') continue;
    return c as T;
  }
  return undefined as unknown as T;
}

function pickImage(item: AnyItem): string | null {
  // 单值字段
  const single =
    pickFirst(
      item.image,
      item.img,
      item.picture,
      item.photo,
      item.thumbnail,
      item.cover,
      item.imageUrl,
      item.imgUrl,
      item.picUrl,
      item.photoUrl,
      item.thumbnailUrl,
      item.coverUrl,
      item.mainImage,
      item.main_image,
      item.url
    );

  if (typeof single === 'string') return single;

  // 数组字段
  const arrays: any[] = [
    item.images,
    item.imgs,
    item.pictures,
    item.photos,
    item.thumbnails,
    item.gallery,
    item.media,
  ].filter(Boolean);

  for (const arr of arrays) {
    if (Array.isArray(arr) && arr.length > 0) {
      const first = arr[0];
      if (typeof first === 'string') return first;
      if (first && typeof first === 'object') {
        const nested = pickFirst(
          first.url,
          first.src,
          first.image,
          first.img,
          first.thumbnail
        );
        if (typeof nested === 'string') return nested;
      }
    }
  }

  return null;
}

function pickPrice(item: AnyItem): string | number | null {
  const val = pickFirst(
    item.price,
    item.salePrice,
    item.retailPrice,
    item.unitPrice,
    item.usdPrice,
    item.priceUsd,
    item.cnyPrice,
    item.priceRmb
  );
  return val ?? null;
}

function pickStock(item: AnyItem): string | number | null {
  const val = pickFirst(
    item.stock,
    item.qty,
    item.quantity,
    item.stockQty,
    item.inventory,
    item.balance,
    item.onHand
  );
  return val ?? null;
}

export default function ItemPage({ params }: { params: { num: string } }) {
  const { num } = params;
  const [item, setItem] = useState<AnyItem | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // 相对路径，避免 SSR 环境变量问题
        const res = await fetch(`/api/stock/item?num=${encodeURIComponent(num)}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setItem(data);
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    })();
  }, [num]);

  const view = useMemo(() => {
    if (!item) return null;
    const name = pickFirst(item.product, item.name, item.title, item.oe, '—');
    const brand = pickFirst(item.brand, item.make, '—');
    const model = pickFirst(item.model, item.vehicle, '—');
    const year = pickFirst(item.year, item.years, '—');
    const price = pickPrice(item) ?? 'N/A';
    const stock = pickStock(item) ?? 'N/A';
    const image = pickImage(item);

    return { name, brand, model, year, price, stock, image };
  }, [item]);

  if (err) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Product Detail</h1>
        <p style={{ color: 'red' }}>加载失败：{err}</p>
        <p style={{ marginTop: 16 }}>
          <Link href="/stock">← 返回列表</Link>
        </p>
      </div>
    );
  }

  if (!item || !view) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Product Detail</h1>
        <p>加载中…</p>
        <p style={{ marginTop: 16 }}>
          <Link href="/stock">← 返回列表</Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Product Detail</h1>
      <p><strong>Num:</strong> {num}</p>
      <p><strong>Name:</strong> {view.name}</p>
      <p><strong>Brand:</strong> {view.brand}</p>
      <p><strong>Model:</strong> {view.model}</p>
      <p><strong>Year:</strong> {view.year}</p>
      <p><strong>Price:</strong> {view.price}</p>
      <p><strong>Stock:</strong> {view.stock}</p>

      {view.image ? (
        <div style={{ marginTop: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={view.image}
            alt={String(view.name)}
            style={{ maxWidth: 420, width: '100%', height: 'auto', borderRadius: 8, border: '1px solid #eee' }}
          />
        </div>
      ) : null}

      <p style={{ marginTop: 20 }}>
        <Link href="/stock">
          <button style={{ padding: '10px 20px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: 6 }}>
            ← 返回列表
          </button>
        </Link>
      </p>

      <div style={{ marginTop: 28, fontSize: 12, color: '#666' }}>
        数据源：niuniuparts.com（测试预览用途）
      </div>
    </div>
  );
}
