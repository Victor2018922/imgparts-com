'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

type AnyObj = Record<string, any>;

/* ========== 工具：URL 处理与图片代理（支持自定义尺寸与质量） ========== */
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
  if (/^data:image\//i.test(u)) return u;        // 内联图直出
  u = u.replace(/^https?:\/\//i, '');            // weserv 需要无协议 host
  // fit=contain 保比例，we=auto 输出 webp，il 渐进
  return `https://images.weserv.nl/?url=${encodeURIComponent(u)}&w=${w}&h=${h}&fit=contain&we=auto&q=${q}&il`;
}

/* ========== 工具：从文本提取 URL（含相对路径、<img src>） ========== */
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

/* ========== 工具：深度收集候选图片 URL ========== */
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

      // 图片相关 key 优先
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
                if (typeof x[kk] === 'string') {
                  ret.add(x[kk]);
                  extractUrlsFromText(x[kk]).forEach((u) => ret.add(u));
                }
              });
            }
          });
        } else if (v && typeof v === 'object') {
          ['url','src','path'].forEach((kk) => {
            if (typeof v[kk] === 'string') {
              ret.add(v[kk]);
              extractUrlsFromText(v[kk]).forEach((u) => ret.add(u));
            }
          });
        }
      }

      // 任意字符串里也扫
      if (typeof v === 'string') extractUrlsFromText(v).forEach((u) => ret.add(u));
      // 继续深入
      if (Array.isArray(v) || (v && typeof v === 'object')) stack.push(v);
    }
  }
  return Array.from(ret);
}

/* ========== 工具：取值（兼容中英文 key） ========== */
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

/* ========== 工具：在列表中按 num 匹配记录 ========== */
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

