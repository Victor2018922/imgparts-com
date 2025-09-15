'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type AnyObj = Record<string, any>;

/* ========== 工具：把相对路径补全为绝对 http ========== */
function absolutize(url: string): string {
  if (!url) return url;
  let u = url.trim();
  if (u.startsWith('//')) return 'http:' + u;
  if (u.startsWith('/')) return 'http://niuniuparts.com' + u;
  return u;
}

/* ========== 工具：把任意图片地址走 HTTPS 代理并压缩 ========== */
function toHttpsImageProxy(raw?: string | null): string | null {
  if (!raw) return null;
  let u = absolutize(raw);
  if (/^data:image\//i.test(u)) return u;
  u = u.replace(/^https?:\/\//i, '');
  // 800x600, 等比 contain, 自动 webp, q=75, 渐进
  return `https://images.weserv.nl/?url=${encodeURIComponent(u)}&w=800&h=600&fit=contain&we=auto&q=75&il`;
}

/* ========== 工具：从任意字符串中尽可能提取 URL ========== */
function extractUrlsFromText(text: string): string[] {
  const urls = new Set<string>();

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

  // 4) 兜底：所有 http(s) 字符串，后续再探测是否真图
  const reAnyHttp = /(https?:\/\/[^\s"'<>]+)/gi;
  while ((m = reAnyHttp.exec(text))) urls.add(m[1]);

  return Array.from(urls);
}

/* ========== 工具：深度遍历对象，收集可能的图片候选 URL ========== */
function collectCandidateUrls(obj: any, max = 2000): string[] {
  const ret = new Set<string>();
  const seen = new Set<any>();
  const stack: any[] = [obj];
  while (stack.length && ret.size < max) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
    seen.add(cur);
    for (const k of Object.keys(cur)) {
      const v = (cur as AnyObj)[k];
      if (v == null) continue;
      if (typeof v === 'string') {
        extractUrlsFromText(v).forEach((u) => ret.add(u));
      } else if (Array.isArray(v) || typeof v === 'object') {
        stack.push(v);
      }
      // 字段名命中 img/pic/photo/image 也尝试放进去
      if (/(img|pic|photo|image)/i.test(k) && typeof v === 'string') {
        ret.add(v);
      }
    }
  }
  return Array.from(ret);
}

/* ========== 工具：并发“探测”候选 URL，哪个能 load 我们就用哪个 ========== */
function probeFirstWorkingImage(rawUrls: string[], timeoutMs = 5000): Promise<string | null> {
  const urls = Array.from(new Set(rawUrls.filter(Boolean).map(absolutize)));
  if (!urls.length) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);

    urls.slice(0, 30).forEach((u) => {
      const test = new Image();
      // 这里用代理地址进行探测，避免 http 混合内容与 Referer 限制
      test.src = toHttpsImageProxy(u)!;
      test.onload = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(u);
        }
      };
      test.onerror = () => {
        // 忽略错误，等待其它候选
      };
    });
  });
}

/* ========== 工具：从对象里取值（兼顾中英文 key） ========== */
function pick(obj: AnyObj | null | undefined, keys: string[], fallback: any = '-') {
  if (!obj) return fallback;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    const lo = k.toLowerCase();
    if (obj[lo] !== undefined && obj[lo] !== null && obj[lo] !== '') return obj[lo];
    const up = k.toUpperCase();
    if (obj[up] !== undefined && obj[up] !== null && obj[up] !== '') return obj[up];
  }
  const alias: Record<string, string[]> = {
    title: ['标题', '名称', '品名'],
    brand: ['品牌', '品牌名'],
    model: ['车型', '车型名称', '车型名'],
    year: ['年份', '年款'],
    oe: ['OE', 'OE号', 'OE码', '配件号'],
    num: ['num', '编码', '编号', '货号'],
    price: ['价格', '单价', '售价'],
    stock: ['库存', '库存数量', '数量', '在库'],
  };
  for (const k of keys) {
    const arr = alias[k];
    if (arr) {
      for (const a of arr) {
        if (obj[a] !== undefined && obj[a] !== null && obj[a] !== '') return obj[a];
      }
    }
  }
  return fallback;
}

/* ========== 在列表中找到与 num 匹配的记录 ========== */
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
  const [imgUrl, setImgUrl] = useState<string | null>(null);
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
        const url = 'https://niuniuparts.com:6001/scm-product/v1/stock2?size=500&page=0';
        const res = await fetch(url, { cache: 'no-store' });
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

        // —— 图片候选收集 —— //
        const candidates = new Set<string>();

        // 1) 从 merged 的所有字段递归收集
        collectCandidateUrls(merged).forEach((u) => candidates.add(u));

        // 2) 从 JSON 文本里再扫一遍
        const fullText = JSON.stringify(merged);
        extractUrlsFromText(fullText).forEach((u) => candidates.add(u));

        // 3) 从 query 里收集
        if (searchParams) {
          const qsText = JSON.stringify(searchParams);
          extractUrlsFromText(qsText).forEach((u) => candidates.add(u));
        }

        // 4) 最后“大胆猜测”一波常见相对目录（防止后端只给了相对路径或没扩展名）
        const guessBases = ['/upload/', '/uploads/', '/images/', '/img/', '/files/'];
        const exts = ['.jpg', '.jpeg', '.png', '.webp'];
        const oe = String(pick(merged, ['oe'], '') || '');
        const guesses: string[] = [];
        [num, oe].forEach((seed) => {
          if (!seed) return;
          for (const b of guessBases) for (const e of exts) guesses.push(`http://niuniuparts.com${b}${seed}${e}`);
        });
        guesses.forEach((u) => candidates.add(u));

        // —— 并发探测，谁能加载就用谁 —— //
        const rawOk = await probeFirstWorkingImage(Array.from(candidates));
        setImgUrl(rawOk ? toHttpsImageProxy(rawOk) : null);
      } catch (e) {
        // 忽略错误，页面仍可显示文字信息
      } finally {
        setLoading(false);
      }
    })();
  }, [num, searchParams]);

  const view = useMemo(() => {
    const d = detail || {};
    return {
      title: pick(d, ['title', 'product', 'name'], '-'),
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

      <div className="mb-4">
        <Link href="/stock" className="inline-flex items-center gap-2 rounded border px-3 py-2 hover:bg-gray-50">
          ← 返回列表
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧图片 */}
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
        </div>

        {/* 右侧信息 */}
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
