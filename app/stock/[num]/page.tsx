'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

type AnyObj = Record<string, any>;

/* ================== 连接与图片工具 ================== */
function appendPreconnectOnce() {
  // 预连接，减少首包与TLS握手延迟
  if (typeof document === 'undefined') return;
  const marks = ['__pc_weserv__', '__pc_niuniu__'];
  if ((window as any)[marks[0]] && (window as any)[marks[1]]) return;
  const cfg: Array<{ rel: string; href: string }> = [
    { rel: 'preconnect', href: 'https://images.weserv.nl' },
    { rel: 'dns-prefetch', href: '//images.weserv.nl' },
    { rel: 'preconnect', href: 'https://niuniuparts.com' },
    { rel: 'dns-prefetch', href: '//niuniuparts.com' },
  ];
  for (const { rel, href } of cfg) {
    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    document.head.appendChild(link);
  }
  (window as any)[marks[0]] = true;
  (window as any)[marks[1]] = true;
}

function absolutize(url: string): string {
  if (!url) return url;
  let u = url.trim();
  if (u.startsWith('//')) return 'http:' + u;
  if (u.startsWith('/')) return 'http://niuniuparts.com' + u;
  return u;
}

/** 通过 HTTPS 代理输出；可调尺寸与质量（更小=更快） */
function toProxy(raw?: string | null, w = 800, h = 600, q = 75): string | null {
  if (!raw) return null;
  let u = absolutize(raw);
  if (/^data:image\//i.test(u)) return u;        // 内联图直出
  u = u.replace(/^https?:\/\//i, '');            // weserv 需要无协议 host
  // fit=contain 保比例，we=auto 输出 webp，il 渐进
  return `https://images.weserv.nl/?url=${encodeURIComponent(u)}&w=${w}&h=${h}&fit=contain&we=auto&q=${q}&il`;
}

/* ================== 候选图片收集 ================== */
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
    'cover','logo','banner','mainpic','main_pic','img','imgurl',
    '图片','主图'
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

/* ================== 数据取值与定位 ================== */
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

/* ================== 页面组件 ================== */
export default function StockDetailPage({
  params,
  searchParams,
}: {
  params: { num: string };
  searchParams?: AnyObj;
}) {
  const num = decodeURI(params.num || '').trim();
  const [detail, setDetail] = useState<AnyObj | null>(null);

  // 图片与缩略图
  const [allThumbs, setAllThumbs] = useState<string[]>([]);
  const [thumbs, setThumbs] = useState<string[]>([]); // 仅渲染前 N 张，减少首屏压力
  const [currentRaw, setCurrentRaw] = useState<string | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  // 上一条 / 下一条
  const [prevHref, setPrevHref] = useState<string | null>(null);
  const [nextHref, setNextHref] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const stripRef = useRef<HTMLDivElement>(null);

  // 预连接图片域名（首屏就做）
  useEffect(() => {
    appendPreconnectOnce();
  }, []);

  // 渐进切换：先极小清晰度快速显示，再升级清晰图
  const setMainFromRaw = (raw: string) => {
    setCurrentRaw(raw);
    const tiny  = toProxy(raw, 320, 240, 45);  // 很小很快
    const small = toProxy(raw, 540, 405, 58);  // 小图：更快出画
    const big   = toProxy(raw, 960, 720, 76);  // 大图：清晰
    setImgUrl(tiny || small || big || null);   // 先秒出 tiny
    // 先预载 small，完成后再预载 big
    if (small) {
      const preS = new Image();
      preS.src = small;
      preS.onload = () => {
        setImgUrl(small);
        if (big) {
          const preB = new Image();
          preB.src = big;
          preB.onload = () => setImgUrl(big);
        }
      };
    }
  };

  // 构建详情页跳转链接
  const makeHref = (item: AnyObj) => {
    const n   = String(pick(item, ['num'], ''));
    const t   = String(pick(item, ['title'], '-'));
    const oe  = String(pick(item, ['oe'], ''));
    const br  = String(pick(item, ['brand'], '-'));
    const md  = String(pick(item, ['model'], '-'));
    const pr  = String(pick(item, ['price'], '-'));
    const st  = String(pick(item, ['stock'], '-'));
    const q = new URLSearchParams({ title: t, oe, brand: br, model: md, price: pr, stock: st }).toString();
    return `/stock/${encodeURIComponent(n)}?${q}`;
  };

  useEffect(() => {
    const baseFromQuery: AnyObj = {
      num,
      title: searchParams?.title ?? searchParams?.product ?? searchParams?.name,
      oe:    searchParams?.oe,
      brand: searchParams?.brand,
      model: searchParams?.model,
      year:  searchParams?.year,
      price: searchParams?.price,
      stock: searchParams?.stock,
      __rawFromQuery: searchParams,
    };
    setDetail(baseFromQuery);

    (async () => {
      try {
        const res = await fetch(
          'https://niuniuparts.com:6001/scm-product/v1/stock2?size=500&page=0',
          { cache: 'no-store' }
        );
        const data = await res.json().catch(() => ({} as AnyObj));
        const list: any[] =
          data?.data?.list ??
          data?.data?.records ??
          data?.list ??
          data?.records ??
          data?.data ??
          [];

        const found = findByNum(list, num);
        const merged = found ? { ...(baseFromQuery || {}), ...found } : baseFromQuery;
        setDetail(merged);

        // 候选图片（全部）
        const candidates = new Set<string>();
        collectCandidateUrls(merged).forEach((u) => candidates.add(u));
        extractUrlsFromText(JSON.stringify(merged)).forEach((u) => candidates.add(u));
        if (searchParams)
          extractUrlsFromText(JSON.stringify(searchParams)).forEach((u) => candidates.add(u));

        const all = Array.from(candidates).filter(Boolean);
        setAllThumbs(all);

        // 首屏仅渲染 12 张缩略图（其余仍可按需加载）
        setThumbs(all.slice(0, 12));

        // 初始主图（三级渐进：tiny -> small -> big）
        if (all.length) setMainFromRaw(all[0]);

        // 计算上下条
        const idx = found
          ? list.indexOf(found)
          : list.findIndex((it) => String(pick(it, ['num'], '')) === num);
        const prev = idx > 0 ? list[idx - 1] : null;
        const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
        setPrevHref(prev ? makeHref(prev) : null);
        setNextHref(next ? makeHref(next) : null);
      } finally {
        setLoading(false);
      }
    })();
  }, [num, searchParams]);

  // 当用户滚动到缩略图条尾部时，按批次追加更多（避免一次性渲染过多导致慢）
  const onThumbsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 20) {
      // 追加下一批（每次 +12）
      if (thumbs.length < allThumbs.length) {
        setThumbs(allThumbs.slice(0, Math.min(allThumbs.length, thumbs.length + 12)));
      }
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
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

      <div className="mb-4 flex items-center gap-3">
        <Link href="/stock" className="inline-flex items-center gap-2 rounded border px-3 py-2 hover:bg-gray-50">
          ← 返回列表
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href={prevHref || '#'}
            prefetch
            className={`inline-flex items-center rounded border px-3 py-2 ${prevHref ? 'hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
            aria-disabled={!prevHref}
          >
            上一条
          </Link>
          <Link
            href={nextHref || '#'}
            prefetch
            className={`inline-flex items-center rounded border px-3 py-2 ${nextHref ? 'hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
            aria-disabled={!nextHref}
          >
            下一条
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：大图（渐进升级，优先级高） */}
        <div className="w-full">
          {imgUrl ? (
            <img
              src={imgUrl}
              alt={String(view.num)}
              loading="eager"
              fetchpriority="high"
              decoding="async"
              referrerPolicy="no-referrer"
              className="w-full"
              style={{
                height: 360,
                objectFit: 'contain',
                background: '#fafafa',
                border: '1px solid #eee',
                borderRadius: 8,
                transition: 'filter 200ms ease',
              }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                const holder = document.createElement('div');
                holder.innerText = '无图';
                holder.style.cssText =
                  'width:100%;height:360px;display:flex;align-items:center;justify-content:center;background:#fafafa;border:1px solid #eee;border-radius:8px;color:#999;';
                e.currentTarget.parentElement?.appendChild(holder);
              }}
            />
          ) : (
            <div
              className="flex items-center justify-center text-gray-400"
              style={{
                width: '100%',
                height: 360,
                background: '#fafafa',
                border: '1px solid #eee',
                borderRadius: 8,
              }}
            >
              无图
            </div>
          )}

          {/* 缩略图条（首屏仅 12 张，滚动追加；更轻质量加速） */}
          {thumbs.length > 0 && (
            <div className="mt-3 relative">
              <div
                ref={/* scroll 容器 */ (el) => {
                  // 兼容 SSR
                }}
              />
              <div
                ref={(el) => {
                  // 保留 ref 给滚动控制
                  if (el) (stripRef as any).current = el;
                }}
                onScroll={onThumbsScroll}
                className="flex gap-2 overflow-x-auto px-2 py-2"
                style={{ scrollBehavior: 'smooth' }}
              >
                {thumbs.map((raw, idx) => {
                  const tiny = toProxy(raw, 96, 72, 45);   // 更小更快
                  if (!tiny) return null;
                  const active = currentRaw === raw;
                  return (
                    <button
                      key={idx}
                      onClick={() => setMainFromRaw(raw)}
                      className={`flex-shrink-0 border rounded ${active ? 'border-blue-600' : 'border-gray-200'} bg-white`}
                      style={{ width: 96, height: 72 }}
                      title={raw}
                    >
                      <img
                        src={tiny}
                        alt={`thumb-${idx}`}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fafafa' }}
                        onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')}
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

        {/* 右侧：文本信息 */}
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

          <div className="text-sm text-gray-500 mt-6 space-y-1">
            <div>数据源：niuniuparts.com（测试预览用途）</div>
            <div>数据源：niuniuparts.com（测试预览用途）</div>
          </div>
        </div>
      </div>

      {loading && <div className="mt-6 text-gray-500 text-sm">加载中…（首次加载会稍慢）</div>}

      <div className="mt-8 flex items-center justify-end gap-2">
        <Link
          href={prevHref || '#'}
          prefetch
          className={`inline-flex items-center rounded border px-3 py-2 ${prevHref ? 'hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
          aria-disabled={!prevHref}
        >
          上一条
        </Link>
        <Link
          href={nextHref || '#'}
          prefetch
          className={`inline-flex items-center rounded border px-3 py-2 ${nextHref ? 'hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
          aria-disabled={!nextHref}
        >
          下一条
        </Link>
      </div>
    </div>
  );
}

