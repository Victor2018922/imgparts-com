'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';

// =============== 工具：数据解析 ===============
type AnyObj = Record<string, any>;

type DetailItem = {
  id?: string;
  sn?: string;
  name?: string;
  brand?: string;
  model?: string;
  year?: string;
  oe?: string;
  img?: string | string[];
  imgs?: string[];
  images?: string[];
  pictures?: string[];
  pic?: string;
  photo?: string;
  image?: string;
  urls?: string[];
  imageList?: string[];
  pics?: string[];
  // 自定义扩展
  imageUrls?: string[];
};

const FALLBACK_LIST_API = 'https://niuniuparts.com:6001/scm-product/v1/stock2?size=20&page=0';

function safeJsonParse<T = any>(s?: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    try {
      // 可能是 base64 -> json
      const decoded = Buffer.from(decodeURIComponent(s), 'base64').toString('utf-8');
      return JSON.parse(decoded) as T;
    } catch {
      try {
        return JSON.parse(decodeURIComponent(s));
      } catch {
        return null;
      }
    }
  }
}

/** 兼容多种字段来源的图片解析 */
function extractImageUrls(obj: AnyObj): string[] {
  const candidates: Array<string | string[] | undefined> = [
    obj.imageUrls,
    obj.images,
    obj.imageList,
    obj.imgs,
    obj.pictures,
    obj.pics,
    obj.urls,
    obj.img,
    obj.image,
    obj.pic,
    obj.photo
  ];

  const urls: string[] = [];

  const pushUrl = (raw: string) => {
    const parts = String(raw)
      .split(/[\s,;\n]+/g)
      .map((v) => v.trim())
      .filter(Boolean);
    for (const p of parts) {
      if (/^https?:\/\//i.test(p) && /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(p)) {
        urls.push(p);
      }
    }
  };

  for (const c of candidates) {
    if (!c) continue;
    if (Array.isArray(c)) {
      c.forEach((v) => pushUrl(String(v)));
    } else {
      pushUrl(String(c));
    }
  }

  // 去重
  return Array.from(new Set(urls));
}

/** 详情项字段标准化 */
function normalizeItem(raw?: AnyObj | null): DetailItem | null {
  if (!raw || typeof raw !== 'object') return null;
  // 尝试常用字段
  const oe =
    raw.oe ||
    raw.OE ||
    raw.oeNo ||
    raw.oeCode ||
    raw.oe_number ||
    raw.oe_num ||
    raw['OE号'] ||
    raw['OE编码'] ||
    '';

  const id = raw.id ?? raw.sn ?? raw.code ?? raw.sku ?? raw.num ?? oe ?? '';

  const name =
    raw.name ||
    raw.title ||
    raw.productName ||
    raw.partName ||
    raw['品名'] ||
    raw['名称'] ||
    '';

  const brand = raw.brand || raw.maker || raw['品牌'] || '';
  const model = raw.model || raw.vehicle || raw['车型'] || '';
  const year = raw.year || raw['年份'] || '';

  const imageUrls = extractImageUrls(raw);

  return {
    id: String(id || ''),
    sn: String(raw.sn ?? ''),
    oe: String(oe || ''),
    name: String(name || 'IMG'),
    brand: String(brand || 'IMG'),
    model: String(model || ''),
    year: String(year || ''),
    imageUrls
  };
}

/** 把详情数据编码到 URL 中（点击列表进详情用） */
export function encodeItemToParam(item: AnyObj): string {
  try {
    const s = JSON.stringify(item);
    return encodeURIComponent(Buffer.from(s, 'utf-8').toString('base64'));
  } catch {
    return encodeURIComponent(JSON.stringify(item));
  }
}

/** 从 URL 解析详情 JSON */
function decodeItemFromParam(d?: string | null): DetailItem | null {
  const json = safeJsonParse<AnyObj>(d);
  return normalizeItem(json);
}

