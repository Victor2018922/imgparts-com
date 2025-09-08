'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type StockItem = {
  num: string;
  product: string;
  oe: string;
  brand: string;
  model: string;
  year: string;
  image?: string;
  images?: string[];
};

async function fetchItem(num: string): Promise<StockItem | null> {
  const res = await fetch(`/api/stock/item?num=${encodeURIComponent(num)}`, { cache: 'no-store' });
  if (!res.ok) return null;
  const data: StockItem[] = await res.json();
  return data && data.length ? data[0] : null;
}

export default function ItemDetailPage({ params }: { params: { num: string } }) {
  const { num } = params;
  const [item, setItem] = useState<StockItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchItem(num).then((it) => {
      if (mounted) {
        setItem(it);
        setIdx(0);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [num]);

  const gallery = useMemo(() => {
    const list = item?.images && item.images.length ? item.images : (item?.image ? [item.image] : []);
    // 去重，防止相同URL重复
    return Array.from(new Set(list));
  }, [item]);

  const current = gallery[idx] || '';

  const hasPrev = idx > 0;
  const hasNext = idx < Math.max(0, gallery.length - 1);

  const goPrev = () => hasPrev && setIdx((v) => v - 1);
  const goNext = () => hasNext && setIdx((v) => v + 1);
  const onThumb = (i: number) => setIdx(i);

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl p-4">
        <h1 className="text-xl font-semibold">加载中…</h1>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="mx-auto max-w-6xl p-4 space-y-3">
        <h1 className="text-2xl font-bold">Item not found.</h1>
        <Link href="/stock" className="text-blue-600 hover:underline">← Back to Stock</Link>
        <p className="text-sm opacity-70">数据源：niuniuparts.com（测试预览用途）</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-4 space-y-6">
      {/* 面包屑 */}
      <div className="text-sm text-gray-500">
        <Link href="/" className="hover:underline">首页</Link>
        <span className="mx-2">/</span>
        <Link href="/stock" className="hover:underline">库存预览</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{item.product || item.num}</span>
      </div>

      {/* 标题区 */}
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{item.product || '未命名'}</h1>
          <p className="text-gray-500 mt-1">Num: <span className="font-mono">{item.num}</span></p>
        </div>
        <button
          className="px-3 py-2 rounded-md bg-gray-900 text-white text-sm hover:opacity-90"
          onClick={() => copy(item.num)}
          title="复制编号"
        >
          复制编号
        </button>
      </header>

      {/* 画廊 */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 主图区 */}
        <div className="relative">
          <div className="relative w-full aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
            {current ? (
              <Image
                src={current}
                alt={item.product || item.num}
                fill
                // 关键：让 Next 按容器尺寸做压缩和懒加载
                sizes="(max-width: 768px) 100vw, 50vw"
                priority={false}
                // 占位 & 优化
                placeholder="blur"
                blurDataURL="data:image/gif;base64,R0lGODlhAQABAAAAACw="
                className="object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                无图片
              </div>
            )}
          </div>

          {/* 上/下一张 */}
          {gallery.length > 1 && (
            <>
              <button
                onClick={goPrev}
                disabled={!hasPrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 px-3 py-2 rounded-md bg-white/80 hover:bg-white shadow disabled:opacity-50"
                title="上一张"
              >
                ‹
              </button>
              <button
                onClick={goNext}
                disabled={!hasNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-2 rounded-md bg-white/80 hover:bg-white shadow disabled:opacity-50"
                title="下一张"
              >
                ›
              </button>
            </>
          )}
        </div>

        {/* 参数/规格 */}
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold mb-2">Specifications</h2>
            <div className="space-y-1 text-sm">
              <div>SKU / Num: <span className="font-mono">{item.num}</span></div>
              <div>OE: <span className="font-mono">{item.oe || '-'}</span> <button className="ml-2 text-blue-600 hover:underline" onClick={() => copy(item.oe || '')}>复制</button></div>
              <div>Brand: {item.brand || '-'}</div>
              <div>Model: {item.model || '-'}</div>
              <div>Year: {item.year || '-'}</div>
            </div>
          </div>

          <div>
            <h2 className="font-semibold mb-2">Compatibility</h2>
            <div className="space-y-1 text-sm">
              <div>Brand: {item.brand || '-'}</div>
              <div>Model: {item.model || '-'}</div>
              <div>Year: {item.year || '-'}</div>
            </div>
          </div>

          <p className="text-xs text-gray-500">数据源：niuniuparts.com（测试预览用途）</p>
        </div>
      </section>

      {/* 缩略图 */}
      {gallery.length > 1 && (
        <section className="space-y-2">
          <h3 className="font-semibold">更多图片（{gallery.length}）</h3>
          <div className="flex gap-3 overflow-x-auto py-2">
            {gallery.map((url, i) => (
              <button
                key={url + i}
                onClick={() => onThumb(i)}
                className={`relative shrink-0 w-28 h-20 rounded-md overflow-hidden border ${i === idx ? 'border-blue-600' : 'border-gray-200'}`}
                title={`图片 ${i + 1}`}
              >
                <Image
                  src={url}
                  alt={`thumb-${i + 1}`}
                  fill
                  sizes="112px"
                  className="object-contain bg-gray-100"
                />
              </button>
            ))}
          </div>
        </section>
      )}

      <div>
        <Link href="/stock" className="text-blue-600 hover:underline">← Back to Stock</Link>
      </div>
    </main>
  );
}
