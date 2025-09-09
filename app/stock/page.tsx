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

// http -> https
function toHttps(s: string): string {
  const t = (s || '').trim();
  if (!t) return t;
  if (t.startsWith('https://')) return t;
  if (t.startsWith('http://')) return 'https://' + t.slice(7);
  if (t.startsWith('//')) return 'https:' + t;
  return t;
}

function getThumb(it: AnyItem): string | null {
  // 优先 pics[0]
  if (Array.isArray(it?.pics) && it.pics.length > 0) {
    const first = it.pics[0];
    if (typeof first === 'string') return toHttps(first);
  }
  // 兜底一些常见字段
  const direct = pickFirst(
    it.image, it.img, it.picture, it.photo, it.thumbnail,
    it.imageUrl, it.imgUrl, it.picUrl, it.photoUrl
  );
  if (typeof direct === 'string') return toHttps(direct);
  return null;
}

export default function StockPage() {
  const [items, setItems] = useState<AnyItem[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/stock', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        // 兼容各种返回结构
        const list =
          Array.isArray(json) ? json
          : Array.isArray(json?.content) ? json.content
          : Array.isArray(json?.data) ? json.data
          : Array.isArray(json?.items) ? json.items
          : Array.isArray(json?.list) ? json.list
          : [];

        setItems(list);
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    })();
  }, []);

  const view = useMemo(() => {
    return items.map((it, idx) => {
      const num =
        pickFirst(it.num, it.code, it.sku, it.id, String(idx)) as string;
      const name =
        pickFirst(it.product, it.name, it.title, it.oe, '—') as string;
      const price =
        pickFirst(it.price, it.salePrice, it.retailPrice, 'N/A') as
          | string
          | number;
      const img = getThumb(it);
      return { num, name, price, img };
    });
  }, [items]);

  if (err) {
    return (
      <div style={{ padding: 20 }}>
        <h1>库存预览</h1>
        <p style={{ color: 'red' }}>加载失败：{err}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>库存预览</h1>
      <p style={{ color: '#666', marginBottom: 12 }}>共 {items.length} 条</p>

      {view.length === 0 ? (
        <p>暂无数据</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {view.map((v) => (
            <Link key={v.num} href={`/stock/${encodeURIComponent(v.num)}`} style={{ textDecoration: 'none' }}>
              <div
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  padding: 12,
                  background: '#fff',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '4/3',
                    background: '#f8fafc',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    marginBottom: 10,
                  }}
                >
                  {v.img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.img}
                      alt={v.name}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>无图</span>
                  )}
                </div>

                <div style={{ fontWeight: 600, marginBottom: 4 }}>{v.num}</div>
                <div
                  style={{
                    color: '#334155',
                    fontSize: 14,
                    minHeight: 40,
                    lineHeight: '20px',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                  }}
                  title={v.name}
                >
                  {v.name}
                </div>
                <div style={{ marginTop: 8, color: '#0f766e', fontWeight: 600 }}>
                  {typeof v.price === 'number' ? v.price : v.price}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