// =============== UI：放大镜 ===============
const Magnifier: React.FC<{
  src: string;
  zoom?: number;
  className?: string;
}> = ({ src, zoom = 2, className }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const lensRef = useRef<HTMLDivElement | null>(null);

  const [isOver, setIsOver] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const img = imgRef.current;
    const lens = lensRef.current;
    if (!wrap || !img || !lens) return;

    const handleMove = (e: MouseEvent) => {
      const rect = wrap.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const lensSize = 140;
      const lx = Math.max(0, Math.min(x - lensSize / 2, rect.width - lensSize));
      const ly = Math.max(0, Math.min(y - lensSize / 2, rect.height - lensSize));

      lens.style.left = `${lx}px`;
      lens.style.top = `${ly}px`;

      const bgX = -(lx * zoom);
      const bgY = -(ly * zoom);
      lens.style.backgroundImage = `url(${src})`;
      lens.style.backgroundRepeat = 'no-repeat';
      lens.style.backgroundSize = `${rect.width * zoom}px ${rect.height * zoom}px`;
      lens.style.backgroundPosition = `${bgX}px ${bgY}px`;
    };

    const onEnter = () => setIsOver(true);
    const onLeave = () => setIsOver(false);

    wrap.addEventListener('mousemove', handleMove);
    wrap.addEventListener('mouseenter', onEnter);
    wrap.addEventListener('mouseleave', onLeave);

    return () => {
      wrap.removeEventListener('mousemove', handleMove);
      wrap.removeEventListener('mouseenter', onEnter);
      wrap.removeEventListener('mouseleave', onLeave);
    };
  }, [src, zoom]);

  return (
    <div ref={wrapRef} className={`relative overflow-hidden ${className || ''}`}>
      <img ref={imgRef} src={src} alt="product" className="block w-full rounded-lg" />
      <div
        ref={lensRef}
        style={{ width: 140, height: 140, display: isOver ? 'block' : 'none' }}
        className="pointer-events-none absolute rounded-full border border-gray-300 shadow-lg opacity-95"
      />
    </div>
  );
};

