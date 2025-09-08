'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type AnyItem = Record<string, any>;

export default function ItemPage({ params }: { params: { num: string } }) {
  const { num } = params;
  const [item, setItem] = useState<AnyItem | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // 关键：使用相对地址，避免环境变量导致 SSR 崩溃
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

  if (!item) {
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

  // 适配不同字段名
  const name = item.product ?? item.name ?? item.title ?? item.oe ?? '—';
  const brand = item.brand ?? item.make ?? '—';
  const model = item.model ?? item.vehicle ?? '—';
  const year = item.year ?? item.years ?? '—';
  const price = item.price ?? item.salePrice ?? item.retailPrice ?? 'N/A';
  const stock = item.stock ?? item.qty ?? item.quantity ?? 'N/A';
  const image =
    item.image ??
    item.img ??
    item.picture ??
    item.thumbnail ??
    null;

  return (
    <div style={{ padding: 20 }}>
      <h1>Product Detail</h1>
      <p><strong>Num:</strong> {num}</p>
      <p><strong>Name:</strong> {name}</p>
      <p><strong>Brand:</strong> {brand}</p>
      <p><strong>Model:</strong> {model}</p>
      <p><strong>Year:</strong> {year}</p>
      <p><strong>Price:</strong> {price}</p>
      <p><strong>Stock:</strong> {stock}</p>

      {image ? (
        <div style={{ marginTop: 12 }}>
          {/* 尺寸简单自适应展示 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt={name} style={{ maxWidth: 360, height: 'auto', borderRadius: 8 }} />
        </div>
      ) : null}

      <p style={{ marginTop: 20 }}>
        <Link href="/stock">
          <button style={{ padding: '10px 20px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: 6 }}>
            ← 返回列表
          </button>
        </Link>
      </p>
    </div>
  );
}
