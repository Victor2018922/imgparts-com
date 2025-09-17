'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';

type RawItem = {
  num: string;
  title?: string;
  oe?: string;
  brand?: string;
  model?: string;
  year?: string;
  price?: number | string;
  stock?: number | string;
  images?: string[];
};

// 读取浏览器 localStorage（SSR 安全）
function safeLoad<T>(key: string, df: T): T {
  try {
    if (typeof window === 'undefined') return df;
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : df;
  } catch {
    return df;
  }
}

// 同时兼容两种历史键名：'stock:lastPage' 与 'stock:list'
function loadPageList(): RawItem[] {
  const a = safeLoad<{ list?: RawItem[] }>('stock:lastPage', {} as any);
  if (Array.isArray(a?.list)) return a.list!;
  const b = safeLoad<RawItem[]>('stock:list', []);
  return Array.isArray(b) ? b : [];
}

// 读取 URLSearchParams（兼容某些环境下 useSearchParams 可能异常）
function useSearchGetter() {
  const sp = useSearchParams();
  return (key: string): string | null => {
    try {
      const v = (sp as any)?.get?.(key);
      if (v != null) return v;
    } catch {}
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get(key);
    }
    return null;
  };
}

// 把 "a|b,c" 这类分隔字符串拆成数组（兼容 | 或 ,）
function splitImages(s: string): string[] {
  return s
    .split(/[|,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function StockDetailPage() {
  // ✅ 不解构，避免 TS 对 “可能为 null” 的报错；用 any 宽松获取
  const params = useParams() as any;
  const num: string = String(params?.num ?? '');

  const getQuery = useSearchGetter();
  const router = useRouter();

  // 图片当前索引
  const [curIdx, setCurIdx] = useState<number>(0);
  // 当前详情对象
  const [meta, setMeta] = useState<RawItem | null>(null);
  // 同页导航索引（来自列表点击时带过来的 idx；直达则为 -1）
  const [navIdx, setNavIdx] = useState<number>(() => {
    const v = Number(getQuery('idx') ?? -1);
    return Number.isFinite(v) ? v : -1;
  });
  // 当前页的列表（供“上一条/下一条”使用）
  const [pageList, setPageList] = useState<RawItem[]>([]);

  // 初始兜底：从 URL 参数拼一个对象
  const urlFallback = useMemo<RawItem>(() => {
    const imgsParam = getQuery('images') ?? getQuery('image') ?? '';
    const images = imgsParam ? splitImages(imgsParam) : [];
    const priceRaw = getQuery('price');
    return {
      num,
      title: getQuery('title') ?? '',
      oe: getQuery('oe') ?? '',
      brand: getQuery('brand') ?? '',
      model: getQuery('model') ?? '',
      year: getQuery('year') ?? '',
      price: priceRaw ?? '',
      stock: getQuery('stock') ?? '',
      images,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [num]);

  useEffect(() => {
    // 1) 取本地缓存的当页列表（由列表页写入）
    const list = loadPageList();
    setPageList(list);

    // 2) 尝试从列表里找到当前 num（大小写无关）
    const found =
      list.find(
        (x: any) => String(x?.num ?? '').toLowerCase() === String(num).toLowerCase()
      ) || null;

    // 3) 确定 navIdx（优先 URL，其次列表中位置，最后 -1）
    if (navIdx === -1) {
      const idx = list.findIndex(
        (x: any) => String(x?.num ?? '').toLowerCase() === String(num).toLowerCase()
      );
      setNavIdx(idx >= 0 ? idx : -1);
    }

    // 4) 元数据：列表命中优先，否则用 URL 兜底
    setMeta(found ?? urlFallback);

    // 5) 如果有图片，默认第一张
    setCurIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [num]);

  // 取图片数组（限制 12 张）
  const images = useMemo<string[]>(() => {
    const arr = meta?.images ?? [];
    return Array.isArray(arr) ? arr.slice(0, 12) : [];
  }, [meta]);

  // 上一条 / 下一条
  const goto = (dir: -1 | 1) => {
    if (!pageList.length) return;
    const cur = navIdx >= 0 ? navIdx : pageList.findIndex((x) => x.num === num);
    const next = cur + dir;
    if (next < 0 || next >= pageList.length) return;
    const it = pageList[next];
    const params = new URLSearchParams();
    params.set('idx', String(next));
    if (it.title) params.set('title', String(it.title));
    if (it.oe) params.set('oe', String(it.oe));
    if (it.brand) params.set('brand', String(it.brand));
    if (it.model) params.set('model', String(it.model));
    if (it.year) params.set('year', String(it.year));
    if (it.price != null) params.set('price', String(it.price));
    if (it.stock != null) params.set('stock', String(it.stock));
    if (it.images?.length) params.set('images', it.images.join('|')); // 我们用 | 作为首选分隔符
    router.push(`/stock/${encodeURIComponent(it.num)}?${params.toString()}`);
  };

  return (
    <div className="p-6">
      <button
        className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-800"
        onClick={() => router.push('/stock')}
      >
        ← 返回列表
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* 左侧：大图 + 缩略图 */}
        <div>
          <div className="w-full aspect-[4/3] bg-gray-50 border rounded flex items-center justify-center overflow-hidden">
            {images.length ? (
              <img
                src={images[curIdx]}
                alt={meta?.title ?? meta?.num ?? ''}
                className="max-w-full max-h-full object-contain"
                loading="eager"
                decoding="async"
              />
            ) : (
              <span className="text-gray-400">无图</span>
            )}
          </div>

          {/* 缩略图（最多 12 张） */}
          {images.length > 0 && (
            <div className="mt-4 flex gap-2 overflow-x-auto">
              {images.map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  onClick={() => setCurIdx(i)}
                  className={`shrink-0 w-20 h-16 border rounded overflow-hidden ${
                    i === curIdx ? 'ring-2 ring-blue-500' : ''
                  }`}
                  title={`预览 ${i + 1}`}
                >
                  <img
                    src={src}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    alt={`thumb-${i + 1}`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 右侧：详情 + 导航 */}
        <div>
          <h2 className="text-xl font-semibold mb-4">产品详情</h2>
          <ul className="space-y-3 text-gray-700">
            <li>
              <span className="inline-block w-20 text-gray-500">Num:</span> {meta?.num ?? '-'}
            </li>
            <li>
              <span className="inline-block w-20 text-gray-500">OE:</span> {meta?.oe ?? '-'}
            </li>
            <li>
              <span className="inline-block w-20 text-gray-500">Brand:</span> {meta?.brand ?? '-'}
            </li>
            <li>
              <span className="inline-block w-20 text-gray-500">Model:</span> {meta?.model ?? '-'}
            </li>
            <li>
              <span className="inline-block w-20 text-gray-500">Year:</span> {meta?.year ?? '-'}
            </li>
            <li>
              <span className="inline-block w-20 text-gray-500">Price:</span> {meta?.price ?? '-'}
            </li>
            <li>
              <span className="inline-block w-20 text-gray-500">Stock:</span> {meta?.stock ?? '-'}
            </li>
          </ul>

          <div className="flex gap-3 mt-6">
            <button
              className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
              onClick={() => goto(-1)}
              disabled={!pageList.length || (navIdx <= 0 && navIdx !== -1)}
            >
              上一条
            </button>
            <button
              className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
              onClick={() => goto(1)}
              disabled={!pageList.length || (navIdx >= pageList.length - 1 && navIdx !== -1)}
            >
              下一条
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