// =============== 详情页主组件 ===============
export default function StockDetailPage() {
  const params = useParams<{ num: string }>();
  const search = useSearchParams();
  const d = search?.get('d') ?? null;

  const [item, setItem] = useState<DetailItem | null>(() => decodeItemFromParam(d));
  const [banner, setBanner] = useState<string | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // 键盘左右键切换
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!item?.imageUrls?.length) return;
      if (e.key === 'ArrowLeft') setActiveIndex((i) => (i - 1 + item.imageUrls!.length) % item.imageUrls!.length);
      if (e.key === 'ArrowRight') setActiveIndex((i) => (i + 1) % item.imageUrls!.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item?.imageUrls]);

  // 自动轮播
  useEffect(() => {
    if (!autoPlay || !item?.imageUrls?.length) return;
    const t = setInterval(() => {
      setActiveIndex((i) => (i + 1) % item.imageUrls!.length);
    }, 5000);
    return () => clearInterval(t);
  }, [autoPlay, item?.imageUrls]);

  // 如果 URL 未带 d，兜底拉第一页再试着匹配，同步提示
  useEffect(() => {
    (async () => {
      if (item) return;
      try {
        const res = await fetch(FALLBACK_LIST_API, { cache: 'no-store' });
        if (!res.ok) {
          setBanner(`⚠️ 详情未携带数据且兜底失败：HTTP ${res.status}`);
          return;
        }
        const j = await res.json();
        const arr = Array.isArray(j?.data?.content)
          ? j.data.content
          : Array.isArray(j?.content)
          ? j.content
          : Array.isArray(j?.data)
          ? j.data
          : [];

        // 最简单的匹配：按路由参数 num（可能是 OE 或 sn）尝试
        const found = arr.find(
          (x: AnyObj) =>
            String(x?.sn ?? x?.id ?? '').includes(params?.num ?? '') ||
            String(x?.oe ?? '').includes(params?.num ?? '')
        );
        const normalized = normalizeItem(found || arr[0]);
        if (!normalized) {
          setBanner('⚠️ 未找到详情条目');
        } else {
          setItem(normalized);
        }
      } catch (e) {
        setBanner('⚠️ 兜底抓取异常');
      }
    })();
  }, [item, params?.num]);

  const images = useMemo(() => item?.imageUrls ?? [], [item]);

  const handleThumbScroll = (dir: 'left' | 'right') => {
    const box = document.getElementById('thumb-strip');
    if (!box) return;
    const step = 220;
    box.scrollBy({ left: dir === 'left' ? -step : step, behavior: 'smooth' });
  };

  if (!item) {
    return (
      <main className="container mx-auto p-4">
        <div className="text-gray-500">加载中…</div>
      </main>
    );
  }

  return (
    <main className="container mx-auto p-4">
      {/* 顶部导航 */}
      <div className="mb-4 flex items-center justify-between">
        <Link href="/stock" className="text-sm text-blue-600 hover:underline">
          ← 返回库存预览
        </Link>
        <nav className="space-x-4 text-sm">
          <Link href="/" className="hover:underline">
            首页
          </Link>
          <Link href="/stock" className="hover:underline">
            库存预览
          </Link>
        </nav>
      </div>

      {/* 提示 */}
      {banner && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800 text-sm">{banner}</div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* 主图（放大镜） */}
        <div
          className="group"
          onMouseEnter={() => setAutoPlay(false)}
          onMouseLeave={() => setAutoPlay(true)}
        >
          {images.length > 0 ? (
            <Magnifier key={images[activeIndex]} src={images[activeIndex]} className="aspect-[4/3] w-full rounded-lg bg-white" />
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border bg-gray-50 text-gray-400">
              No Image
            </div>
          )}

          {/* 左右切换按钮 */}
          {images.length > 1 && (
            <>
              <button
                aria-label="prev"
                onClick={() => setActiveIndex((i) => (i - 1 + images.length) % images.length)}
                className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/60"
              >
                ‹
              </button>
              <button
                aria-label="next"
                onClick={() => setActiveIndex((i) => (i + 1) % images.length)}
                className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/60"
              >
                ›
              </button>
            </>
          )}

          {/* 点击大图预览 */}
          {images.length > 0 && (
            <div className="mt-3 text-right">
              <button
                onClick={() => setLightboxOpen(true)}
                className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50"
              >
                查看大图
              </button>
            </div>
          )}
        </div>

        {/* 右侧信息 */}
        <div>
          <h1 className="mb-3 text-2xl font-semibold">{item.name || 'IMG'}</h1>
          <div className="space-y-2 text-gray-700">
            {!!item.brand && (
              <div>
                <span className="inline-block w-16 text-gray-500">品牌：</span>
                <span>{item.brand}</span>
              </div>
            )}
            {!!item.model && (
              <div>
                <span className="inline-block w-16 text-gray-500">车型：</span>
                <span>{item.model}</span>
              </div>
            )}
            {!!item.oe && (
              <div>
                <span className="inline-block w-16 text-gray-500">OE：</span>
                <span>{item.oe}</span>
              </div>
            )}
            {!!item.year && (
              <div>
                <span className="inline-block w-16 text-gray-500">年份：</span>
                <span>{item.year}</span>
              </div>
            )}
          </div>

          {/* 操作按钮（加入购物车、去结算）—— 与列表页对齐 */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => {
                // 仅做示例：把当前 item 存入本地购物车
                try {
                  const key = 'imgparts_cart';
                  const old = JSON.parse(localStorage.getItem(key) || '[]') as AnyObj[];
                  const exist = old.findIndex((x) => (x.oe || x.id) === (item.oe || item.id));
                  if (exist >= 0) old[exist].qty = (old[exist].qty || 1) + 1;
                  else old.push({ ...(item as AnyObj), qty: 1 });
                  localStorage.setItem(key, JSON.stringify(old));
                  alert('已加入购物车（本地保存）！');
                } catch {
                  alert('加入购物车失败：本地存储异常');
                }
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              加入购物车
            </button>
            <Link
              href="/stock?checkout=1"
              className="rounded-lg border px-4 py-2 hover:bg-gray-50"
            >
              去结算
            </Link>
          </div>

          {/* 数据来源 */}
          <div className="mt-8 text-sm text-gray-400">
            数据源： <a className="hover:underline" href="https://niuniuparts.com" target="_blank">niuniuparts.com</a>（测试预览用途）
          </div>
        </div>
      </div>

      {/* 缩略图条 */}
      {images.length > 1 && (
        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <div className="font-medium text-gray-700">更多图片</div>
            <div className="space-x-2">
              <button onClick={() => handleThumbScroll('left')} className="rounded border px-2 py-1 hover:bg-gray-50">
                ←
              </button>
              <button onClick={() => handleThumbScroll('right')} className="rounded border px-2 py-1 hover:bg-gray-50">
                →
              </button>
            </div>
          </div>
          <div id="thumb-strip" className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
            {images.map((u, idx) => (
              <button
                key={u + idx}
                onClick={() => setActiveIndex(idx)}
                className={`relative h-28 min-w-[180px] flex-none overflow-hidden rounded-md border ${idx === activeIndex ? 'border-blue-500' : 'border-gray-200'}`}
                title={`图 ${idx + 1}`}
              >
                <img src={u} alt={`thumb-${idx}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox 大图 */}
      {lightboxOpen && images.length > 0 && (
        <div
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <img
            src={images[activeIndex]}
            className="max-h-[92vh] max-w-[92vw] rounded-lg shadow-2xl"
            alt="preview"
          />
        </div>
      )}
    </main>
  );
}
