'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

type AnyObj = Record<string, any>;

/* ======== 全局裁切/遮罩策略（避免源图上出现公司字样） ======== */
const CROP_TOP_PCT = 6;   // 裁掉顶部百分比
const CROP_BOTTOM_PCT = 16; // 裁掉底部百分比（默认水印在底部，适当加大）
const MASK_BOTTOM_PX = 24;  // 底部渐变遮罩高度（px），双保险

/* ======== 连接优化：预连接图片域名 ======== */
function preconnectOnce() {
  if (typeof document === 'undefined') return;
  if ((window as any).__img_preconnected__) return;
  const add = (rel: string, href: string) => {
    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    document.head.appendChild(link);
  };
  add('preconnect', 'https://images.weserv.nl');
  add('dns-prefetch', '//images.weserv.nl');
  add('preconnect', 'https://niuniuparts.com');
  add('dns-prefetch', '//niuniuparts.com');
  (window as any).__img_preconnected__ = true;
}

/* ======== 图片 URL & 代理（统一走 HTTPS + 压缩） ======== */
function absolutize(url: string): string {
  if (!url) return url;
  let u = url.trim();
  if (u.startsWith('//')) return 'http:' + u;
  if (u.startsWith('/')) return 'http://niuniuparts.com' + u;
  return u;
}
function toProxy(raw?: string | null, w = 800, h = 600, q = 75): string | null {
  if (!raw) return null;
  let u = absolutize(raw);
  if (/^data:image\//i.test(u)) return u;
  u = u.replace(/^https?:\/\//i, ''); // weserv 要求无协议主机
  // 说明：使用 contain，前端再裁切；这样能保证不拉伸变形
  return `https://images.weserv.nl/?url=${encodeURIComponent(u)}&w=${w}&h=${h}&fit=contain&we=auto&q=${q}&il`;
}

/* ======== 候选图片收集 ======== */
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
function collectCandidateUrls(obj: any, max = 3000): string[] {
  const ret = new Set<string>();
  const seen = new Set<any>();
  const stack: any[] = [obj];
  const imgKeys = [
    'image','imageurl','image_url','imagePath','imageList','images',
    'pics','pictures','photos','thumbnail','thumb','thumburl',
    'cover','logo','banner','mainpic','main_pic','img','imgurl','图片','主图'
  ];
  while (stack.length && ret.size < max) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
    seen.add(cur);
    for (const k of Object.keys(cur)) {
      const v = (cur as AnyObj)[k];
      if (imgKeys.some((kw) => k.toLowerCase().includes(kw.toLowerCase()))) {
        if (typeof v === 'string') {
          extractUrlsFromText(v).forEach((u) => ret.add(u));
          if (/\.(jpg|jpeg|png|gif|webp)(\?|#|$)/i.test(v)) ret.add(v);
        } else if (Array.isArray(v)) {
          v.forEach((x) => {
            if (typeof x === 'string') {
              extractUrlsFromText(x).forEach((u) => ret.add(u));
              if (/\.(jpg|jpeg|png|gif|webp)(\?|#|$)/i.test(x)) ret.add(x);
            } else if (x && typeof x === 'object') {
              ['url','src','path'].forEach((kk) => {
                if (typeof (x as any)[kk] === 'string') {
                  const s = (x as any)[kk] as string;
                  ret.add(s);
                  extractUrlsFromText(s).forEach((u) => ret.add(u));
                }
              });
            }
          });
        } else if (v && typeof v === 'object') {
          ['url','src','path'].forEach((kk) => {
            if (typeof (v as any)[kk] === 'string') {
              const s = (v as any)[kk] as string;
              ret.add(s);
              extractUrlsFromText(s).forEach((u) => ret.add(u));
            }
          });
        }
      }
      if (typeof v === 'string') extractUrlsFromText(v).forEach((u) => ret.add(u));
      if (Array.isArray(v) || (v && typeof v === 'object')) stack.push(v);
    }
  }
  return Array.from(ret);
}

/* ======== 取值/定位 ======== */
function pick(obj: AnyObj | null | undefined, keys: string[], fallback: any = '-') {
  if (!obj) return fallback;
  const alias: Record<string, string[]> = {
    title: ['标题', '名称', '品名', 'title', 'product', 'name'],
    brand: ['品牌', 'brand'],
    model: ['车型', 'model'],
    year:  ['年份', '年款', 'year'],
    oe:    ['OE', 'oe', '配件号', '编号'],
    num:   ['num', '编码', '编号', '货号'],
    price: ['价格', '单价', '售价', 'price'],
    stock: ['库存', '库存数量', '数量', '在库', 'stock'],
  };
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    const group = alias[k];
    if (group) for (const a of group) {
      if (obj[a] !== undefined && obj[a] !== null && obj[a] !== '') return obj[a];
    }
  }
  return fallback;
}
function findByNum(list: any[], num: string): AnyObj | null {
  if (!Array.isArray(list)) return null;
  const norm = (v: any) => String(v ?? '').trim();
  for (const it of list) {
    try {
      const n1 = pick(it, ['num'], null);
      if (n1 && norm(n1) === num) return it;
      const n2 = pick(it, ['编码', '编号', '货号'], null);
      if (n2 && norm(n2) === num) return it;
      const txt = JSON.stringify(it);
      if (new RegExp(`["']${num}["']`).test(txt)) return it;
    } catch {}
  }
  return null;
}

/* ======== 组件 ======== */
export default function StockDetailPage({
  params,
  searchParams,
}: { params: { num: string }; searchParams?: AnyObj }) {
  const num = decodeURI(params.num || '').trim();
  const [detail, setDetail] = useState<AnyObj | null>(null);

  // 图片/缩略图
  const [allThumbs, setAllThumbs] = useState<string[]>([]);
  const [thumbs, setThumbs] = useState<string[]>([]); // 首屏12张
  const [currentRaw, setCurrentRaw] = useState<string | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  // 相邻产品
  const [prevHref, setPrevHref] = useState<string | null>(null);
  const [nextHref, setNextHref] = useState<string | null>(null);
  const [prevPrefetch, setPrevPrefetch] = useState<string | null>(null);
  const [nextPrefetch, setNextPrefetch] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const stripRef = useRef<HTMLDivElement>(null);

  // 放大查看
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomTx, setZoomTx] = useState(0);
  const [zoomTy, setZoomTy] = useState(0);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  useEffect(() => preconnectOnce(), []);

  // 渐进切换：tiny -> small -> big
  const setMainFromRaw = (raw: string) => {
    setCurrentRaw(raw);
    const tiny  = toProxy(raw, 320, 240, 42);
    const small = toProxy(raw, 560, 420, 58);
    const big   = toProxy(raw, 960, 720, 78);
    setImgUrl(tiny || small || big || null);
    if (small) {
      const s = new Image(); s.src = small; s.onload = () => {
        setImgUrl(small);
        if (big) { const b = new Image(); b.src = big; b.onload = () => setImgUrl(big); }
      };
    }
  };

  // 放大：默认裁切后的小清晰图 -> 再升级超清
  const openZoom = (raw: string) => {
    const small = toProxy(raw, 960, 720, 78);
    const xlarge = toProxy(raw, 1600, 1200, 85);
    setZoomScale(1); setZoomTx(0); setZoomTy(0);
    setZoomSrc(small || xlarge || null);
    setZoomOpen(true);
    if (xlarge) { const img = new Image(); img.src = xlarge; img.onload = () => setZoomSrc(xlarge); }
  };

  // 生成链接（带兜底文本，切页更快）
  const makeHref = (item: AnyObj) => {
    const q = new URLSearchParams({
      title: String(pick(item, ['title'], '-')),
      oe:    String(pick(item, ['oe'], '')),
      brand: String(pick(item, ['brand'], '-')),
      model: String(pick(item, ['model'], '-')),
      price: String(pick(item, ['price'], '-')),
      stock: String(pick(item, ['stock'], '-')),
    }).toString();
    return `/stock/${encodeURIComponent(String(pick(item, ['num'], '')))}?${q}`;
  };

  // 预热：预取相邻产品的 small 图
  const prefetchSmall = (raw?: string | null) => {
    if (!raw) return null;
    const u = toProxy(raw, 560, 420, 58);
    if (!u) return null;
    const i = new Image(); i.src = u;
    return u;
  };

  useEffect(() => {
    const baseFromQuery: AnyObj = {
      num,
      title: searchParams?.title ?? searchParams?.product ?? searchParams?.name,
      oe:    searchParams?.oe, brand: searchParams?.brand, model: searchParams?.model,
      year:  searchParams?.year, price: searchParams?.price, stock: searchParams?.stock,
      __rawFromQuery: searchParams,
    };
    setDetail(baseFromQuery);

    (async () => {
      try {
        const res = await fetch('https://niuniuparts.com:6001/scm-product/v1/stock2?size=500&page=0', { cache: 'no-store' });
        const data = await res.json().catch(() => ({} as AnyObj));
        const list: any[] = data?.data?.list ?? data?.data?.records ?? data?.list ?? data?.records ?? data?.data ?? [];

        const found = findByNum(list, num);
        const merged = found ? { ...(baseFromQuery || {}), ...found } : baseFromQuery;
        setDetail(merged);

        // 候选图片
        const cand = new Set<string>();
        collectCandidateUrls(merged).forEach((u) => cand.add(u));
        extractUrlsFromText(JSON.stringify(merged)).forEach((u) => cand.add(u));
        if (searchParams) extractUrlsFromText(JSON.stringify(searchParams)).forEach((u) => cand.add(u));
        const all = Array.from(cand).filter(Boolean);

        setAllThumbs(all);
        setThumbs(all.slice(0, 12));
        if (all.length) setMainFromRaw(all[0]);

        // 上/下一条 + 预热
        const idx = found ? list.indexOf(found) : list.findIndex((it) => String(pick(it, ['num'], '')) === num);
        const prev = idx > 0 ? list[idx - 1] : null;
        const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
        setPrevHref(prev ? makeHref(prev) : null);
        setNextHref(next ? makeHref(next) : null);

        // 预热图
        const firstOf = (it: AnyObj | null) => {
          if (!it) return null;
          const s = new Set<string>();
          collectCandidateUrls(it).forEach((u) => s.add(u));
          return Array.from(s)[0] || null;
        };
        setPrevPrefetch(prefetchSmall(firstOf(prev)));
        setNextPrefetch(prefetchSmall(firstOf(next)));
      } finally {
        setLoading(false);
      }
    })();
  }, [num, searchParams]);

  // 缩略图滚动：每次追加12张，避免一次性绘制太多
  const onThumbsScroll: React.UIEventHandler<HTMLDivElement> = (e) => {
    const el = e.currentTarget;
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 12) {
      if (thumbs.length < allThumbs.length) setThumbs(allThumbs.slice(0, Math.min(allThumbs.length, thumbs.length + 12)));
    }
  };

  const view = useMemo(() => {
    const d = detail || {};
    return {
      title: pick(d, ['title'], '-'),
      brand: pick(d, ['brand'], '-'),
      model: pick(d, ['model'], '-'),
      year:  pick(d, ['year'],  '-'),
      oe:    pick(d, ['oe'],    '-'),
      num:   pick(d, ['num'],   num),
      price: pick(d, ['price'], '-'),
      stock: pick(d, ['stock'], '-'),
    };
  }, [detail, num]);

  /* ======== 放大交互（缩放/拖动） ======== */
  const onWheelZoom: React.WheelEventHandler<HTMLDivElement> = (e) => {
    if (!zoomOpen) return;
    e.preventDefault();
    const delta = -e.deltaY;
    const next = Math.min(4, Math.max(1, zoomScale + (delta > 0 ? 0.12 : -0.12)));
    setZoomScale(next);
  };
  const onMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!zoomOpen) return;
    drag.current = { x: e.clientX, y: e.clientY, tx: zoomTx, ty: zoomTy };
  };
  const onMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    setZoomTx(drag.current.tx + dx);
    setZoomTy(drag.current.ty + dy);
  };
  const onMouseUp = () => (drag.current = null);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* 顶部 */}
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">产品详情</h1>
        <a
          href="https://niuniuparts.com:6001/scm-product/v1/stock2/excel?size=20&page=0"
          target="_blank"
          rel="noreferrer"
          className="rounded bg-blue-600 hover:bg-blue-700 text-white px-4 py-2"
        >
          下载库存 Excel
        </a>
      </header>

      {/* 返回 + 上下条 */}
      <div className="mb-4 flex items-center gap-3">
        <Link href="/stock" className="inline-flex items-center gap-2 rounded border px-3 py-2 hover:bg-gray-50">← 返回列表</Link>
        <div className="ml-auto flex items-center gap-2">
          <Link href={prevHref || '#'} prefetch className={`inline-flex items-center rounded border px-3 py-2 ${prevHref ? 'hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`} aria-disabled={!prevHref}>上一条</Link>
          <Link href={nextHref || '#'} prefetch className={`inline-flex items-center rounded border px-3 py-2 ${nextHref ? 'hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`} aria-disabled={!nextHref}>下一条</Link>
        </div>
      </div>

      {/* 主体 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左：大图（裁切+遮罩，避免水印） */}
        <div className="w-full">
          <div
            className="relative w-full"
            style={{
              height: 360,
              borderRadius: 8,
              border: '1px solid #eee',
              background: '#fafafa',
              overflow: 'hidden',
            }}
          >
            {imgUrl ? (
              <img
                src={imgUrl}
                alt={String(view.num)}
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full"
                style={{
                  objectFit: 'contain',
                  // 关键：统一裁切顶部/底部，彻底不让底部字样进入画面
                  clipPath: `inset(${CROP_TOP_PCT}% 0% ${CROP_BOTTOM_PCT}% 0%)`,
                  objectPosition: 'center 48%',
                  cursor: 'zoom-in',
                }}
                onClick={() => currentRaw && openZoom(currentRaw)}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">无图</div>
            )}
            {/* 底部渐变遮罩（双保险） */}
            <div
              className="absolute left-0 right-0 bottom-0 pointer-events-none"
              style={{ height: MASK_BOTTOM_PX, background: 'linear-gradient(to bottom, rgba(250,250,250,0), rgba(250,250,250,1))' }}
            />
          </div>

          {/* 缩略图条（同样裁切） */}
          {thumbs.length > 0 && (
            <div className="mt-3 relative">
              <div
                ref={(el) => { if (el) (stripRef as any).current = el; }}
                onScroll={onThumbsScroll}
                className="flex gap-2 overflow-x-auto px-2 py-2"
                style={{ scrollBehavior: 'smooth' }}
              >
                {thumbs.map((raw, idx) => {
                  const tiny = toProxy(raw, 96, 72, 42);
                  if (!tiny) return null;
                  const active = currentRaw === raw;
                  return (
                    <button
                      key={idx}
                      onClick={() => setMainFromRaw(raw)}
                      className={`flex-shrink-0 border rounded ${active ? 'border-blue-600' : 'border-gray-200'} bg-white`}
                      style={{ width: 96, height: 72, overflow: 'hidden' }}
                      title={raw}
                    >
                      <img
                        src={tiny}
                        alt={`thumb-${idx}`}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        style={{
                          width: '100%', height: '100%', objectFit: 'contain',
                          clipPath: `inset(${CROP_TOP_PCT}% 0% ${CROP_BOTTOM_PCT}% 0%)`,
                          background: '#fafafa'
                        }}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="px-2 text-xs text-gray-500 mt-1">
                已载 {thumbs.length}/{allThumbs.length} 张（横向滚动自动加载更多）
              </div>
            </div>
          )}
        </div>

        {/* 右：信息区（已无“数据源”字样） */}
        <div className="w-full">
          <div className="rounded border p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-[15px] leading-7">
              <div><span className="font-semibold">标题：</span>{String(view.title)}</div>
              <div><span className="font-semibold">Num：</span>{String(view.num)}</div>
              <div><span className="font-semibold">OE：</span>{String(view.oe)}</div>
              <div><span className="font-semibold">Brand：</span>{String(view.brand)}</div>
              <div><span className="font-semibold">Model：</span>{String(view.model)}</div>
              <div><span className="font-semibold">Year：</span>{String(view.year)}</div>
              <div><span className="font-semibold">Price：</span>{String(view.price)}</div>
              <div><span className="font-semibold">Stock：</span>{String(view.stock)}</div>
            </div>
          </div>
        </div>
      </div>

      {loading && <div className="mt-6 text-gray-500 text-sm">加载中…</div>}

      {/* 底部 上/下一条（已预热 small 图） */}
      <div className="mt-8 flex items-center justify-end gap-2">
        <Link href={prevHref || '#'} prefetch className={`inline-flex items-center rounded border px-3 py-2 ${prevHref ? 'hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`} aria-disabled={!prevHref}>上一条</Link>
        <Link href={nextHref || '#'} prefetch className={`inline-flex items-center rounded border px-3 py-2 ${nextHref ? 'hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`} aria-disabled={!nextHref}>下一条</Link>
      </div>

      {/* 放大查看（同样裁切，彻底不露出底部字样） */}
      {zoomOpen && (
        <div
          onWheel={(e) => { e.preventDefault(); const d = -e.deltaY; setZoomScale((s) => Math.min(4, Math.max(1, s + (d > 0 ? 0.12 : -0.12)))); }}
          onMouseDown={(e) => (drag.current = { x: e.clientX, y: e.clientY, tx: zoomTx, ty: zoomTy })}
          onMouseMove={(e) => {
            if (!drag.current) return;
            const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
            setZoomTx(drag.current.tx + dx); setZoomTy(drag.current.ty + dy);
          }}
          onMouseUp={() => (drag.current = null)}
          onMouseLeave={() => (drag.current = null)}
          className="fixed inset-0 z-50 bg-black/80 cursor-grab"
          onClick={() => setZoomOpen(false)}
          role="dialog" aria-modal="true" title="点击任意处关闭"
        >
          <div className="absolute top-3 right-3 flex gap-2">
            <button onClick={(e) => { e.stopPropagation(); setZoomScale((s) => Math.min(4, s + 0.2)); }} className="px-3 py-1 rounded bg-white/90 hover:bg-white">放大</button>
            <button onClick={(e) => { e.stopPropagation(); setZoomScale((s) => Math.max(1, s - 0.2)); }} className="px-3 py-1 rounded bg-white/90 hover:bg-white">缩小</button>
            <button onClick={(e) => { e.stopPropagation(); setZoomScale(1); setZoomTx(0); setZoomTy(0); }} className="px-3 py-1 rounded bg-white/90 hover:bg-white">还原</button>
            <button onClick={(e) => { e.stopPropagation(); setZoomOpen(false); }} className="px-3 py-1 rounded bg-white/90 hover:bg-white">关闭</button>
          </div>
          <div className="absolute inset-0 flex items-center justify-center" onClick={(e) => e.stopPropagation()} style={{ overflow: 'hidden' }}>
            {zoomSrc && (
              <img
                src={zoomSrc}
                alt="zoom"
                referrerPolicy="no-referrer"
                draggable={false}
                style={{
                  maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain',
                  transform: `translate(${zoomTx}px, ${zoomTy}px) scale(${zoomScale})`,
                  transition: 'transform 80ms ease-out',
                  // 放大图同样做顶部/底部裁切，避免露字
                  clipPath: `inset(${CROP_TOP_PCT}% 0% ${CROP_BOTTOM_PCT}% 0%)`,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* 底部遮罩双保险 */}
            <div
              className="absolute left-0 right-0 bottom-0 pointer-events-none"
              style={{ height: MASK_BOTTOM_PX, background: 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.8))' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

