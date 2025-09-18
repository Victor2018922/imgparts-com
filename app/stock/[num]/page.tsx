'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// —— 公共图片代理，不新增文件
function imgProxy(raw?: string, w: number = 1280, q: number = 72) {
  if (!raw || typeof raw !== 'string') return '';
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    const hostAndPath = `${u.host}${u.pathname}${u.search || ''}`;
    const isHttps = u.protocol === 'https:';
    const base = 'https://wsrv.nl/?';
    return `${base}url=${encodeURIComponent(hostAndPath)}${isHttps ? '&ssl=1' : ''}&w=${w}&q=${q}&output=webp`;
  } catch {
    return raw;
  }
}

// —— 提取图片数组
function extractImages(rec: any): string[] {
  if (!rec || typeof rec !== 'object') return [];
  const keys = Object.keys(rec);
  const candidates = keys.filter((k) => /img|image|pic|thumb|gallery|photos/i.test(k));
  const out: string[] = [];
  for (const k of candidates) {
    const v = rec[k];
    if (Array.isArray(v)) {
      v.forEach((x) => typeof x === 'string' && x.trim() && out.push(x.trim()));
    } else if (typeof v === 'string') {
      v
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => out.push(s));
    }
  }
  return [...new Set(out)];
}

// —— 组件：大图/缩略图（12 张）
function BigImg({ url, onError }: { url?: string; onError?: () => void }) {
  if (!url) {
    return (
      <div
        style={{
          width: '100%',
          aspectRatio: '4/3',
          background: '#f3f4f6',
          color: '#9ca3af',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          borderRadius: 10,
          border: '1px dashed #e5e7eb',
        }}
      >
        无图
      </div>
    );
  }
  const src = imgProxy(url, 1280, 72);
  return (
    <img
      src={src}
      alt="product"
      onError={onError}
      style={{
        width: '100%',
        aspectRatio: '4/3',
        objectFit: 'contain',
        background: '#fff',
        borderRadius: 10,
        border: '1px solid #eee',
      }}
    />
  );
}

function Thumb({ url, active, onClick }: { url?: string; active?: boolean; onClick?: () => void }) {
  const src = url ? imgProxy(url, 220, 68) : '';
  return (
    <button
      onClick={onClick}
      style={{
        width: 92,
        height: 68,
        borderRadius: 8,
        border: active ? '2px solid #2563eb' : '1px solid #e5e7eb',
        overflow: 'hidden',
        background: '#fff',
        padding: 0,
        cursor: url ? 'pointer' : 'default',
      }}
      disabled={!url}
      title="查看大图"
    >
      {url ? (
        <img
          src={src}
          alt="thumb"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          loading="lazy"
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            color: '#9ca3af',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            background: '#f8fafc',
          }}
        >
          无图
        </div>
      )}
    </button>
  );
}

type Row = Record<string, any>;

export default function StockDetailPage() {
  const params = useParams<{ num: string }>();
  const router = useRouter();
  const search = useSearchParams();

  const [meta, setMeta] = useState<Row | null>(null);
  const [imgs, setImgs] = useState<string[]>([]);
  const [cur, setCur] = useState(0);

  // 兜底：URL 自带字段
  const fallbackObj = useMemo<Row>(() => {
    const obj: Row = {
      num: params?.num ?? '',
      title: search?.get('product') || '',
      brand: search?.get('brand') || '',
      oe: search?.get('oe') || '',
      price: Number(search?.get('price') || '0'),
      image: search?.get('image') || '',
    };
    return obj;
  }, [params, search]);

  // 拉详情（用列表接口筛选，避免新增接口/文件）
  useEffect(() => {
    let stop = false;
    (async () => {
      const num = params?.num;
      if (!num) return;
      const url = `https://niuniuparts.com:6001/scm-product/v1/stock2?size=500&page=0`;
      const r = await fetch(url, { cache: 'no-store' });
      const j = await r.json();
      if (stop) return;

      const rows: Row[] = Array.isArray(j?.content) ? j.content : Array.isArray(j?.data) ? j.data : [];
      const found = rows.find((x) => String(x?.num ?? '').toLowerCase() === String(num).toLowerCase()) || null;

      const detail = found ?? fallbackObj;
      setMeta(detail);

      const ex = extractImages(detail);
      const fallback = fallbackObj?.image ? [fallbackObj.image] : [];
      setImgs(ex.length ? ex.slice(0, 12) : fallback); // 最多 12 张
      setCur(0);
    })();

    return () => {
      stop = true;
    };
  }, [params, fallbackObj]);

  const title =
    meta?.title ||
    meta?.product ||
    meta?.name ||
    `${meta?.brand ?? ''} ${meta?.model ?? ''}`.trim() ||
    '产品详情';

  return (
    <div style={{ maxWidth: 1260, margin: '32px auto', padding: '0 16px' }}>
      <Link
        href="/stock"
        style={{ display: 'inline-block', marginBottom: 16, textDecoration: 'none', color: '#111827', border: '1px solid #e5e7eb', padding: '8px 12px', borderRadius: 8 }}
      >
        ← 返回列表
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 24 }}>
        <div>
          <BigImg url={imgs[cur]} onError={() => setCur(0)} />

          {/* 缩略图（最多 12 张，可横向滚动） */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', paddingBottom: 6 }}>
            {Array.from({ length: Math.max(1, Math.min(12, imgs.length || 1)) }).map((_, i) => (
              <Thumb
                key={i}
                url={imgs[i]}
                active={i === cur}
                onClick={() => setCur(i)}
              />
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 10 }}>{title}</div>
          <div style={{ color: '#4b5563', lineHeight: '1.9' }}>
            <div><b>Num:</b> {String(meta?.num ?? '-')}</div>
            <div><b>OE:</b> {meta?.oe || '-'}</div>
            <div><b>Brand:</b> {meta?.brand || '-'}</div>
            <div><b>Model:</b> {meta?.model || '-'}</div>
            <div><b>Year:</b> {meta?.year || '-'}</div>
            <div><b>Price:</b> ￥{Number(meta?.price ?? 0).toFixed(2)}</div>
            <div><b>Stock:</b> {meta?.stock ?? '-'}</div>
          </div>

          {/* 上一条 / 下一条（基于 num 的简单跳转） */}
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button
              onClick={() => {
                const n = Number(meta?.num) || 0;
                if (n > 0) router.push(`/stock/${encodeURIComponent(String(n - 1))}`);
              }}
              style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff' }}
            >
              上一条
            </button>
            <button
              onClick={() => {
                const n = Number(meta?.num) || 0;
                router.push(`/stock/${encodeURIComponent(String(n + 1))}`);
              }}
              style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff' }}
            >
              下一条
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

