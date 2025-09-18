'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

// —— 公共图片代理（不新增文件，直接用 wsrv.nl 压缩/跨域）
// 文档: https://images.weserv.nl/
function imgProxy(raw?: string, w: number = 640, q: number = 70) {
  if (!raw || typeof raw !== 'string') return '';
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    // wsrv.nl 要求不带协议（或用 ssl=1 指示 https）
    const hostAndPath = `${u.host}${u.pathname}${u.search || ''}`;
    const isHttps = u.protocol === 'https:';
    const base = 'https://wsrv.nl/?';
    // output=webp: 提升加载速度；加 q 和 w 控制质量与宽度
    return `${base}url=${encodeURIComponent(hostAndPath)}${isHttps ? '&ssl=1' : ''}&w=${w}&q=${q}&output=webp`;
  } catch {
    return raw; // 兜底直接返回原图（万一 URL 解析失败）
  }
}

// —— 从任意对象提取图片数组（字段名适配：img、image、pic、thumb、gallery 等）
function extractImages(rec: any): string[] {
  if (!rec || typeof rec !== 'object') return [];
  const keys = Object.keys(rec);
  const candidates = keys.filter((k) => /img|image|pic|thumb|gallery|photos/i.test(k));
  const out: string[] = [];
  for (const k of candidates) {
    const v = rec[k];
    if (!v) continue;
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

// —— 列表卡片图片组件（带回退“无图”）
function CardImg({ url, alt }: { url?: string; alt: string }) {
  const [err, setErr] = useState(false);
  if (!url || err) {
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
          fontSize: 18,
          borderRadius: 8,
          border: '1px dashed #e5e7eb',
        }}
      >
        无图
      </div>
    );
  }
  const src = imgProxy(url, 640, 68);
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setErr(true)}
      style={{
        width: '100%',
        aspectRatio: '4/3',
        objectFit: 'cover',
        borderRadius: 8,
        background: '#fafafa',
        display: 'block',
      }}
      loading="lazy"
    />
  );
}

type Row = Record<string, any>;

export default function StockListPage() {
  const [list, setList] = useState<Row[]>([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [total, setTotal] = useState(0);

  // 拉数
  useEffect(() => {
    let stop = false;
    (async () => {
      const url = `https://niuniuparts.com:6001/scm-product/v1/stock2?size=${size}&page=${page}`;
      const r = await fetch(url, { cache: 'no-store' });
      const j = await r.json();
      if (stop) return;

      const rows: Row[] = Array.isArray(j?.content) ? j.content : Array.isArray(j?.data) ? j.data : [];
      setList(rows);
      setTotal(Number(j?.totalElements ?? j?.total ?? rows.length));
    })();
    return () => {
      stop = true;
    };
  }, [page, size]);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / size)), [total, size]);

  return (
    <div style={{ maxWidth: 1260, margin: '32px auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 28, fontWeight: 700 }}>库存预览</div>
        <a
          href={`https://niuniuparts.com:6001/scm-product/v1/stock2/excel?size=${size}&page=${page}`}
          target="_blank"
          rel="noreferrer"
          style={{
            background: '#2563eb',
            color: '#fff',
            borderRadius: 8,
            padding: '10px 14px',
            textDecoration: 'none',
          }}
        >
          下载库存 Excel
        </a>
      </div>

      {/* 分页条 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page <= 0}
          style={{ padding: '6px 10px' }}
        >
          上一页
        </button>
        <div>第 {page + 1} / {pages} 页</div>
        <button
          onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
          disabled={page >= pages - 1}
          style={{ padding: '6px 10px' }}
        >
          下一页
        </button>

        <div style={{ marginLeft: 12 }}>每页</div>
        <select value={size} onChange={(e) => { setPage(0); setSize(Number(e.target.value)); }}>
          {[20, 30, 40, 50].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <div>条</div>
      </div>

      {/* 列表 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}
      >
        {list.map((it: Row) => {
          const imgs = extractImages(it);
          const img = imgs[0];
          const title =
            it?.title ||
            it?.product ||
            it?.name ||
            it?.desc ||
            `${it?.brand ?? ''} ${it?.model ?? ''}`.trim() ||
            '产品';

          const num = it?.num ?? it?.Num ?? it?.id ?? it?.ID ?? '';
          const oe =
            it?.oe || it?.OE || it?.oeNo || it?.oe_code || it?.oeCode || it?.OECode || it?.OE_NO || '';
          const brand = it?.brand || it?.Brand || '';
          const price = Number(it?.price ?? it?.Price ?? 0);

          return (
            <div key={`${num}-${oe}-${brand}-${img ?? 'x'}`} style={{ border: '1px solid #eee', borderRadius: 10, padding: 12 }}>
              <CardImg url={img} alt={title} />
              <div style={{ marginTop: 10, fontWeight: 600 }}>{title}</div>
              <div style={{ color: '#4b5563', marginTop: 4 }}>Brand: {brand || '-'}</div>
              <div style={{ color: '#4b5563' }}>OE: {oe || '-'}</div>
              <div style={{ color: '#4b5563' }}>Num: {String(num || '-')}</div>
              <div style={{ marginTop: 6, color: '#065f46', fontWeight: 700 }}>
                ￥ {price.toFixed(2)}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <Link
                  href={{
                    pathname: `/stock/${encodeURIComponent(num)}`,
                    query: {
                      product: title,
                      brand,
                      oe,
                      price,
                      image: img ?? '',
                    },
                  }}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: '8px 0',
                    textDecoration: 'none',
                    color: '#111827',
                    background: '#fff',
                  }}
                >
                  查看详情
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* 无数据 */}
      {list.length === 0 && (
        <div style={{ color: '#6b7280', marginTop: 32 }}>暂无数据</div>
      )}
    </div>
  );
}
