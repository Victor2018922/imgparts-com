'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';

type RawItem = {
  num?: string;
  title?: string;
  model?: string;
  brand?: string;
  oe?: string;
  price?: number | string;
  stock?: number | string;
  images?: string[];
};

function pickURL(search: URLSearchParams, key: string, d = '-') {
  const v = search.get(key);
  return v && v.trim() ? v : d;
}
function pickURLStrList(search: URLSearchParams, key: string) {
  const s = search.get(key);
  if (!s) return [];
  return s.split('|').map(x => x.trim()).filter(Boolean);
}

export default function StockDetailPage() {
  const router = useRouter();
  const params = useParams<{ num?: string }>();
  const search = useSearchParams();

  const num = (params?.num ?? '').toString();

  const [imgs, setImgs] = useState<string[]>([]);
  const [curIdx, setCurIdx] = useState(0);
  const [meta, setMeta] = useState<RawItem | null>(null);
  const [navIdx, setNavIdx] = useState<number>(Number(search.get('idx') ?? -1));
  const [pageList, setPageList] = useState<RawItem[]>([]);

  // 读取 URL 参数兜底
  const urlMeta = useMemo<RawItem>(() => ({
    num,
    title: pickURL(search, 'title'),
    oe: pickURL(search, 'oe'),
    brand: pickURL(search, 'brand'),
    model: pickURL(search, 'model'),
    price: pickURL(search, 'price', ''),
    stock: pickURL(search, 'stock', ''),
  }), [search, num]);

  useEffect(() => {
    // 尝试从上次的列表缓存恢复，用于上一条/下一条
    try {
      const saved = JSON.parse(localStorage.getItem('stock:lastPage') ?? '{}');
      if (Array.isArray(saved?.list)) {
        setPageList(saved.list);
      }
    } catch {}
  }, []);

  useEffect(() => {
    // 以 URL 的 images 为主；其次用列表缓存里对应项；最后保底空
    const fromUrl = pickURLStrList(search, 'images');
    if (fromUrl.length > 0) {
      setImgs(fromUrl);
      setMeta(urlMeta);
      return;
    }

    // 列表缓存兜底（用于直接访问 /stock/:num）
    const found = pageList.find(x => (x.num ?? '').toLowerCase() === num.toLowerCase());
    if (found) {
      setMeta({
        num: found.num,
        title: found.title ?? urlMeta.title,
        oe: found.oe ?? urlMeta.oe,
        brand: found.brand ?? urlMeta.brand,
        model: found.model ?? urlMeta.model,
        price: found.price ?? urlMeta.price,
        stock: found.stock ?? urlMeta.stock,
      });
      setImgs(found.images ?? []);
    } else {
      // 最后兜底：仅用 URL 文本渲染
      setMeta(urlMeta);
      setImgs([]);
    }
  }, [search, pageList, num, urlMeta]);

  const curImg = imgs[curIdx] ?? '';

  const canPrev = navIdx > 0;
  const canNext = navIdx >= 0 && navIdx < pageList.length - 1;

  const gotoByOffset = (off: number) => {
    if (navIdx < 0) return; // 没有导航索引时忽略
    const nextIdx = navIdx + off;
    if (nextIdx < 0 || nextIdx >= pageList.length) return;
    const it = pageList[nextIdx];
    const href =
      `/stock/${encodeURIComponent(it.num ?? '')}`
      + `?title=${encodeURIComponent(it.title ?? '-')}`
      + `&oe=${encodeURIComponent(it.oe ?? '-')}`
      + `&brand=${encodeURIComponent(it.brand ?? '-')}`
      + `&model=${encodeURIComponent(it.model ?? '-')}`
      + `&year=${encodeURIComponent('-')}`
      + `&price=${encodeURIComponent(String(it.price ?? ''))}`
      + `&stock=${encodeURIComponent(String(it.stock ?? ''))}`
      + `&images=${encodeURIComponent((it.images ?? []).join('|'))}`
      + `&idx=${nextIdx}`;
    router.push(href);
    setNavIdx(nextIdx);
    setCurIdx(0);
  };

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <button
        onClick={() => router.push('/stock')}
        className="border rounded px-3 py-1 mb-6"
      >
        ← 返回列表
      </button>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* 左侧大图与缩略图 */}
        <div className="flex-1">
          <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center overflow-hidden rounded">
            {curImg ? (
              <img
                src={curImg}
                alt={meta?.title ?? ''}
                className="object-contain w-full h-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-gray-400">无图</span>
            )}
          </div>

          {imgs.length > 0 && (
            <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
              {imgs.slice(0, 12).map((u, i) => (
                <button
                  key={u + i}
                  onClick={() => setCurIdx(i)}
                  className={`flex-none w-20 h-16 rounded border overflow-hidden ${i === curIdx ? 'ring-2 ring-blue-500' : ''}`}
                  title={`预览 ${i + 1}`}
                >
                  <img src={u} alt={`thumb ${i + 1}`} className="object-cover w-full h-full" referrerPolicy="no-referrer" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 右侧信息 */}
        <div className="w-full lg:w-[420px] space-y-2">
          <h2 className="text-2xl font-bold">产品详情</h2>

          <div className="grid grid-cols-[80px_1fr] gap-x-4 gap-y-2 text-sm">
            <div className="text-gray-500">Num：</div><div>{meta?.num ?? '-'}</div>
            <div className="text-gray-500">OE：</div><div>{meta?.oe ?? '-'}</div>
            <div className="text-gray-500">Brand：</div><div>{meta?.brand ?? '-'}</div>
            <div className="text-gray-500">Model：</div><div>{meta?.model ?? '-'}</div>
            <div className="text-gray-500">Year：</div><div>-</div>
            <div className="text-gray-500">Price：</div><div>{meta?.price ?? '-'}</div>
            <div className="text-gray-500">Stock：</div><div>{meta?.stock ?? '-'}</div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              className="px-3 py-1 rounded border disabled:opacity-50"
              disabled={!canPrev}
              onClick={() => gotoByOffset(-1)}
            >
              上一条
            </button>
            <button
              className="px-3 py-1 rounded border disabled:opacity-50"
              disabled={!canNext}
              onClick={() => gotoByOffset(1)}
            >
              下一条
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
