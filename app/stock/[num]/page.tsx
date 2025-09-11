'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// ========== 类型 ==========
type StockItem = {
  num: string;
  name: string;
  brand: string;        // 零件品牌（显示为 Parts Brand）
  car: string;          // 车辆品牌（显示为 Brand）
  model: string;        // 车型 / 适配信息（显示为 Model）
  year?: string;        // 生产年限（显示为 Year）
  oe?: string;          // OE 编号
  price?: number | string;
  count?: number | string;
  pics?: string[];
};

type ApiListResp = { data: StockItem[]; status?: string };
type ApiItemResp = { data: StockItem | StockItem[]; status?: string };

// ========== 小工具 ==========
const currency = (v?: number | string) => {
  if (v === undefined || v === null || v === '') return 'N/A';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }).replace('$', '$');
};

const notEmpty = <T,>(x: T | null | undefined): x is T => x !== null && x !== undefined;

// 取 OE “前缀”用于相似度匹配（仅取非字母数字去掉后的前 5~8 位）
function oeStem(oe?: string) {
  if (!oe) return '';
  const norm = oe.replace(/[^0-9a-z]/gi, '').toUpperCase();
  return norm.slice(0, Math.min(8, Math.max(5, Math.round(norm.length * 0.5))));
}

// ========== 详情页组件 ==========
export default function StockDetailPage() {
  const params = useParams<{ num: string }>() as { num: string };
  const num = params?.num;
  const router = useRouter();

  // 详情数据
  const [item, setItem] = useState<StockItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // 缩略图 / 大图
  const [activeIndex, setActiveIndex] = useState(0);

  // 相关推荐
  const [related, setRelated] = useState<StockItem[]>([]);
  const [relLoading, setRelLoading] = useState(true);

  // 询价单
  const [adding, setAdding] = useState(false);

  // ---------- 拉取详情 ----------
  useEffect(() => {
    let mounted = true;
    async function loadDetail() {
      try {
        setLoading(true);
        setErr(null);

        // 兼容你现有的 API：/api/stock/item?num=xxx
        // （若你的站点里已经换成了外链 API，这里也能正常工作，因为你之前已跑通）
        const res = await fetch(`/api/stock/item?num=${encodeURIComponent(num)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: ApiItemResp = await res.json();

        let detail: StockItem | null = null;
        if (Array.isArray(json.data)) {
          detail = json.data.find(d => d.num === num) ?? json.data[0] ?? null;
        } else {
          detail = (json.data as StockItem) ?? null;
        }
        if (mounted) {
          setItem(detail);
          setActiveIndex(0);
        }
      } catch (e: any) {
        if (mounted) setErr(e?.message || 'Load failed');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (num) loadDetail();
    return () => {
      mounted = false;
    };
  }, [num]);

  // ---------- 拉取相关推荐 ----------
  useEffect(() => {
    let mounted = true;

    async function loadRelated(current: StockItem) {
      try {
        setRelLoading(true);
        // 拉一页库存（数量大点，方便筛选）
        const res = await fetch(`/api/stock?size=200&page=0`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: ApiListResp = await res.json();
        const list = (json.data || []).filter(notEmpty);

        const stem = oeStem(current.oe);
        const brandVehicle = (current.car || '').trim().toUpperCase(); // 车辆品牌（HONDA/TOYOTA）

        // 规则：
        // 1) 同“车辆品牌” + OE 前缀相似（优先）
        // 2) 仅同“车辆品牌”
        const bucket1 = list.filter(
          x =>
            x.num !== current.num &&
            (x.car || '').trim().toUpperCase() === brandVehicle &&
            stem &&
            oeStem(x.oe) === stem
        );

        const bucket2 = list.filter(
          x =>
            x.num !== current.num &&
            (x.car || '').trim().toUpperCase() === brandVehicle
        );

        const merged: StockItem[] = [];
        for (const it of [...bucket1, ...bucket2]) {
          if (merged.find(m => m.num === it.num)) continue;
          merged.push(it);
          if (merged.length >= 6) break;
        }

        if (mounted) setRelated(merged);
      } catch (e) {
        if (mounted) setRelated([]);
      } finally {
        if (mounted) setRelLoading(false);
      }
    }

    if (item?.num) loadRelated(item);
    else setRelated([]);
    return () => {
      mounted = false;
    };
  }, [item?.num, item?.car, item?.oe]);

  // ---------- 大图 & 缩略图 ----------
  const pics = useMemo(() => (item?.pics || []).filter(Boolean), [item?.pics]);
  useEffect(() => {
    // 进入新商品时，默认选第一张
    setActiveIndex(0);
  }, [pics.length, item?.num]);

  // 缩略图点击立即切换（修复你之前需要刷新才能切换的问题）
  const onThumbClick = (idx: number) => {
    setActiveIndex(idx);
    // 滚动到可视区域（小条）
    const thumb = document.getElementById(`thumb-${idx}`);
    thumb?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  };

  // ---------- 询价单 ----------
  const addToInquiry = async () => {
    if (!item) return;
    setAdding(true);
    try {
      const payload = {
        num: item.num,
        name: item.name,
        brand: item.brand,
        car: item.car,
        model: item.model,
        price: item.price ?? '',
        image: pics[0] ?? '',
        qty: 1,
      };
      // 存本地（简单实现）
      const KEY = 'imgparts_inquiry';
      const raw = localStorage.getItem(KEY);
      const list = raw ? JSON.parse(raw) as any[] : [];
      const idx = list.findIndex(x => x.num === payload.num);
      if (idx >= 0) list[idx].qty = (list[idx].qty ?? 1) + 1;
      else list.push(payload);
      localStorage.setItem(KEY, JSON.stringify(list));
      alert('已加入询价单');
    } catch {
      alert('加入失败，请重试');
    } finally {
      setAdding(false);
    }
  };

  // ---------- UI ----------
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="h-6 w-40 bg-gray-200 animate-pulse rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-6">
          <div className="aspect-[4/3] bg-gray-100 animate-pulse rounded" />
          <div className="space-y-3">
            <div className="h-5 w-60 bg-gray-200 animate-pulse rounded" />
            <div className="h-5 w-48 bg-gray-200 animate-pulse rounded" />
            <div className="h-5 w-32 bg-gray-200 animate-pulse rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (err || !item) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-red-600">加载失败：{err ?? '未找到该商品'}</p>
        <div className="mt-6">
          <button onClick={() => router.back()} className="px-4 py-2 rounded border">
            ← 返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* 面包屑 */}
      <nav className="text-sm mb-4 text-gray-500 space-x-2">
        <Link href="/" className="hover:underline">首页</Link>
        <span>/</span>
        <Link href="/stock" className="hover:underline">库存预览</Link>
        <span>/</span>
        <span className="text-gray-800">商品详情</span>
      </nav>

      <h1 className="text-xl font-semibold mb-4">Product Detail</h1>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8">
        {/* 左：图片 */}
        <div>
          {/* 大图 */}
          <div className="w-full aspect-[4/3] bg-white rounded shadow overflow-hidden flex items-center justify-center">
            {pics.length > 0 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${item.num}-${activeIndex}`}
                src={pics[activeIndex]}
                alt={item.name}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="text-gray-400">（暂无图片）</div>
            )}
          </div>

          {/* 缩略图条 */}
          {pics.length > 1 && (
            <div className="mt-3 flex items-center gap-2 overflow-x-auto">
              {pics.map((p, idx) => (
                <button
                  key={p + idx}
                  id={`thumb-${idx}`}
                  onClick={() => onThumbClick(idx)}
                  className={`shrink-0 w-24 h-16 rounded border ${
                    idx === activeIndex ? 'ring-2 ring-emerald-500' : 'border-gray-200'
                  }`}
                  title={`预览 ${idx + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p} alt={`thumb-${idx}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 右：信息 */}
        <aside>
          <div className="text-sm text-gray-500 mb-1">Num: <span className="text-gray-800">{item.num || '—'}</span></div>
          <h2 className="text-lg font-medium mb-2">{item.name || '—'}</h2>

          <div className="space-y-1 text-sm">
            {/* 注意：命名调整 */}
            <div><span className="text-gray-500">Parts Brand:</span> <span className="text-gray-800">{item.brand || '—'}</span></div>
            <div><span className="text-gray-500">Brand:</span> <span className="text-gray-800">{item.car || '—'}</span></div>
            <div><span className="text-gray-500">Model:</span> <span className="text-gray-800">{item.model || '—'}</span></div>
            <div><span className="text-gray-500">Year:</span> <span className="text-gray-800">{item.year || '—'}</span></div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">OE:</span>
              <span className="text-gray-800">{item.oe || '—'}</span>
              {item.oe && (
                <button
                  onClick={() => { navigator.clipboard.writeText(item.oe!); }}
                  className="text-xs px-2 py-0.5 rounded border hover:bg-gray-50"
                >
                  复制 OE
                </button>
              )}
            </div>
            <div><span className="text-gray-500">Price:</span> <span className="text-emerald-700 font-semibold">{currency(item.price)}</span></div>
            <div><span className="text-gray-500">Stock:</span> <span className="text-gray-800">{item.count ?? 'N/A'}</span></div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => router.push('/stock')} className="px-4 py-2 rounded border">← 返回列表</button>
            <button onClick={addToInquiry} disabled={adding} className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60">
              {adding ? '加入中…' : '加入询价单'}
            </button>
            <Link href="/inquiry" className="px-4 py-2 rounded border hover:bg-gray-50">查看询价单</Link>
          </div>

          <div className="mt-2 text-[12px] text-gray-400">数据源：niuniuparts.com（测试预览用途）</div>
        </aside>
      </div>

      {/* 参数表 */}
      <section className="mt-10">
        <h3 className="text-base font-semibold mb-3">产品参数</h3>
        <div className="overflow-hidden rounded border">
          <table className="w-full text-sm">
            <tbody className="[&>tr:nth-child(odd)]:bg-gray-50">
              <tr><td className="p-3 text-gray-500 w-48">商品编号（Num）</td><td className="p-3">{item.num || '—'}</td></tr>
              <tr><td className="p-3 text-gray-500">Parts Brand</td><td className="p-3">{item.brand || '—'}</td></tr>
              <tr><td className="p-3 text-gray-500">Brand</td><td className="p-3">{item.car || '—'}</td></tr>
              <tr><td className="p-3 text-gray-500">适配车型（Model）</td><td className="p-3">{item.model || '—'}</td></tr>
              <tr><td className="p-3 text-gray-500">Year</td><td className="p-3">{item.year || '—'}</td></tr>
              <tr><td className="p-3 text-gray-500">价格（Price）</td><td className="p-3">{currency(item.price)}</td></tr>
              <tr><td className="p-3 text-gray-500">库存（Stock）</td><td className="p-3">{item.count ?? 'N/A'}</td></tr>
              <tr><td className="p-3 text-gray-500">OE 编号</td><td className="p-3">{item.oe || '—'}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 相关推荐 */}
      <section className="mt-12">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">相关推荐</h3>
          <Link href="/stock" className="text-sm text-emerald-700 hover:underline">更多 &rarr;</Link>
        </div>

        {relLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded border p-2">
                <div className="aspect-[4/3] bg-gray-100 animate-pulse rounded mb-2" />
                <div className="h-4 w-24 bg-gray-200 animate-pulse rounded mb-1" />
                <div className="h-4 w-32 bg-gray-200 animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : related.length === 0 ? (
          <div className="text-sm text-gray-500">暂无相关推荐</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {related.map(r => (
              <Link
                key={r.num}
                href={`/stock/${encodeURIComponent(r.num)}`}
                className="rounded border hover:shadow transition p-2"
                title={r.name}
              >
                <div className="aspect-[4/3] bg-white rounded mb-2 flex items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={(r.pics && r.pics[0]) || '/noimg.png'}
                    alt={r.name}
                    className="object-contain max-w-full max-h-full"
                  />
                </div>
                <div className="text-[12px] text-gray-500">{r.num}</div>
                <div className="text-sm line-clamp-2">{r.name}</div>
                <div className="text-[13px] text-emerald-700 mt-1">{currency(r.price)}</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
