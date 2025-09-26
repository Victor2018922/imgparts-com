'use client';

import React, { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

/* ========= 常量 & 类型 ========= */
const API_BASE = 'https://niuniuparts.com:6001/scm-product/v1/stock2';
const BASE_ORIGIN = new URL(API_BASE).origin;
type Lang = 'zh' | 'en';

type Compact = {
  num?: string;
  product?: string;
  oe?: string;
  brand?: string;
  model?: string;
  year?: string;
  image?: string | null;
};

type CartItem = {
  key: string;
  num?: string;
  product: string;
  oe?: string;
  brand?: string;
  model?: string;
  year?: string;
  qty: number;
  image?: string | null;
};

/* ========= i18n ========= */
const STRINGS: Record<Lang, Record<string, string>> = {
  zh: {
    back: '← 返回库存预览',
    addToCart: '加入购物车',
    checkout: '去结算',
    brand: '品牌',
    model: '车型',
    year: '年款',
    oe: 'OE号',
    lang: '语言：',
    zh: '中文',
    en: 'English',
    dataFrom: '数据源： niuniuparts.com（测试预览用途）',
    noImage: '无图片',
    prev: '上一张',
    next: '下一张',
    close: '关闭',
  },
  en: {
    back: '← Back to list',
    addToCart: 'Add to cart',
    checkout: 'Checkout',
    brand: 'Brand',
    model: 'Model',
    year: 'Year',
    oe: 'OE',
    lang: 'Language:',
    zh: '中文',
    en: 'English',
    dataFrom: 'Data: niuniuparts.com (preview)',
    noImage: 'No Image',
    prev: 'Prev',
    next: 'Next',
    close: 'Close',
  },
};
function useI18n() {
  const [lang, setLang] = useState<Lang>('zh');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const v = (localStorage.getItem('lang') as Lang) || 'zh';
    setLang(v);
  }, []);
  const setLangPersist = (v: Lang) => {
    setLang(v);
    if (typeof window !== 'undefined') localStorage.setItem('lang', v);
  };
  const t = (k: string) => STRINGS[lang][k] || STRINGS.zh[k] || k;
  return { lang, setLang: setLangPersist, t };
}

/* ========= 工具 ========= */
const FALLBACK_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-size="14">No Image</text>
    </svg>`
  );

function decodeD(d: string | null): Compact | null {
  if (!d) return null;
  try {
    // @ts-ignore
    const json = decodeURIComponent(escape(atob(decodeURIComponent(d))));
    const obj = JSON.parse(json);
    return obj;
  } catch {
    return null;
  }
}

function extractFirstUrl(s: string): string | null {
  if (!s || typeof s !== 'string') return null;
  const m1 = s.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m1?.[1]) return m1[1];
  const m2 = s.match(/https?:\/\/[^\s"'<>\\)]+/i);
  if (m2?.[0]) return m2[0];
  const m3 = s.match(/(^|[^:])\/\/[^\s"'<>\\)]+/i);
  if (m3) {
    const raw = m3[0];
    const hit = raw.slice(raw.indexOf('//'));
    if (hit.startsWith('//')) return hit;
  }
  const m4 = s.match(/\/[^\s"'<>\\)]+/);
  if (m4?.[0]) return m4[0];
  return null;
}
function isImgUrl(s: string): boolean {
  if (!s || typeof s !== 'string') return false;
  const v = s.trim();
  if (/^https?:\/\//i.test(v) || v.startsWith('//') || v.startsWith('/')) return true;
  if (/\.(png|jpe?g|webp|gif|bmp|svg|jfif|avif)(\?|#|$)/i.test(v)) return true;
  if (/\/(upload|image|images|img|media|file|files)\//i.test(v)) return true;
  if (/[?&](file|img|image|pic|path)=/i.test(v)) return true;
  return false;
}
function absolutize(u: string | null): string | null {
  if (!u) return null;
  let s = u.trim();
  if (!s) return null;
  if (s.startsWith('data:image')) return s;
  if (s.startsWith('//')) return 'http:' + s;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/')) return BASE_ORIGIN + s;
  return BASE_ORIGIN + '/' + s.replace(/^\.\//, '');
}
function toProxy(u: string): string {
  const clean = u.replace(/^https?:\/\//i, '');
  return `https://images.weserv.nl/?url=${encodeURIComponent(clean)}`;
}
function deepCollectImages(obj: any, out: string[], depth = 0) {
  if (!obj || depth > 5) return;
  if (typeof obj === 'string') {
    const url = extractFirstUrl(obj) || obj;
    if (url && isImgUrl(url)) out.push(url);
    return;
  }
  if (Array.isArray(obj)) {
    for (const it of obj) deepCollectImages(it, out, depth + 1);
    return;
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) deepCollectImages(obj[k], out, depth + 1);
  }
}
function uniqueAbsUrls(list: string[]): string[] {
  const s = new Set<string>();
  const ret: string[] = [];
  for (const x of list) {
    const abs = absolutize(x);
    if (!abs) continue;
    const final = abs.startsWith('http://') ? toProxy(abs) : abs;
    if (!s.has(final)) { s.add(final); ret.push(final); }
  }
  return ret;
}