/* ========== 页面组件 ========== */
export default function StockDetailPage({
  params,
  searchParams,
}: {
  params: { num: string };
  searchParams?: AnyObj;
}) {
  const num = decodeURI(params.num || '').trim();
  const [detail, setDetail] = useState<AnyObj | null>(null);

  // 缩略图 / 大图（渐进切换）
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [currentRaw, setCurrentRaw] = useState<string | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  // 上一条 / 下一条
  const [allList, setAllList] = useState<any[]>([]);
  const [prevHref, setPrevHref] = useState<string | null>(null);
  const [nextHref, setNextHref] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const stripRef = useRef<HTMLDivElement>(null);

  // 统一的“渐进切换”函数：先小图立即显示，再预载大图，完成后自动升级
  const setMainFromRaw = (raw: string) => {
    setCurrentRaw(raw);
    const small = toProxy(raw, 600, 450, 60);   // 小图，快速
    const big   = toProxy(raw, 1000, 750, 80);  // 大图，清晰
    setImgUrl(small || null);                   // 先秒出小图
    if (big) {
      const pre = new Image();
      pre.src = big;
      pre.onload = () => setImgUrl(big);        // 大图加载好后自动替换
    }
  };

  // 构建详情页跳转链接，带上常用字段兜底
  const makeHref = (item: AnyObj) => {
    const n   = String(pick(item, ['num'], ''));
    const t   = String(pick(item, ['title'], '-'));
    const oe  = String(pick(item, ['oe'], ''));
    const br  = String(pick(item, ['brand'], '-'));
    const md  = String(pick(item, ['model'], '-'));
    const pr  = String(pick(item, ['price'], '-'));
    const st  = String(pick(item, ['stock'], '-'));
    const q = new URLSearchParams({
      title: t, oe: oe, brand: br, model: md, price: pr, stock: st,
    }).toString();
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
        // 拉取一页 500 条（当前数据量），用于：1) 找当前详情；2) 生成 上/下一条
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

        setAllList(list);

        // 1) 找到当前记录（并合并 query 里的兜底字段）
        const found = findByNum(list, num);
        const merged = found ? { ...(baseFromQuery || {}), ...found } : baseFromQuery;
        setDetail(merged);

        // 2) 生成缩略图候选 & 初始大图
        const candidates = new Set<string>();
        collectCandidateUrls(merged).forEach((u) => candidates.add(u));
        extractUrlsFromText(JSON.stringify(merged)).forEach((u) => candidates.add(u));
        if (searchParams)
          extractUrlsFromText(JSON.stringify(searchParams)).forEach((u) => candidates.add(u));

        const all = Array.from(candidates).filter(Boolean);
        setThumbs(all);
        if (all.length) setMainFromRaw(all[0]);

        // 3) 计算上/下一条
        let idx = -1;
        if (found) {
          idx = list.indexOf(found);
        }
        if (idx < 0) {
          // 兜底：按 num 再找一次索引
          idx = list.findIndex((it) => String(pick(it, ['num'], '')) === num);
        }
        const prev = idx > 0 ? list[idx - 1] : null;
        const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;

        setPrevHref(prev ? makeHref(prev) : null);
        setNextHref(next ? makeHref(next) : null);
      } finally {
        setLoading(false);
      }
    })();
  }, [num, searchParams]);

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

  const scrollLeft = () => stripRef.current?.scrollBy({ left: -600, behavior: 'smooth' });
  const scrollRight = () => stripRef.current?.scrollBy({ left:  600, behavior: 'smooth' });

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

        {/* 上一条 / 下一条 */}
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={prevHref || '#'}
            className={`inline-flex items-center rounded border px-3 py-2 ${prevHref ? 'hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
            aria-disabled={!prevHref}
          >
            上一条
          </Link>
          <Link
            href={nextHref || '#'}
            className={`inline-flex items-center rounded border px-3 py-2 ${nextHref ? 'hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
            aria-disabled={!nextHref}
          >
            下一条
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：大图 + 缩略图条（渐进切换） */}
        <div className="w-full">
          {/* 大图 */}
          {imgUrl ? (
            <img
              src={imgUrl}
              alt={String(view.num)}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="w-full"
              style={{
                height: 360,
                objectFit: 'contain',
                background: '#fafafa',
                border: '1px solid #eee',
                borderRadius: 8,
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

          {/* 缩略图条（水平滚动，视口约 12 张） */}
          {thumbs.length > 0 && (
            <div className="mt-3 relative">
              {/* 左右按钮 */}
              <button
                onClick={scrollLeft}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 hover:bg-white border rounded-full w-8 h-8 flex items-center justify-center"
                aria-label="向左滚动"
                title="向左滚动"
              >
                ‹
              </button>
              <button
                onClick={scrollRight}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 hover:bg-white border rounded-full w-8 h-8 flex items-center justify-center"
                aria-label="向右滚动"
                title="向右滚动"
              >
                ›
              </button>

              <div
                ref={stripRef}
                className="flex gap-2 overflow-x-auto px-10 py-2"
                style={{ scrollBehavior: 'smooth' }}
              >
                {thumbs.map((raw, idx) => {
                  const proxy = toProxy(raw, 120, 120, 70);
                  if (!proxy) return null;
                  const active = currentRaw === raw; // 以原始URL判断“选中”状态
                  return (
                    <button
                      key={idx}
                      onClick={() => setMainFromRaw(raw)}
                      className={`flex-shrink-0 border rounded ${active ? 'border-blue-600' : 'border-gray-200'} bg-white`}
                      style={{ width: 96, height: 80 }}
                      title={raw}
                    >
                      <img
                        src={proxy}
                        alt={`thumb-${idx}`}
                        referrerPolicy="no-referrer"
                        style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fafafa' }}
                        onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="px-10 text-xs text-gray-500 mt-1">候选图片：{thumbs.length} 张（横向滚动查看更多）</div>
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

      {/* 底部再放一组 上/下一条，方便阅读到末尾时继续浏览 */}
      <div className="mt-8 flex items-center justify-end gap-2">
        <Link
          href={prevHref || '#'}
          className={`inline-flex items-center rounded border px-3 py-2 ${prevHref ? 'hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
          aria-disabled={!prevHref}
        >
          上一条
        </Link>
        <Link
          href={nextHref || '#'}
          className={`inline-flex items-center rounded border px-3 py-2 ${nextHref ? 'hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
          aria-disabled={!nextHref}
        >
          下一条
        </Link>
      </div>
    </div>
  );
}

