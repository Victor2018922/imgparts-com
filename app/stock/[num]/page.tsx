'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';

type StockItem = {
  num: string;
  title?: string;
  product?: string;
  oe?: string;
  brand?: string;
  model?: string;
  year?: string | number;
  price?: number | string;
  stock?: number | string;
  image?: string;        // 主图
  images?: string[];     // 图集
};

const API = 'https://niuniuparts.com:6001/scm-product/v1/stock2';

// —— 工具：从对象中安全取值 ——
const pick = <T extends object, K extends keyof any>(
  obj: T | null | undefined,
  path: K[] | string[],
  fallback: any = ''
) => {
  try {
    let cur: any = obj;
    for (const p of path) {
      if (cur == null) return fallback;
      cur = cur[p as any];
    }
    return cur ?? fallback;
  } catch {
    return fallback;
  }
};

// —— 工具：把任意 URL 走 weserv 加速（裁切/压缩，弱化条带水印） ——
const viaProxy = (raw?: string, w = 900, h = 900) => {
  if (!raw) return '';
  let clean = raw.trim();

  // 根据需要做域名清洗（按你们真实域名调整/增减）
  clean = clean.replace('img-nnparts.oss-cn-hangzhou.aliyuncs.com', '');

  // 去协议，便于 weserv 识别
  const noProto = clean.replace(/^https?:\/\//, '');
  // fit=inside 不裁掉主体；t=1/2 尝试弱化四周条带；q=60 控制体积
  return `https://images.weserv.nl/?url=${encodeURIComponent(noProto)}&w=${w}&h=${h}&fit=inside&we&output=webp&q=60&t=1`;
};

// —— 工具：把后端 item 解析为前端通用结构 ——
const normalizeItem = (x: any): StockItem => {
  const num = String(pick(x, ['num'], '')).trim();
  const title = pick(x, ['title'], pick(x, ['product'], ''));
  const oe = pick(x, ['oe'], '');
  const brand = pick(x, ['brand'], '');
  const model = pick(x, ['model'], '');
  const year = pick(x, ['year'], '');
  const price = pick(x, ['price'], '');
  const stock = pick(x, ['qty'], pick(x, ['stock'], ''));
  const image = pick(x, ['image'], pick(x, ['img'], ''));
  const images = (pick(x, ['images'], []) || []) as string[];

  return {
    num,
    title,
    product: title,
    oe,
    brand,
    model,
    year,
    price,
    stock,
    image,
    images,
  };
};

export default function StockDetailPage() {
  // ✅ 兼容不同 Next 版本的类型（有的版本 useParams 可能返回 null）
  const params = useParams() as Record<string, string> | null;
  const num = (params?.num ?? '').toString();

  const search = useSearchParams();
  const router = useRouter();

  const [list, setList] = useState<StockItem[]>([]);
  const [current, setCurrent] = useState<StockItem | null>(null);
  const [thumbIndex, setThumbIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // 从 URL query 兜底信息（当列表中找不到该条目时使用）
  const qs = (k: string) => search?.get(k) ?? '';
  const fallbackObj: StockItem = {
    num: String(num ?? ''),
    title: qs('title') || qs('product') || '',
    product: qs('title') || qs('product') || '',
    oe: qs('oe') || '',
    brand: qs('brand') || '',
    model: qs('model') || '',
    year: qs('year') || '',
    price: qs('price') || '',
    stock: qs('stock') || '',
    image: qs('image') || '',
    images: (qs('images') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };

  // 拉取一页较大的列表（便于“上一条/下一条”和兜底）
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        setLoading(true);
        const url = `${API}?size=500&page=0`;
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json();

        // 兼容不同返回结构
        const records =
          pick(data, ['data', 'records'], null) ??
          pick(data, ['data', 'list'], null) ??
          pick(data, ['records'], null) ??
          pick(data, ['list'], []) ??
          [];
        const arr: StockItem[] = (records as any[]).map((x) =>
          normalizeItem(x)
        );
        if (abort) return;
        setList(arr);

        // 在列表中寻找当前 num
        const found =
          arr.find(
            (x) =>
              String(pick(x, ['num'], '')).toLowerCase() ===
              String(num).toLowerCase()
          ) || null;

        setCurrent(found || fallbackObj);
        setThumbIndex(0);
      } catch (err) {
        console.error(err);
        setCurrent(fallbackObj);
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => {
      abort = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [num]);

  // 12 张缩略图（不够则由主图补齐）
  const gallery: string[] = useMemo(() => {
    const imgs = [
      ...(current?.images || []),
      ...(current?.image ? [current.image] : []),
    ].filter(Boolean);
    if (imgs.length >= 12) return imgs.slice(0, 12);
    const pad = Array.from({ length: Math.max(0, 12 - imgs.length) }, () =>
      current?.image ? current.image : ''
    ).filter(Boolean);
    return [...imgs, ...pad].slice(0, 12);
  }, [current]);

  const activeImage = gallery[thumbIndex] || current?.image || '';

  // 上一条 / 下一条
  const toPrev = () => {
    if (!current || list.length === 0) return;
    const i = list.findIndex(
      (x) => String(x.num).toLowerCase() === String(current.num).toLowerCase()
    );
    const prev = list[(i - 1 + list.length) % list.length];
    if (prev) router.push(`/stock/${prev.num}`);
  };

  const toNext = () => {
    if (!current || list.length === 0) return;
    const i = list.findIndex(
      (x) => String(x.num).toLowerCase() === String(current.num).toLowerCase()
    );
    const nxt = list[(i + 1) % list.length];
    if (nxt) router.push(`/stock/${nxt.num}`);
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.push('/stock')}
            className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200"
          >
            ← 返回列表
          </button>
          <div className="flex-1" />
          <button
            onClick={toPrev}
            className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200"
          >
            上一条
          </button>
          <button
            onClick={toNext}
            className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200"
          >
            下一条
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 左：图片区域 */}
          <div>
            {/* 大图 */}
            <div className="w-full aspect-square rounded-lg bg-gray-50 border flex items-center justify-center overflow-hidden">
              {loading ? (
                <div className="animate-pulse w-full h-full bg-gray-100" />
              ) : activeImage ? (
                <img
                  src={viaProxy(activeImage, 900, 900)}
                  alt={current?.title || current?.product || current?.num || ''}
                  className="w-full h-full object-contain cursor-zoom-in"
                  onClick={() => {
                    window.open(viaProxy(activeImage, 1600, 1600), '_blank');
                  }}
                />
              ) : (
                <span className="text-gray-400">无图</span>
              )}
            </div>

            {/* 缩略图 */}
            <div className="mt-3 grid grid-cols-6 gap-2">
              {gallery.map((g, idx) => (
                <button
                  key={`${g}-${idx}`}
                  onClick={() => setThumbIndex(idx)}
                  className={`aspect-square rounded border overflow-hidden ${
                    idx === thumbIndex ? 'ring-2 ring-blue-500' : 'hover:border-blue-300'
                  }`}
                >
                  {g ? (
                    <img
                      src={viaProxy(g, 260, 260)}
                      alt={`thumb-${idx}`}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-50" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 右：信息区域 */}
          <div className="space-y-4">
            <h1 className="text-xl font-semibold">
              {current?.title || current?.product || '产品详情'}
            </h1>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="text-gray-500">Num：</div>
              <div className="font-medium">{current?.num || '-'}</div>

              <div className="text-gray-500">OE：</div>
              <div className="font-medium">{current?.oe || '-'}</div>

              <div className="text-gray-500">Brand：</div>
              <div className="font-medium">{current?.brand || '-'}</div>

              <div className="text-gray-500">Model：</div>
              <div className="font-medium">{current?.model || '-'}</div>

              <div className="text-gray-500">Year：</div>
              <div className="font-medium">
                {current?.year !== undefined && current?.year !== null
                  ? String(current.year)
                  : '-'}
              </div>

              <div className="text-gray-500">Price：</div>
              <div className="font-medium">
                {current?.price !== undefined && current?.price !== null && String(current.price) !== ''
                  ? `¥ ${current?.price}`
                  : '-'}
              </div>

              <div className="text-gray-500">Stock：</div>
              <div className="font-medium">
                {current?.stock !== undefined && current?.stock !== null && String(current.stock) !== ''
                  ? String(current?.stock)
                  : '-'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