/* ========= 本地购物车（与列表页兼容） ========= */
function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const v = localStorage.getItem('cart') || '[]';
    const arr = JSON.parse(v);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveCart(v: CartItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('cart', JSON.stringify(v));
}

/* ========= 页面外壳 ========= */
export default function DetailPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading…</div>}>
      <DetailInner />
    </Suspense>
  );
}

/* ========= 主体 ========= */
function DetailInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const d = sp?.get('d') ?? null;
  const { lang, setLang, t } = useI18n();

  const compact = useMemo(() => decodeD(d), [d]);

  const product = compact?.product || 'IMG';
  const oe = compact?.oe || '';
  const num = compact?.num || '';

  // 图片收集（最多 18 张）
  const [images, setImages] = useState<string[]>([]);
  useEffect(() => {
    const bucket: string[] = [];
    deepCollectImages(compact, bucket, 0);
    let imgs = uniqueAbsUrls(bucket);
    if ((!imgs || imgs.length === 0) && compact?.image) {
      const abs = absolutize(compact.image);
      imgs = abs ? [abs.startsWith('http://') ? toProxy(abs) : abs] : [];
    }
    if (imgs.length === 0) imgs = [FALLBACK_IMG];
    setImages(imgs.slice(0, 18));
  }, [compact]);

  // 当前图 / 轮播控制
  const [active, setActive] = useState(0);
  useEffect(() => { setActive(0); }, [images]);
  const prev = () => setActive((i) => (i - 1 + images.length) % images.length);
  const next = () => setActive((i) => (i + 1) % images.length);

  // 自动轮播（悬停暂停、打开 Lightbox 暂停）
  const [hovering, setHovering] = useState(false);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (show || hovering || images.length <= 1) return;
    const id = setInterval(() => setActive((i) => (i + 1) % images.length), 5000);
    return () => clearInterval(id);
  }, [show, hovering, images]);

  // 键盘切换（Lightbox 之外）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (show) return;
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show, images.length]);

  /* 放大镜：右侧放大窗口 */
  const imgRef = useRef<HTMLImageElement | null>(null);
  const zoomRef = useRef<HTMLDivElement | null>(null);
  const onMove = (e: React.MouseEvent) => {
    const img = imgRef.current, pane = zoomRef.current;
    if (!img || !pane) return;
    const rect = img.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    pane.style.backgroundImage = `url(${images[active]})`;
    pane.style.backgroundSize = '200% 200%';
    pane.style.backgroundPosition = `${x}% ${y}%`;
    pane.style.display = 'block';
  };
  const onLeave = () => { if (zoomRef.current) zoomRef.current.style.display = 'none'; };

  // 缩略图滚动
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const scrollThumbs = (dir: number) => {
    thumbRef.current?.scrollBy({ left: dir * 160, behavior: 'smooth' });
  };

  /* 购物车 */
  const addToCart = () => {
    const cur = loadCart();
    cur.push({
      key: `${num}|${oe}|${Date.now()}`,
      num,
      product,
      oe,
      brand: compact?.brand,
      model: compact?.model,
      year: compact?.year,
      qty: 1,
      image: images[0] || null,
    });
    saveCart(cur);
    alert('已加入购物车');
  };
  const goCheckout = () => router.push('/stock?checkout=1');

  return (
    <main className="container mx-auto p-4">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/stock" className="text-sm text-blue-600 hover:underline">{t('back')}</Link>

        <div className="flex items-center gap-1 text-sm">
          <span className="text-gray-500">{t('lang')}</span>
          <button
            onClick={() => setLang('zh')}
            className={`rounded border px-2 py-1 text-xs ${lang === 'zh' ? 'bg-gray-900 text-white border-gray-900' : 'hover:bg-gray-50'}`}
          >
            {t('zh')}
          </button>
          <button
            onClick={() => setLang('en')}
            className={`rounded border px-2 py-1 text-xs ${lang === 'en' ? 'bg-gray-900 text-white border-gray-900' : 'hover:bg-gray-50'}`}
          >
            {t('en')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
        {/* 左侧：主图 + 缩略图 + 放大镜窗口 */}
        <div>
          <div className="relative flex gap-4">
            <div
              className="relative rounded-xl border bg-white p-2 flex-1 select-none"
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={() => setHovering(false)}
            >
              <img
                ref={imgRef}
                src={images[active] || FALLBACK_IMG}
                alt={product}
                className="w-full h-[420px] object-contain"
                onError={(e)=>{ (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG; }}
                onMouseMove={onMove}
                onMouseLeave={onLeave}
                onClick={()=>setShow(true)}
                style={{cursor:'zoom-in'}}
              />

              {/* 轮播左右按钮 */}
              {images.length > 1 && (
                <>
                  <button
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white w-9 h-9 flex items-center justify-center"
                    onClick={prev}
                    aria-label={t('prev')}
                  >‹</button>
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white w-9 h-9 flex items-center justify-center"
                    onClick={next}
                    aria-label={t('next')}
                  >›</button>
                </>
              )}
            </div>

            <div
              ref={zoomRef}
              className="hidden lg:block w-[380px] h-[280px] rounded-xl border bg-white bg-no-repeat"
              style={{ display:'none' }}
            />
          </div>

          {/* thumbnails + 滚动按钮 */}
          <div className="mt-3 flex items-center gap-2">
            <button
              className="rounded-lg border w-8 h-8 text-sm hover:bg-gray-50"
              onClick={()=>scrollThumbs(-1)}
              aria-label="scroll-left"
            >‹</button>

            <div ref={thumbRef} className="flex gap-2 overflow-x-auto scroll-smooth">
              {images.map((src, idx) => (
                <button
                  key={src + idx}
                  className={`h-20 w-20 shrink-0 rounded-lg border ${idx===active?'ring-2 ring-blue-600':''}`}
                  onClick={()=>setActive(idx)}
                >
                  <img src={src} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>

            <button
              className="rounded-lg border w-8 h-8 text-sm hover:bg-gray-50"
              onClick={()=>scrollThumbs(1)}
              aria-label="scroll-right"
            >›</button>
          </div>
        </div>

        {/* 右侧：信息 + 操作 */}
        <div className="rounded-2xl border p-4 bg-white">
          <div className="text-2xl font-semibold break-all">{product}</div>
          <div className="mt-2 text-sm text-gray-600 space-y-1">
            {compact?.brand && <div>{t('brand')}: {compact.brand}</div>}
            {compact?.model && <div>{t('model')}: {compact.model}</div>}
            {compact?.year  && <div>{t('year')}: {compact.year}</div>}
            {oe && <div>{t('oe')}: {oe}</div>}
            {num && <div>SKU: {num}</div>}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button onClick={addToCart} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">
              {t('addToCart')}
            </button>
            <button onClick={goCheckout} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
              {t('checkout')}
            </button>
          </div>

          <div className="mt-4 text-xs text-gray-400">{t('dataFrom')}</div>
        </div>
      </div>

      {/* Lightbox */}
      {show && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
          <div className="flex items-center justify-between p-3 text-white">
            <div className="text-sm">{product}</div>
            <div className="flex items-center gap-2">
              <button className="rounded border border-white/40 px-2 py-1 text-xs" onClick={()=>setShow(false)}>{t('close')}</button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <button className="mx-4 text-white text-2xl" onClick={prev} aria-label={t('prev')}>‹</button>
            <img src={images[active]} alt="" className="max-h-[85vh] max-w-[85vw] object-contain" />
            <button className="mx-4 text-white text-2xl" onClick={next} aria-label={t('next')}>›</button>
          </div>
          <div className="p-3 flex gap-2 overflow-auto bg-black/50">
            {images.map((src, idx) => (
              <button key={src+idx} className={`h-16 w-16 rounded border ${idx===active?'ring-2 ring-white':''}`} onClick={()=>setActive(idx)}>
                <img src={src} alt="" className="h-full w-full object-contain" />
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
