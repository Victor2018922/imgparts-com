'use client';

import { useState, useMemo } from 'react';

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

async function fetchItem(num: string): Promise<Item | null> {
  try {
    const resp = await fetch(
      'https://niuniuparts.com:6001/scm-product/v1/stock2?size=200&page=0',
      { cache: 'no-store' }
    );
    if (resp.ok) {
      const data = await resp.json();
      const rows: Item[] = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.content)
        ? (data as any).content
        : [];
      const found = rows.find((x) => String(x?.num ?? '') === String(num));
      if (found) return found;
    }
  } catch {
    // 忽略错误
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: { num: string };
}) {
  const item = await fetchItem(params.num);
  const titleParts = [item?.brand, item?.product, item?.oe, params.num].filter(
    Boolean
  );
  return {
    title: titleParts.join(' | ') || `Item ${params.num}`,
  };
}

export default function StockDetailPage({
  params,
}: {
  params: { num: string };
}) {
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);

  const num = params.num;

  useMemo(() => {
    fetchItem(num).then((res) => {
      setItem(res);
      setLoading(false);
    });
  }, [num]);

  if (loading) {
    return <div style={{ padding: 32 }}>加载中...</div>;
  }

  if (!item) {
    return (
      <div style={{ padding: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>未找到商品：{num}</h1>
        <a
          href="/stock"
          style={{
            display: 'inline-block',
            marginTop: 16,
            padding: '8px 16px',
            background: '#111827',
            color: '#fff',
            borderRadius: 8,
            textDecoration: 'none',
          }}
        >
          返回列表
        </a>
      </div>
    );
  }

  // 处理图片：不足18张补齐，无图则用透明占位
  const placeholder =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAQAAABx0wduAAAAAklEQVR42u3BMQEAAADCoPVPbQ0PoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8JwC0QABG4zJSwAAAABJRU5ErkJggg==';

  const rawImgs: string[] =
    item.images ||
    item.pics ||
    item.gallery ||
    item.imageUrls ||
    (item.image ? [item.image] : []) ||
    [];

  const cleaned = useMemo(() => {
    const seen = new Set<string>();
    return rawImgs
      .filter(Boolean)
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter((s) => s.length > 0)
      .filter((u) => {
        const key = u.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [rawImgs]);

  const filled: string[] = useMemo(() => {
    const MIN = 18;
    let base = cleaned.length > 0 ? cleaned : [placeholder];
    const out: string[] = [];
    while (out.length < Math.max(MIN, base.length)) {
      out.push(base[out.length % base.length]);
    }
    return out;
  }, [cleaned]);

  const [active, setActive] = useState(0);
  const current = filled[active] ?? filled[0];

  const titleParts = [item.brand, item.product, item.oe, num].filter(Boolean);
  const safeTitle = titleParts.join(' | ');

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 24,
        padding: '24px 0',
      }}
    >
      <div>
        {/* 主图 */}
        <div
          style={{
            width: '100%',
            aspectRatio: '1 / 1',
            overflow: 'hidden',
            borderRadius: 16,
            background: '#fff',
            border: '1px solid #eee',
          }}
        >
          <img
            src={current}
            alt="product"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>

        {/* 缩略图 */}
        <div
          style={{
            marginTop: 12,
            display: 'grid',
            gridTemplateColumns: 'repeat(9, 1fr)',
            gap: 8,
          }}
        >
          {filled.map((src, i) => (
            <button
              key={`${src}-${i}`}
              onClick={() => setActive(i)}
              aria-label={`thumbnail ${i + 1}`}
              style={{
                aspectRatio: '1 / 1',
                overflow: 'hidden',
                borderRadius: 8,
                border:
                  i === active ? '2px solid #2563eb' : '1px solid #e5e7eb',
                background: '#fff',
                padding: 0,
                cursor: 'pointer',
              }}
            >
              <img
                src={src}
                alt={`thumb-${i + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>{safeTitle}</h1>

        <dl
          style={{
            marginTop: 16,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            fontSize: 14,
          }}
        >
          {item.brand && (
            <div>
              <dt style={{ color: '#6b7280' }}>品牌</dt>
              <dd style={{ fontWeight: 600 }}>{item.brand}</dd>
            </div>
          )}
          {item.product && (
            <div>
              <dt style={{ color: '#6b7280' }}>品名</dt>
              <dd style={{ fontWeight: 600 }}>{item.product}</dd>
            </div>
          )}
          {item.oe && (
            <div>
              <dt style={{ color: '#6b7280' }}>OE</dt>
              <dd style={{ fontWeight: 600 }}>{item.oe}</dd>
            </div>
          )}
          {item.model && (
            <div>
              <dt style={{ color: '#6b7280' }}>车型</dt>
              <dd style={{ fontWeight: 600 }}>{item.model}</dd>
            </div>
          )}
          {item.year && (
            <div>
              <dt style={{ color: '#6b7280' }}>年份</dt>
              <dd style={{ fontWeight: 600 }}>{item.year}</dd>
            </div>
          )}
          {item.price !== undefined && (
            <div>
              <dt style={{ color: '#6b7280' }}>价格</dt>
              <dd style={{ fontWeight: 600 }}>{String(item.price)}</dd>
            </div>
          )}
          {item.stock !== undefined && (
            <div>
              <dt style={{ color: '#6b7280' }}>库存</dt>
              <dd style={{ fontWeight: 600 }}>{String(item.stock)}</dd>
            </div>
          )}
        </dl>

        <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
          <button
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            加入购物车
          </button>
          <button
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              background: '#fff',
              color: '#111827',
              border: '1px solid #e5e7eb',
              cursor: 'pointer',
            }}
          >
            立即购买
          </button>
        </div>
      </div>
    </div>
  );
}
