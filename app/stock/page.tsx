'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type AnyObj = Record<string, any>;

function absolutize(url: string): string {
  if (!url) return url;
  let u = url.trim();
  if (u.startsWith('//')) return 'http:' + u;
  if (u.startsWith('/')) return 'http://niuniuparts.com' + u;
  return u;
}

/** 统一通过 HTTPS 图片代理（压缩）避免混合内容与大图尺寸 */
function toProxy(raw?: string | null, w = 320, h = 220): string | null {
  if (!raw) return null;
  let u = absolutize(raw);
  if (/^data:image\//i.test(u)) return u;
  u = u.replace(/^https?:\/\//i, '');
  return `https://images.weserv.nl/?url=${encodeURIComponent(u)}&w=${w}&h=${h}&fit=contain&we=auto&q=75&il`;
}

/** 从任意字符串中尽可能提取 URL */
function extractUrlsFromText(text: string): string[] {
  const urls = new Set<string>();
  if (!text) return [];
  const reExt = /(https?:\/\/[^\s"'<>]+?\.(?:jpg|jpeg|png|gif|webp))(?:[?#][^\s"'<>]*)?/gi;
  const reImg = /<img\b[^>]*src=['"]?([^'">\s]+)['"]?/gi;
  const reRel = /(\/(?:upload|uploads|images|img|files)\/[^\s"'<>]+?\.(?:jpg|jpeg|png|gif|webp))(?:[?#][^\s"'<>]*)?/gi;
  const reAny = /(https?:\/\/[^\s"'<>]+)/gi;
  let m: RegExpExecArray | null;

  while ((m = reExt.exec(text))) urls.add(m[1]);
  while ((m = reImg.exec(text))) urls.add(m[1]);
  while ((m = reRel.exec(text))) urls.add('http://niuniuparts.com' + m[1]);
  while ((m = reAny.exec(text))) urls.add(m[1]);
  return Array.from(urls);
}

/** 简单取值（兼容中英文 key） */
function pick(obj: AnyObj | null | undefined, keys: string[], fallback: any = '-') {
  if (!obj) return fallback;
  const alias: Record<string, string[]> = {
    title: ['标题', '名称', '品名', 'title', 'product', 'name'],
    brand: ['品牌', 'brand'],
    model: ['车型', 'model'],
    year: ['年份', '年款', 'year'],
    oe: ['OE', 'oe', '配件号', '编号'],
    num: ['num', '编码', '编号', '货号'],
    price: ['价格', '单价', '售价', 'price'],
    stock: ['库存', '库存数量', '数量', '在库', 'stock'],
    image: ['image','img','图片','image_url','imageUrl','thumb','thumbnail','主图'],
  };
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    const group = alias[k];
    if (group) {
      for (const a of group) {
        if (obj[a] !== undefined && obj[a] !== null && obj[a] !== '') return obj[a];
      }
    }
  }
  return fallback;
}

/** 给单条数据生成若干可能的图片地址（轻量版） */
function buildCandidatesForItem(item: AnyObj): string[] {
  const set = new Set<string>();

  // 1) 常见字段
  const direct = pick(item, ['image'], null);
  if (typeof direct === 'string') set.add(direct);
  if (Array.isArray(direct)) direct.forEach((x: any) => typeof x === 'string' && set.add(x));

  // 2) 任意字段里可能的 URL
  extractUrlsFromText(JSON.stringify(item)).forEach((u) => set.add(u));

  // 3) 根据 num / oe 猜测路径
  const num = String(pick(item, ['num'], '') || '');
  const oe  = String(pick(item, ['oe'], '') || '');
  const bases = ['/upload/', '/uploads/', '/images/', '/img/', '/files/'];
  const exts  = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  [num, oe].forEach((seed) => {
    if (!seed) return;
    for (const b of bases) for (const e of exts) set.add(`http://niuniuparts.com${b}${seed}${e}`);
  });

  return Array.from(set);
}

export default function StockListPage() {
  const [list, setList] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`https://niuniuparts.com:6001/scm-product/v1/stock2?size=${size}&page=${page}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        const rows: any[] =
          data?.data?.list ??
          data?.data?.records ??
          data?.list ??
          data?.records ??
          data?.data ??
          [];
        setList(rows);
      } finally {
        setLoading(false);
      }
    })();
  }, [page, size]);

  const filtered = useMemo(() => {
    if (!q.trim()) return list;
    const key = q.trim().toLowerCase();
    return list.filter((it) => JSON.stringify(it).toLowerCase().includes(key));
  }, [list, q]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">库存产品列表</h1>
        <a
          href="https://niuniuparts.com:6001/scm-product/v1/stock2/excel?size=20&page=0"
          target="_blank"
          rel="noreferrer"
          className="rounded bg-blue-600 hover:bg-blue-700 text-white px-4 py-2"
        >
          下载库存 Excel
        </a>
      </header>

      <div className="mb-4 flex items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索 编号 / 标题 / OE / 品牌（仅当前页）"
          className="w-full md:w-[420px] rounded border px-3 py-2"
        />
        <div className="text-gray-500">共 {filtered.length} 条（当前页）</div>
      </div>

      {loading ? (
        <div className="text-gray-500">加载中…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((it, idx) => {
            const num   = String(pick(it, ['num'], ''));
            const title = String(pick(it, ['title'], '-'));
            const brand = String(pick(it, ['brand'], '-'));
            const model = String(pick(it, ['model'], '-'));
            const oe    = String(pick(it, ['oe'], '-'));
            const price = String(pick(it, ['price'], '-'));
            const stock = String(pick(it, ['stock'], '-'));

            // 构造候选图并先取第一个代理地址（如果失败，img 会隐藏）
            const cand = buildCandidatesForItem(it);
            const img  = cand.length ? toProxy(cand[0]) : null;

            const href = `/stock/${encodeURIComponent(num)}?title=${encodeURIComponent(title)}&oe=${encodeURIComponent(
              oe
            )}&brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}&price=${encodeURIComponent(
              price
            )}&stock=${encodeURIComponent(stock)}`;

            return (
              <div key={idx} className="rounded border p-4">
                <div className="text-lg font-semibold mb-2 line-clamp-2">{title}</div>
                <div className="text-sm mb-2 space-y-1 leading-6">
                  <div><span className="font-semibold">品牌：</span>{brand}</div>
                  <div><span className="font-semibold">车型：</span>{model}</div>
                  <div><span className="font-semibold">OE号：</span>{oe}</div>
                  <div><span className="font-semibold">编号：</span>{num}</div>
                  <div><span className="font-semibold">价格：</span>{price}</div>
                  <div><span className="font-semibold">库存：</span>{stock}</div>
                </div>

                <div
                  className="mb-3 flex items-center justify-center"
                  style={{ width: '100%', height: 220, background: '#fafafa', border: '1px solid #eee', borderRadius: 8 }}
                >
                  {img ? (
                    <img
                      src={img}
                      alt={num}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      style={{ width: '100%', height: 220, objectFit: 'contain' }}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                        const holder = document.createElement('div');
                        holder.innerText = '无图';
                        holder.style.cssText =
                          'width:100%;height:220px;display:flex;align-items:center;justify-content:center;color:#999;';
                        e.currentTarget.parentElement?.appendChild(holder);
                      }}
                    />
                  ) : (
                    <div className="text-gray-400">无图</div>
                  )}
                </div>

                <Link
                  href={href}
                  className="inline-flex items-center justify-center rounded bg-gray-900 text-white px-3 py-2 hover:bg-black"
                >
                  查看详情
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

