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

export default function ItemPage({ params }: { params: { num: string } }) {
  const { num } = params;
  const [item, setItem] = useState<AnyItem | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/stock/item?num=${encodeURIComponent(num)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setItem(data);
        setActiveIdx(0);
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    })();
  }, [num]);

  const view = useMemo(() => {
    if (!item) return null;

    const name  = pickFirst(item.product, item.name, item.title, item.oe, '—');
    const brand = pickFirst(item.brand, item.make, '—');
    const model = pickFirst(item.model, item.vehicle, '—');
    const year  = pickFirst(item.year, item.years, '—');
    const price = pickFirst(item.price, item.salePrice, item.retailPrice, 'N/A');
    const stock = pickFirst(item.stock, item.qty, item.quantity, 'N/A');

    // 图片相册：优先 pics 数组；无则尝试几个常见字段拼一个数组
    let pics: string[] = [];
    if (Array.isArray(item.pics)) {
      pics = item.pics.filter(Boolean).map((u: any) => toHttps(String(u)));
    }
    const fallbackOne = pickFirst(
      item.image, item.img, item.picture, item.photo,
      item.imageUrl, item.imgUrl, item.picUrl, item.photoUrl
    );
    if (pics.length === 0 && typeof fallbackOne === 'string') {
      pics = [toHttps(fallbackOne)];
    }

    return { name, brand, model, year, price, stock, pics };
  }, [item]);

  if (err) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Product Detail</h1>
        <p style={{ color: 'red' }}>加载失败：{err}</p>
        <p style={{ marginTop: 16 }}><Link href="/stock">← 返回列表</Link></p>
        <div style={{ marginTop: 28, fontSize: 12, color: '#666' }}>数据源：niuniuparts.com（测试预览用途）</div>
      </div>
    );
  }

  if (!item || !view) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Product Detail</h1>
        <p>加载中…</p>
        <p style={{ marginTop: 16 }}><Link href="/stock">← 返回列表</Link></p>
        <div style={{ marginTop: 28, fontSize: 12, color: '#666' }}>数据源：niuniuparts.com（测试预览用途）</div>
      </div>
    );
  }

  const mainImg = view.pics[activeIdx];

  return (
    <div style={{ padding: 20 }}>
      <h1>Product Detail</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 480px) 1fr', gap: 24, alignItems: 'start' }}>
        {/* 左侧：图片相册 */}
        <div>
          <div
            style={{
              width: '100%',
              aspectRatio: '4/3',
              background: '#f8fafc',
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              marginBottom: 12,
            }}
          >
            {mainImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mainImg}
                alt={String(view.name)}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <span style={{ color: '#94a3b8' }}>（暂无图片）</span>
            )}
          </div>

          {/* 缩略图列表 */}
          {view.pics.length > 1 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {view.pics.map((u, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  style={{
                    border: i === activeIdx ? '2px solid #0ea5e9' : '1px solid #e5e7eb',
                    borderRadius: 8,
                    background: '#fff',
                    padding: 0,
                    width: 90,
                    height: 68,
                    cursor: 'pointer',
                    flex: '0 0 auto',
                    overflow: 'hidden',
                  }}
                  title={`图片 ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt={`thumb-${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 右侧：信息 */}
        <div>
          <p><strong>Num:</strong> {num}</p>
          <p><strong>Name:</strong> {view.name}</p>
          <p><strong>Brand:</strong> {view.brand}</p>
          <p><strong>Model:</strong> {view.model}</p>
          <p><strong>Year:</strong> {view.year}</p>
          <p><strong>Price:</strong> {view.price}</p>
          <p><strong>Stock:</strong> {view.stock}</p>

          <p style={{ marginTop: 16 }}>
            <Link href="/stock">
              <button style={{ padding: '10px 20px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: 6 }}>
                ← 返回列表
              </button>
            </Link>
          </p>
        </div>
      </div>

      {/* 原始数据（折叠，默认收起，截图更干净） */}
      <details style={{ marginTop: 24 }}>
        <summary style={{ cursor: 'pointer' }}>查看原始数据（调试用）</summary>
        <pre
          style={{
            marginTop: 8,
            padding: 12,
            background: '#0b1020',
            color: '#d6e1ff',
            borderRadius: 8,
            overflowX: 'auto',
            maxWidth: '100%',
            fontSize: 12,
          }}
        >{JSON.stringify(item, null, 2)}</pre>
      </details>

      {/* 只保留一个数据源 footer，去重 */}
      <div style={{ marginTop: 28, fontSize: 12, color: '#666' }}>
        数据源：niuniuparts.com（测试预览用途）
      </div>
    </div>
  );
}
