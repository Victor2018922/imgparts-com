'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type AnyObj = Record<string, any>;

const API = 'https://niuniuparts.com:6001/scm-product/v1/stock2';

/* ---------- 工具：安全取值 & 解析图片 ---------- */
function firstNonEmpty(obj: AnyObj | null | undefined, keys: string[], fallback: any = '') {
  if (!obj) return fallback;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return fallback;
}

// 从字符串中尽量提取 URL
function extractUrlsFromText(text: string): string[] {
  if (!text) return [];
  const ret = new Set<string>();
  const reExt = /(https?:\/\/[^\s"'<>]+?\.(?:jpg|jpeg|png|gif|webp))(?:[?#][^\s"'<>]*)?/gi;
  const reImg = /<img\b[^>]*src=['"]?([^'">\s]+)['"]?/gi;
  let m: RegExpExecArray | null;
  while ((m = reExt.exec(text))) ret.add(m[1]);
  while ((m = reImg.exec(text))) ret.add(m[1]);
  return Array.from(ret);
}

// 归一化一条数据
function normalizeItem(x: AnyObj) {
  const num = String(
    firstNonEmpty(x, ['num', 'Num', '编号', '编码', '货号', 'id', 'sku'], '')
  ).trim();

  const title =
    String(firstNonEmpty(x, ['title', 'product', 'name', '标题', '品名'], '-')).trim() || '-';

  const brand = String(firstNonEmpty(x, ['brand', '品牌'], '-')) || '-';
  const model = String(firstNonEmpty(x, ['model', '车型'], '-')) || '-';
  const oe = String(firstNonEmpty(x, ['oe', 'OE', '配件号', '编号'], '')) || '';
  const price = firstNonEmpty(x, ['price', '价格', '单价', '售价'], '');
  const stock = firstNonEmpty(x, ['stock', '库存', '库存数量', 'qty', '数量'], '');

  // 图片：优先数组字段，其次单图字符串，再尝试从描述文本里捞
  let images: string[] = [];
  const imgArray = firstNonEmpty(x, ['images', 'imageList', 'pics', 'pictures', 'photos'], null);
  if (Array.isArray(imgArray)) {
    images = imgArray.filter(Boolean);
  } else {
    const single = firstNonEmpty(
      x,
      ['image', 'img', 'imageurl', 'image_url', 'thumb', 'thumbnail', '主图'],
      ''
    );
    if (single) {
      const parts = String(single).split(/[|,]/).map((s) => s.trim()).filter(Boolean);
      images = parts.length ? parts : extractUrlsFromText(String(single));
    }
    if (!images.length) {
      const desc = firstNonEmpty(x, ['desc', 'description', '详情', '内容', 'remark'], '');
      images = extractUrlsFromText(String(desc));
    }
  }

  return { num, title, brand, model, oe, price, stock, images };
}

/* ---------- 组件 ---------- */
export default function StockListPage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let stop = false;
    (async () => {
      setLoading(true);
      try {
        const url = `${API}?size=${pageSize}&page=${page}`;
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json().catch(() => ({} as AnyObj));

        // 兼容多种返回结构
        const rows: any[] =
          data?.data?.list ??
          data?.data?.records ??
          data?.list ??
          data?.records ??
          data?.content ??
          data?.data ??
          [];

        const normalized = rows.map(normalizeItem).filter((x: any) => x.num);

        if (!stop) {
          setList(normalized);
          // 尝试多种 total 字段
          const t =
            data?.data?.total ??
            data?.total ??
            data?.totalElements ??
            (Array.isArray(rows) ? rows.length : 0);
          setTotal(Number(t) || normalized.length);

          // 写入本地缓存（供详情页上一条/下一条与直达兜底）
          try {
            localStorage.setItem('stock:lastPage', JSON.stringify({
              page, pageSize, total: Number(t) || normalized.length, list: normalized
            }));
            localStorage.setItem('stock:list', JSON.stringify(normalized));
          } catch {}
        }
      } catch (e) {
        console.error('load stock list failed', e);
        if (!stop) {
          setList([]);
          setTotal(0);
        }
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => { stop = true; };
  }, [page, pageSize]);

  const totalPages = useMemo(() => {
    return total > 0 ? Math.ceil(total / pageSize) : 1;
  }, [total, pageSize]);

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">库存预览</h1>

      <div className="mb-4 flex items-center gap-3">
        <button
          className="px-3 py-1 rounded border disabled:opacity-50"
          disabled={page <= 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          上一页
        </button>
        <span>第 {page + 1} / {Math.max(1, totalPages)} 页</span>
        <button
          className="px-3 py-1 rounded border disabled:opacity-50"
          disabled={page >= totalPages - 1}
          onClick={() => setPage((p) => p + 1)}
        >
          下一页
        </button>

        <span className="ml-4">每页</span>
        <select
          className="border rounded px-2 py-1"
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
        >
          {[20, 30, 50].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span>条</span>
      </div>

      {loading && <p className="text-gray-500">加载中…</p>}

      {!loading && list.length === 0 && (
        <p className="text-gray-500">暂无数据</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {list.map((item, idx) => {
          const firstImg = item.images?.[0] ?? '';
          const href =
            `/stock/${encodeURIComponent(item.num ?? '')}`
            + `?title=${encodeURIComponent(item.title ?? '-')}`
            + `&oe=${encodeURIComponent(item.oe ?? '-')}`
            + `&brand=${encodeURIComponent(item.brand ?? '-')}`
            + `&model=${encodeURIComponent(item.model ?? '-')}`
            + `&year=${encodeURIComponent('-')}`
            + `&price=${encodeURIComponent(String(item.price ?? ''))}`
            + `&stock=${encodeURIComponent(String(item.stock ?? ''))}`
            + `&images=${encodeURIComponent((item.images ?? []).join('|'))}`
            + `&idx=${idx}`;

          return (
            <Link
              key={item.num + '_' + idx}
              href={href}
              className="block border rounded-lg p-4 hover:shadow-md transition bg-white"
            >
              <div className="aspect-[4/3] bg-gray-100 mb-3 flex items-center justify-center overflow-hidden">
                {firstImg ? (
                  <img
                    src={firstImg}
                    alt={item.title ?? ''}
                    className="object-contain w-full h-full"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="text-gray-400">无图</span>
                )}
              </div>
              <div className="space-y-1 text-sm">
                <div className="line-clamp-2 font-medium" title={item.title}>{item.title ?? '-'}</div>
                <div>Num：{item.num ?? '-'}</div>
                {item.oe ? <div>OE：{item.oe}</div> : null}
                <div>Brand：{item.brand ?? '-'}</div>
                <div>Model：{item.model ?? '-'}</div>
                <div>Price：{item.price ?? '-'}</div>
                <div>Stock：{item.stock ?? '-'}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}

