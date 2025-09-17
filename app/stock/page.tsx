
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type RawItem = {
  num?: string;
  title?: string; // 标题/品名
  model?: string; // 车型
  brand?: string; // 品牌
  oe?: string;    // OE号
  price?: number | string;
  stock?: number | string;
  images?: string[]; // 图片数组（可能没有）
};

type PageResp = {
  content?: RawItem[];
  totalElements?: number;
};

const API = 'https://niuniuparts.com:6001/scm-product/v1/stock2';

function safeNum(x: unknown) { return (x ?? '').toString(); }
function safeStr(x: unknown, d = '-') {
  const s = (x ?? '').toString().trim();
  return s ? s : d;
}

export default function StockListPage() {
  const [list, setList] = useState<RawItem[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let stop = false;
    async function load() {
      setLoading(true);
      try {
        const url = `${API}?size=${pageSize}&page=${page}`;
        const res = await fetch(url, { cache: 'no-store' });
        const data: PageResp = await res.json();

        const content = (data?.content ?? []).map((x) => ({
          num: safeNum(x.num),
          title: safeStr((x as any).title || (x as any).product || (x as any).name),
          model: safeStr((x as any).model),
          brand: safeStr((x as any).brand),
          oe: safeStr((x as any).oe),
          price: (x as any).price ?? '',
          stock: (x as any).stock ?? '',
          images: Array.isArray((x as any).images) ? (x as any).images : [],
        })) as RawItem[];

        if (!stop) {
          setList(content);
          setTotal(data?.totalElements ?? 0);

          // 缓存列表用于详情页“上一条/下一条”与直达兜底
          localStorage.setItem('stock:lastPage', JSON.stringify({
            page, pageSize, total: data?.totalElements ?? 0, list: content,
          }));
        }
      } catch (e) {
        console.error('load stock list failed', e);
      } finally {
        if (!stop) setLoading(false);
      }
    }
    load();
    return () => { stop = true; };
  }, [page, pageSize]);

  const totalPages = useMemo(() => {
    return total > 0 ? Math.ceil(total / pageSize) : 0;
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
          disabled={totalPages === 0 || page >= totalPages - 1}
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

          // 将必要字段塞进 URL，确保详情页可兜底渲染
          const href = `/stock/${encodeURIComponent(item.num ?? '')}`
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
            className="block border rounded-lg p-4 hover:shadow-md transition"
          >
            <div className="aspect-[4/3] bg-gray-100 mb-3 flex items-center justify-center overflow-hidden">
              {firstImg ? (
                <img
                  src={firstImg}
                  alt={item.title ?? ''}
                  className="object-contain w-full h-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-gray-400">无图</span>
              )}
            </div>
            <div className="space-y-1 text-sm">
              <div className="line-clamp-2 font-medium">{item.title ?? '-'}</div>
              <div>Num：{item.num ?? '-'}</div>
              <div>OE：{item.oe ?? '-'}</div>
              <div>Brand：{item.brand ?? '-'}</div>
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
