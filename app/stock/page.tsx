// 服务端渲染版本（不含 'use client'）：避免浏览器 CORS，恢复快速加载与快速跳转
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
const SIZE = 20;

function toInt(v: unknown, def: number) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : def;
}

async function fetchPage(page: number, size: number, timeoutMs = 6000): Promise<Item[]> {
  const url = `${API_BASE}?size=${size}&page=${page}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!resp.ok) return [];
    const data = await resp.json();
    if (Array.isArray(data)) return data as Item[];
    if (Array.isArray((data as any)?.content)) return (data as any).content as Item[];
    if (Array.isArray((data as any)?.data)) return (data as any).data as Item[];
    return [];
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

function primaryImage(item: Item): string {
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

function titleOf(it: Item) {
  return [it.brand, it.product, it.oe, it.num].filter(Boolean).join(' | ');
}

export default async function StockPage({
  searchParams,
}: {
  searchParams?: { [k: string]: string | string[] | undefined };
}) {
  const p = toInt((searchParams?.p as string) ?? '0', 0);

  // 服务端取数，避免浏览器 CORS；同时页面首屏直出更快
  const rows = await fetchPage(p, SIZE);

  // 预加载首屏若干图片，减少进入详情页的感知延迟
  const preloadImgs = rows.slice(0, 8).map(primaryImage);

  const hasNext = rows.length === SIZE;
  const prevHref = p > 0 ? `/stock?p=${p - 1}` : '#';
  const nextHref = hasNext ? `/stock?p=${p + 1}` : '#';

  return (
    <>
      {preloadImgs.map((src, i) => (
        <link key={`preload-${i}`} rel="preload" as="image" href={src} />
      ))}

      <main style={{ padding: '24px 0' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>库存预览</h1>

        {/* 分页（顶部） */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, fontSize: 14 }}>
          <Link
            href={prevHref}
            aria-disabled={p === 0}
            style={{
              pointerEvents: p === 0 ? 'none' : 'auto',
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: p === 0 ? '#f3f4f6' : '#fff',
              color: '#111827',
              textDecoration: 'none',
            }}
          >
            上一页
          </Link>
          <Link
            href={nextHref}
            aria-disabled={!hasNext}
            style={{
              pointerEvents: !hasNext ? 'none' : 'auto',
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: !hasNext ? '#f3f4f6' : '#fff',
              color: '#111827',
              textDecoration: 'none',
            }}
          >
            下一页
          </Link>
          <span style={{ color: '#6b7280' }}>当前第 {p + 1} 页</span>
        </div>

        {/* 列表 */}
        {rows.length === 0 ? (
          <div style={{ padding: 24 }}>暂无数据或加载失败</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
            {rows.map((it) => {
              const href = `/stock/${encodeURIComponent(String(it.num ?? ''))}?p=${p}&s=${SIZE}`;
              const img = primaryImage(it);
              const title = titleOf(it);
              return (
                <div
                  key={String(it.num)}
                  style={{
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 12,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <Link href={href} title="查看详情" prefetch>
                    <div
                      style={{
                        width: '100%',
                        aspectRatio: '1 / 1',
                        overflow: 'hidden',
                        borderRadius: 10,
                        background: '#fff',
                        border: '1px solid #f3f4f6',
                      }}
                    >
                      <img
                        src={img}
                        alt={String(it.product ?? 'product')}
                        loading="eager"
                        fetchPriority="high"
                        decoding="sync"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    </div>
                  </Link>

                  <Link
                    href={href}
                    title={title}
                    prefetch
                    style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.35, textDecoration: 'none', color: '#111827' }}
                  >
                    {title}
                  </Link>

                  <div style={{ fontSize: 12, color: '#4b5563', display: 'grid', gap: 4 }}>
                    {it.model && <div>车型：{it.model}</div>}
                    {it.year && <div>年份：{String(it.year)}</div>}
                    {it.oe && <div>OE：{it.oe}</div>}
                    {it.stock !== undefined && <div>库存：{String(it.stock)}</div>}
                    {it.price !== undefined && <div>价格：{String(it.price)}</div>}
                  </div>

                  <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
                    <Link
                      href={href}
                      prefetch
                      aria-label="查看详情"
                      title="查看详情"
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: '#fff',
                        color: '#111827',
                        border: '1px solid #e5e7eb',
                        textAlign: 'center',
                        textDecoration: 'none',
                      }}
                    >
                      查看详情
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 分页（底部） */}
        <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
          <Link
            href={prevHref}
            aria-disabled={p === 0}
            style={{
              pointerEvents: p === 0 ? 'none' : 'auto',
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: p === 0 ? '#f3f4f6' : '#fff',
              color: '#111827',
              textDecoration: 'none',
            }}
          >
            上一页
          </Link>
          <Link
            href={nextHref}
            aria-disabled={!hasNext}
            style={{
              pointerEvents: !hasNext ? 'none' : 'auto',
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: !hasNext ? '#f3f4f6' : '#fff',
              color: '#111827',
              textDecoration: 'none',
            }}
          >
            下一页
          </Link>
          <span style={{ alignSelf: 'center', color: '#6b7280' }}>第 {p + 1} 页</span>
        </div>
      </main>
    </>
  );
}
