'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Item = {
  num?: string;
  brand?: string;
  product?: string;
  oe?: string;
  model?: string;
  year?: string | number;
  price?: string | number;
  stock?: string | number;
  image?: string;
  images?: string[];
  pics?: string[];
  gallery?: string[];
  imageUrls?: string[];
  [k: string]: any;
};

const API_BASE = 'https://niuniuparts.com:6001/scm-product/v1/stock2';
const PAGE_SIZE = 20;

export default function StockPage() {
  const [page, setPage] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [hasNext, setHasNext] = useState<boolean>(false);
  const [addedHint, setAddedHint] = useState<string>('');

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const url = `${API_BASE}?size=${PAGE_SIZE}&page=${page}`;
        const resp = await fetch(url, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const rows: Item[] = Array.isArray(data)
          ? data
          : Array.isArray((data as any)?.content)
          ? (data as any).content
          : Array.isArray((data as any)?.data)
          ? (data as any).data
          : [];
        if (!alive) return;
        setItems(rows);
        setHasNext(rows.length === PAGE_SIZE);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || '加载失败');
        setItems([]);
        setHasNext(false);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [page]);

  function addToCart(item: Item) {
    try {
      const key = 'cart';
      const raw = localStorage.getItem(key);
      const cart: any[] = raw ? JSON.parse(raw) : [];
      const idx = cart.findIndex((x) => String(x?.num) === String(item.num));
      if (idx === -1) {
        cart.push({
          num: item.num ?? '',
          qty: 1,
          price: item.price ?? '',
          brand: item.brand ?? '',
          product: item.product ?? '',
          oe: item.oe ?? '',
          model: item.model ?? '',
          year: item.year ?? '',
        });
      } else {
        cart[idx].qty = (cart[idx].qty || 1) + 1;
      }
      localStorage.setItem(key, JSON.stringify(cart));
      setAddedHint(`[已加入] ${formatTitle(item)}`);
      setTimeout(() => setAddedHint(''), 1500);
    } catch {
      setAddedHint('加入购物车失败，请重试');
      setTimeout(() => setAddedHint(''), 1500);
    }
  }

  function prevPage() { setPage((p) => Math.max(0, p - 1)); }
  function nextPage() { if (hasNext) setPage((p) => p + 1); }

  return (
    <main style={{ padding: '24px 0' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>库存预览</h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, fontSize: 14 }}>
        <button onClick={prevPage} disabled={page === 0 || loading}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb',
            background: page === 0 || loading ? '#f3f4f6' : '#fff',
            cursor: page === 0 || loading ? 'not-allowed' : 'pointer' }}>
          上一页
        </button>
        <button onClick={nextPage} disabled={!hasNext || loading}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb',
            background: !hasNext || loading ? '#f3f4f6' : '#fff',
            cursor: !hasNext || loading ? 'not-allowed' : 'pointer' }}>
          下一页
        </button>
        <span style={{ color: '#6b7280' }}>当前第 {page + 1} 页</span>
        {addedHint && (
          <span style={{ marginLeft: 'auto', background: '#ecfeff', border: '1px solid #a5f3fc',
            padding: '4px 8px', borderRadius: 6, color: '#0e7490' }}>
            {addedHint}
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 24 }}>加载中...</div>
      ) : error ? (
        <div style={{ padding: 24, color: '#b91c1c' }}>出错：{error}</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 24 }}>暂无数据</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
          {items.map((it) => (
            <Card key={String(it.num)} item={it} onAdd={() => addToCart(it)} page={page} />
          ))}
        </div>
      )}

      <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
        <button onClick={prevPage} disabled={page === 0 || loading}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb',
            background: page === 0 || loading ? '#f3f4f6' : '#fff',
            cursor: page === 0 || loading ? 'not-allowed' : 'pointer' }}>
          上一页
        </button>
        <button onClick={nextPage} disabled={!hasNext || loading}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb',
            background: !hasNext || loading ? '#f3f4f6' : '#fff',
            cursor: !hasNext || loading ? 'not-allowed' : 'pointer' }}>
          下一页
        </button>
        <span style={{ alignSelf: 'center', color: '#6b7280' }}>第 {page + 1} 页</span>
      </div>
    </main>
  );
}

function formatTitle(item: Item) {
  return [item.brand, item.product, item.oe, item.num].filter(Boolean).join(' | ');
}

function getPrimaryImage(item: Item): string {
  const raw: string[] =
    item.images || item.pics || item.gallery || item.imageUrls || (item.image ? [item.image] : []) || [];
  const seen = new Set<string>();
  const cleaned = raw
    .filter(Boolean)
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s) => s.length > 0)
    .filter((u) => {
      const key = u.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const placeholder =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAQAAABx0wduAAAAAklEQVR42u3BMQEAAADCoPVPbQ0PoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8JwC0QABG4zJSwAAAABJRU5ErkJggg==';

  return cleaned[0] || placeholder;
}

function Card({ item, onAdd, page }: { item: Item; onAdd: () => void; page: number }) {
  const href = useMemo(() => {
    const num = encodeURIComponent(String(item.num ?? ''));
    return `/stock/${num}?p=${page}&s=${PAGE_SIZE}`;
  }, [item.num, page]);

  const primary = getPrimaryImage(item);
  const title = formatTitle(item);

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Link href={href} prefetch title="查看详情">
        <div style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', borderRadius: 10, background: '#fff', border: '1px solid #f3f4f6' }}>
          <img
            src={primary}
            alt={String(item.product ?? 'product')}
            loading="eager"
            fetchPriority="high"
            decoding="sync"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      </Link>

      <Link href={href} prefetch title={title} style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.35, textDecoration: 'none', color: '#111827' }}>
        {title}
      </Link>

      <div style={{ fontSize: 12, color: '#4b5563', display: 'grid', gap: 4 }}>
        {item.model && <div>车型：{item.model}</div>}
        {item.year && <div>年份：{String(item.year)}</div>}
        {item.oe && <div>OE：{item.oe}</div>}
        {item.stock !== undefined && <div>库存：{String(item.stock)}</div>}
        {item.price !== undefined && <div>价格：{String(item.price)}</div>}
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
        <button
          onClick={(e) => { e.preventDefault(); onAdd(); }}
          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer' }}
          aria-label="加入购物车"
          title="加入购物车"
        >
          加入购物车
        </button>
        <Link
          href={href}
          prefetch
          aria-label="查看详情"
          title="查看详情"
          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: '#fff', color: '#111827', border: '1px solid #e5e7eb', textAlign: 'center', textDecoration: 'none' }}
        >
          查看详情
        </Link>
      </div>
    </div>
  );
}
