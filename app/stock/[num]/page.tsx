'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type AnyObj = Record<string, any>;

/** 在任意对象里搜第一个图片 URL（支持 http/https/相对路径/HTML 片段） */
function extractFirstImageUrlFromAny(input: any): string | null {
  try {
    const text = typeof input === 'string' ? input : JSON.stringify(input ?? {});

    // 1) 直接的 http/https 图片
    const m1 = text.match(/https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|gif|webp)/i);
    if (m1?.[0]) return m1[0];

    // 2) 相对路径的图片（常见目录：/upload /uploads /images /img /files）
    const m2 = text.match(/\/(?:upload|uploads|images|img|files)\/[^\s"']+\.(?:jpg|jpeg|png|gif|webp)/i);
    if (m2?.[0]) return 'http://niuniuparts.com' + m2[0];

    // 3) <img src="..."> 片段
    const m3 = text.match(/<img\b[^>]*src=['"]?([^'">\s]+)['"]?/i);
    if (m3?.[1]) {
      const src = m3[1];
      if (/^https?:\/\//i.test(src)) return src;
      if (src.startsWith('//')) return 'http:' + src;
      if (src.startsWith('/')) return 'http://niuniuparts.com' + src;
      return src;
    }

    // 4) data:image
    const m4 = text.match(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/);
    if (m4?.[0]) return m4[0];
  } catch {}
  return null;
}

/** 把任意图片地址经由 HTTPS 代理输出，并做轻量压缩（加速与防混合内容） */
function toHttpsImageProxy(raw?: string | null): string | null {
  if (!raw) return null;
  let u = raw.trim();
  if (!u) return null;

  // 兼容 //xx 和 /xx
  if (u.startsWith('//')) u = 'http:' + u;
  if (u.startsWith('/')) u = 'http://niuniuparts.com' + u;

  // data:image 直出
  if (/^data:image\//i.test(u)) return u;

  // 去掉协议给 weserv 代理
  u = u.replace(/^https?:\/\//i, '');
  // w/h 控制尺寸，fit=contain 保比例，we=auto 输出 webp，q=75 质量，il 渐进
  return `https://images.weserv.nl/?url=${encodeURIComponent(u)}&w=800&h=600&fit=contain&we=auto&q=75&il`;
}

/** 从对象中取值：优先英文 key，其次常见中文 key */
function pick(obj: AnyObj | null | undefined, keys: string[], fallback: any = '-') {
  if (!obj) return fallback;
  for (const k of keys) {
    const candidates = [k, k.toLowerCase(), k.toUpperCase()];
    for (const c of candidates) {
      if (obj[c] !== undefined && obj[c] !== null && obj[c] !== '') return obj[c];
    }
  }
  // 常见中文别名
  const aliasMap: Record<string, string[]> = {
    title: ['标题', '名称', '品名'],
    brand: ['品牌', '品牌名'],
    model: ['车型', '车型名称', '车型名'],
    year: ['年份', '年款'],
    oe: ['OE', 'OE号', 'OE码', '配件号'],
    num: ['num', '编码', '编号', '货号'],
    price: ['价格', '单价', '售价'],
    stock: ['库存', '数量', '库存数量', '在库'],
    image: ['图片', '主图', '图片地址', '图', 'img', 'image'],
  };
  for (const k of keys) {
    const aliases = aliasMap[k];
    if (aliases) {
      for (const a of aliases) {
        if (obj[a] !== undefined && obj[a] !== null && obj[a] !== '') return obj[a];
      }
    }
  }
  return fallback;
}

/** 深度查找：找到包含 num 的那条记录 */
function findByNum(list: any[], num: string): AnyObj | null {
  if (!Array.isArray(list)) return null;
  const norm = (v: any) => String(v ?? '').trim();
  for (const it of list) {
    try {
      const n1 = pick(it, ['num'], null);
      if (n1 && norm(n1) === num) return it;
      const n2 = pick(it, ['编码', '编号', '货号'], null);
      if (n2 && norm(n2) === num) return it;
      // 兜底：扁平文本包含
      const txt = JSON.stringify(it);
      if (new RegExp(`["']${num}["']`).test(txt)) return it;
    } catch {}
  }
  return null;
}

/** 组件 */
export default function StockDetailPage({
  params,
  searchParams,
}: {
  params: { num: string };
  searchParams?: AnyObj;
}) {
  const num = decodeURI(params.num || '').trim();
  const [detail, setDetail] = useState<AnyObj | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // 先用地址栏参数兜底（列表页跳转时可能带过来），再尝试请求接口补齐字段
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
      image: searchParams?.image,
      // 把所有 query 也存一下，后面提取图片会一起扫描
      __rawFromQuery: searchParams,
    };

    // 如果信息已足够，也先渲染；随后再请求接口补充图片等信息
    setDetail(baseFromQuery);

    (async () => {
      try {
        // 一次取 500 条（当前数据量是 500），本页查找匹配 num
        const url = 'https://niuniuparts.com:6001/scm-product/v1/stock2?size=500&page=0';
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json().catch(() => ({} as AnyObj));

        // 兼容不同包裹层
        const list: any[] =
          data?.data?.list ??
          data?.data?.records ??
          data?.list ??
          data?.records ??
          data?.data ??
          [];

        const found = findByNum(list, num);

        if (found) {
          // 合并：接口数据优先，其次 query
          setDetail((prev) => ({
            ...(prev || {}),
            ...(found || {}),
          }));
        }
      } catch (err) {
        console.error('fetch detail error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [num, searchParams]);

  // 计算展示字段
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
      rawForImage: d, // 提供给图片提取
    };
  }, [detail, num]);

  // 提取图片并通过 https 代理压缩显示
  const imageUrl = useMemo(() => {
    const raw = extractFirstImageUrlFromAny(view.rawForImage);
    return toHttpsImageProxy(raw);
  }, [view.rawForImage]);

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
        <Link
          href="/stock"
          className="inline-flex items-center gap-2 rounded border px-3 py-2 hover:bg-gray-50"
        >
          ← 返回列表
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧图片 */}
        <div className="w-full">
          {imageUrl ? (
            <img
              src={imageUrl}
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

      {loading && (
        <div className="mt-6 text-gray-500 text-sm">加载中…（首次加载会稍慢）</div>
      )}
    </div>
  );
}
