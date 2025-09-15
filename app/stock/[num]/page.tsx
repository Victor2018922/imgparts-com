'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type AnyObj = Record<string, any>;

/** 将相对/协议相对路径补成 http 绝对地址 */
function absolutize(url: string): string {
  if (!url) return url;
  let u = url.trim();
  if (u.startsWith('//')) return 'http:' + u;
  if (u.startsWith('/')) return 'http://niuniuparts.com' + u;
  return u;
}

/** 统一通过 HTTPS 图片代理输出（自动压缩，避免混合内容/防盗链） */
function toProxy(raw?: string | null, w = 800, h = 600): string | null {
  if (!raw) return null;
  let u = absolutize(raw);
  if (/^data:image\//i.test(u)) return u;
  // weserv 要求 host 不带协议，支持 http 源；自动 webp、q=75
  u = u.replace(/^https?:\/\//i, '');
  return `https://images.weserv.nl/?url=${encodeURIComponent(u)}&w=${w}&h=${h}&fit=contain&we=auto&q=75&il`;
}

/** 从任意字符串中尽可能提取 URL */
function extractUrlsFromText(text: string): string[] {
  const urls = new Set<string>();
  if (!text) return [];

  // 1) 常见图片后缀
  const reExt = /(https?:\/\/[^\s"'<>]+?\.(?:jpg|jpeg|png|gif|webp))(?:[?#][^\s"'<>]*)?/gi;
  let m: RegExpExecArray | null;
  while ((m = reExt.exec(text))) urls.add(m[1]);

  // 2) <img src="...">
  const reImg = /<img\b[^>]*src=['"]?([^'">\s]+)['"]?/gi;
  while ((m = reImg.exec(text))) urls.add(m[1]);

  // 3) 相对路径（/upload|/uploads|/images|/img|/files）
  const reRel = /(\/(?:upload|uploads|images|img|files)\/[^\s"'<>]+?\.(?:jpg|jpeg|png|gif|webp))(?:[?#][^\s"'<>]*)?/gi;
  while ((m = reRel.exec(text))) urls.add('http://niuniuparts.com' + m[1]);

  // 4) 兜底所有 http(s)
  const reAny = /(https?:\/\/[^\s"'<>]+)/gi;
  while ((m = reAny.exec(text))) urls.add(m[1]);

  return Array.from(urls);
}

/** 深度遍历对象，搜集所有可能的图片字段 */
function collectCandidateUrls(obj: any, max = 3000): string[] {
  const ret = new Set<string>();
  const seen = new Set<any>();
  const stack: any[] = [obj];

  // 图片相关的 key 词
  const imgKeys = [
    'image', 'imageurl', 'image_url', 'imagePath', 'imageList', 'images', 'pics', 'pictures', 'photos',
    'thumbnail', 'thumb', 'thumburl', 'cover', 'logo', 'banner', 'mainpic', 'main_pic', 'img', 'imgurl',
    '图片', '图片1', '图片2', '封面', '主图', '相片'
  ];

  while (stack.length && ret.size < max) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
    seen.add(cur);

    for (const k of Object.keys(cur)) {
      const v = (cur as AnyObj)[k];

      // 命中图片相关 key
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
              // 对象里常见 url 字段
              ['url', 'src', 'path'].forEach((kk) => {
                if (typeof x[kk] === 'string') {
                  ret.add(x[kk]);
                  extractUrlsFromText(x[kk]).forEach((u) => ret.add(u));
                }
              });
            }
          });
        } else if (v && typeof v === 'object') {
          ['url', 'src', 'path'].forEach((kk) => {
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

/** 简单取值（兼容中英文 key） */
function pick(obj: AnyObj | null | undefined, keys: string[], fallback: any = '-') {
  if (!obj) return fallback;
  const alias: Record<string, string[]> = {
    title: ['标题', '名称', '品名', 'title', 'product', 'name'],
    brand: ['品牌', 'brand'],
    model: ['车型', 'model'],
    year: ['年份', '年款', 'year'],
    oe: ['OE', 'oe', '配件号', '编号'],
    num: ['num', '编码', '编号', '货号'],
    price: ['价格', '单价', '售价', 'price'],
    stock: ['库存', '库存数量', '数量', '在库', 'stock'],
  };
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    const group = alias[k];
    if (group) {
      for (const a of group) {
        if (obj[a] !== undefined && obj[a] !== null && obj[a] !== '') return obj[a];
      }
    }
  }
  return fallback;
}

/** 在列表中按 num 尽量找到一条记录 */
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

/** 并发探测，哪个能加载就用哪个；同时返回全部候选（用于页面内可视化） */
async function probeFirstWorkingImage(rawUrls: string[], timeoutMs = 5000) {
  const urls = Array.from(new Set(rawUrls.filter(Boolean).map(absolutize)));
  const candidates = urls.slice(0, 40);
  if (!candidates.length) return { ok: null as string | null, all: candidates };

  const ok = await new Promise<string | null>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);

    candidates.forEach((u) => {
      const img = new Image();
      img.src = toProxy(u, 40, 40)!; // 用代理小图探测
      img.onload = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(u);
        }
      };
      img.onerror = () => {};
    });
  });

  return { ok, all: candidates };
}

export default function StockDetailPage({
  params,
  searchParams,
}: {
  params: { num: string };
  searchParams?: AnyObj;
}) {
  const num = decodeURI(params.num || '').trim();
  const [detail, setDetail] = useState<AnyObj | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [allCandidates, setAllCandidates] = useState<string[]>([]);
  const [showCandidates, setShowCandidates] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const baseFromQuery: AnyObj = {
      num,
      title: searchParams?.title ?? searchParams?.product ?? searchParams?.name,
      oe: searchParams?.oe,
      brand: searchParams?.brand,
      model: searchParams?.model,
      year: searchParams?.year,
      price: searchParams?.price,
      stock: searchParams?.stock,
      __rawFromQuery: searchParams,
    };
    setDetail(baseFromQuery);

    (async () => {
      try {
        // 拉列表（500 条），在前端匹配到当前 num 的完整对象
        const res = await fetch('https://niuniuparts.com:6001/scm-product/v1/stock2?size=500&page=0', { cache: 'no-store' });
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

        // 收集候选
        const candidates = new Set<string>();

        // 1) 深度遍历所有字段
        collectCandidateUrls(merged).forEach((u) => candidates.add(u));

        // 2) 原始 JSON 字符串再扫一遍
        extractUrlsFromText(JSON.stringify(merged)).forEach((u) => candidates.add(u));

        // 3) query 里可能带来的图片
        if (searchParams) extractUrlsFromText(JSON.stringify(searchParams)).forEach((u) => candidates.add(u));

        // 4) 再做几组“大胆猜测”（按 num / oe 拼常见目录）
        const guessBases = ['/upload/', '/uploads/', '/images/', '/img/', '/files/'];
        const exts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        const oe = String(pick(merged, ['oe'], '') || '');
        [num, oe].forEach((seed) => {
          if (!seed) return;
          for (const b of guessBases) for (const e of exts) candidates.add(`http://niuniuparts.com${b}${seed}${e}`);
        });

        const arr = Array.from(candidates);
        setAllCandidates(arr);

        // 并发探测
        const { ok } = await probeFirstWorkingImage(arr);
        setImgUrl(ok ? toProxy(ok) : null);
      } catch {
        // ignore
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
      year: pick(d, ['year'], '-'),
      oe: pick(d, ['oe'], '-'),
      num: pick(d, ['num'], num),
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

        {/* 看不到图时，展开候选缩略图（不需要你打开控制台） */}
        <button
          onClick={() => setShowCandidates((s) => !s)}
          className="rounded border px-3 py-2 hover:bg-gray-50 text-sm"
          title="当主图无法显示时，点击可查看系统自动搜到的候选图片，如有任意缩略图出现，系统会自动使用它作为主图。"
        >
          {showCandidates ? '收起图片候选' : '显示图片候选'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：主图 */}
        <div className="w-full">
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

          {/* 候选缩略图（仅视觉辅助，不懂代码也能看） */}
          {showCandidates && allCandidates.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-sm text-gray-500">
                系统自动找到 {allCandidates.length} 个候选图片地址（仅显示前 24 个缩略图）：
              </div>
              <div className="grid grid-cols-6 gap-2">
                {allCandidates.slice(0, 24).map((u, idx) => (
                  <a
                    key={idx}
                    href={toProxy(u, 120, 120) || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="block border border-gray-200 rounded overflow-hidden"
                    title={u}
                  >
                    <img
                      src={toProxy(u, 120, 120) || ''}
                      alt={`cand-${idx}`}
                      referrerPolicy="no-referrer"
                      style={{ width: '100%', height: 80, objectFit: 'contain', background: '#fafafa' }}
                      onLoad={() => {
                        // 一旦有候选能加载出来，就把它设为主图
                        if (!imgUrl) setImgUrl(toProxy(u, 800, 600));
                      }}
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右侧：文本信息 */}
        <div className="w-full">
          <div className="rounded border p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-[15px] leading-7">
              <div>
                <span className="font-semibold">标题：</span>
                <span>{String(view.title)}</span>
              </div>
              <div>
                <span className="font-semibold">Num：</span>
                <span>{String(view.num)}</span>
              </div>
              <div>
                <span className="font-semibold">OE：</span>
                <span>{String(view.oe)}</span>
              </div>
              <div>
                <span className="font-semibold">Brand：</span>
                <span>{String(view.brand)}</span>
              </div>
              <div>
                <span className="font-semibold">Model：</span>
                <span>{String(view.model)}</span>
              </div>
              <div>
                <span className="font-semibold">Year：</span>
                <span>{String(view.year)}</span>
              </div>
              <div>
                <span className="font-semibold">Price：</span>
                <span>{String(view.price)}</span>
              </div>
              <div>
                <span className="font-semibold">Stock：</span>
                <span>{String(view.stock)}</span>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-500 mt-6 space-y-1">
            <div>数据源：niuniuparts.com（测试预览用途）</div>
            <div>数据源：niuniuparts.com（测试预览用途）</div>
          </div>
        </div>
      </div>

      {loading && <div className="mt-6 text-gray-500 text-sm">加载中…（首次加载会稍慢）</div>}
    </div>
  );
}
