'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

/* =============== 工具类型 =============== */
type AnyObj = Record<string, any>;

type ListItem = {
  id?: string;
  sn?: string;
  oe?: string;
  name?: string;
  brand?: string;
  model?: string;
  year?: string;
  imageUrls?: string[];
  _raw?: AnyObj;
};

const API = (page: number, size = 20) =>
  `https://niuniuparts.com:6001/scm-product/v1/stock2?size=${size}&page=${page}`;

/* =============== 工具函数 =============== */
function extractArray(json: AnyObj): AnyObj[] {
  if (!json) return [];
  if (Array.isArray(json?.data?.content)) return json.data.content;
  if (Array.isArray(json?.content)) return json.content;
  if (Array.isArray(json?.data)) return json.data;
  return [];
}
function extractImageUrls(obj: AnyObj): string[] {
  const candidates: Array<string | string[] | undefined> = [
    obj.imageUrls, obj.images, obj.imageList, obj.imgs, obj.pictures, obj.pics,
    obj.urls, obj.img, obj.image, obj.pic, obj.photo
  ];
  const urls: string[] = [];
  const push = (raw: string) => {
    String(raw).split(/[\s,;\n]+/g).forEach((p) => {
      const v = p.trim();
      if (/^https?:\/\//i.test(v) && /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(v)) urls.push(v);
    });
  };
  for (const c of candidates) {
    if (!c) continue;
    Array.isArray(c) ? c.forEach((x) => push(String(x))) : push(String(c));
  }
  return Array.from(new Set(urls));
}
function normalizeItem(raw: AnyObj): ListItem {
  const oe = raw.oe ?? raw.OE ?? raw.oeNo ?? raw.oeCode ?? raw['OE号'] ?? '';
  const id = raw.id ?? raw.sn ?? raw.code ?? raw.sku ?? raw.num ?? oe ?? '';
  const name = raw.name ?? raw.title ?? raw.productName ?? raw.partName ?? raw['品名'] ?? raw['名称'] ?? 'IMG';
  const brand = raw.brand ?? raw.maker ?? raw['品牌'] ?? 'IMG';
  const model = raw.model ?? raw.vehicle ?? raw['车型'] ?? '';
  const year = raw.year ?? raw['年份'] ?? '';
  return {
    id: String(id || ''),
    sn: String(raw.sn ?? ''),
    oe: String(oe || ''),
    name: String(name || 'IMG'),
    brand: String(brand || 'IMG'),
    model: String(model || ''),
    year: String(year || ''),
    imageUrls: extractImageUrls(raw),
    _raw: raw
  };
}

/** 在本文件内封装：把原始条目编码进 URL（不再从详情页导入） */
function encodeItemForParam(item: AnyObj): string {
  try {
    const json = JSON.stringify(item);
    // 兼容中文：先 encodeURIComponent 再 btoa，再整体 encodeURIComponent
    // @ts-ignore
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return encodeURIComponent(b64);
  } catch {
    return encodeURIComponent(JSON.stringify(item));
  }
}

/* =============== 列表页主组件 =============== */
export default function StockListPage() {
  const search = useSearchParams();
  const router = useRouter();

  // 数据状态
  const [page, setPage] = useState(0);
  const [list, setList] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // 搜索/筛选
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');

  // 购物车
  const [cartOpen, setCartOpen] = useState<boolean>(() => search?.get('checkout') === '1');
  const [cart, setCart] = useState<AnyObj[]>(() => {
    try { return JSON.parse(localStorage.getItem('imgparts_cart') || '[]'); } catch { return []; }
  });
  useEffect(() => { try { localStorage.setItem('imgparts_cart', JSON.stringify(cart)); } catch {} }, [cart]);

  // 结算表单
  const [mode, setMode] = useState<'B2C' | 'B2B'>('B2C');
  const [form, setForm] = useState({ name: '', phone: '', company: '', email: '', country: '', city: '', address: '', zip: '', note: '' });

  // 无限滚动哨兵
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchPage = useCallback(async (p: number) => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const res = await fetch(API(p), { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      const arr = extractArray(json).map(normalizeItem);
      setList((old) => (p === 0 ? arr : [...old, ...arr]));
      setHasMore(arr.length > 0);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore]);

  // 初次加载
  useEffect(() => { fetchPage(0); setPage(0); }, []); // eslint-disable-line

  // 触底加载
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && hasMore && !loading) {
          const next = page + 1;
          setPage(next);
          fetchPage(next);
        }
      });
    }, { rootMargin: '400px 0px' });
    io.observe(node);
    return () => io.disconnect();
  }, [page, hasMore, loading, fetchPage]);

  // 过滤
  const filtered = useMemo(() => {
    return list.filter((x) => {
      const hitQ = !q || [x.name, x.oe, x.brand, x.model].some(v => (v || '').toLowerCase().includes(q.toLowerCase()));
      const hitBrand = !brand || x.brand === brand;
      const hitModel = !model || x.model === model;
      const hitYear = !year || x.year === year;
      return hitQ && hitBrand && hitModel && hitYear;
    });
  }, [list, q, brand, model, year]);

  const brandOptions = useMemo(() => Array.from(new Set(list.map((x) => x.brand).filter(Boolean))), [list]);
  const modelOptions = useMemo(() => Array.from(new Set(list.map((x) => x.model).filter(Boolean))), [list]);
  const yearOptions = useMemo(() => Array.from(new Set(list.map((x) => x.year).filter(Boolean))), [list]);

  const clearAllFilters = useCallback(() => { setQ(''); setBrand(''); setModel(''); setYear(''); }, []);

  // 购物车
  const addToCart = (it: ListItem) => {
    setCart((old) => {
      const idx = old.findIndex((x) => (x.oe || x.id) === (it.oe || it.id));
      if (idx >= 0) { const cp = [...old]; cp[idx].qty = (cp[idx].qty || 1) + 1; return cp; }
      return [...old, { ...it, qty: 1 }];
    });
  };
  const removeFromCart = (it: AnyObj) => setCart((old) => old.filter((x) => (x.oe || x.id) !== (it.oe || it.id)));
  const setQty = (it: AnyObj, n: number) => setCart((old) => {
    const cp = old.map((x) => ({ ...x }));
    const idx = cp.findIndex((x) => (x.oe || x.id) === (it.oe || it.id));
    if (idx >= 0) cp[idx].qty = Math.max(1, n);
    return cp;
  });
  const clearCart = () => setCart([]);

  const submitOrder = () => {
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { alert('请填写有效邮箱（必填）'); return; }
    alert('订单已提交（演示提交），我们将尽快与您联系！');
    setCartOpen(false);
  };

  /* =============== 渲染 =============== */
  return (
    <main className="container mx-auto p-4">
      {/* 顶部 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="text-xl font-semibold">ImgParts 预览站</div>
        <nav className="space-x-4 text-sm">
          <Link href="/" className="hover:underline">首页</Link>
          <Link href="/stock" className="hover:underline">库存预览</Link>
          <Link href="/stock?oe=1" className="hover:underline">OE 搜索</Link>
          <button onClick={() => setCartOpen(true)} className="rounded-lg border px-3 py-2 hover:bg-gray-50">
            购物车 / 结算（{cart.reduce((s, x) => s + (x.qty || 1), 0)}）
          </button>
        </nav>
      </div>

      {/* 搜索 + 筛选 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索：OE号 / 商品名 / 品牌 / 车型" className="w-full max-w-md rounded-lg border px-3 py-2" />
        <button onClick={() => {}} className="rounded-lg bg-blue-600 px-3 py-2 text-white hover:bg-blue-700">搜索</button>

        <select value={brand} onChange={(e) => setBrand(e.target.value)} className="rounded-lg border px-3 py-2">
          <option value="">品牌（全部）</option>
          {brandOptions.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={model} onChange={(e) => setModel(e.target.value)} className="rounded-lg border px-3 py-2">
          <option value="">车型（全部）</option>
          {modelOptions.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)} className="rounded-lg border px-3 py-2">
          <option value="">年份（全部）</option>
          {yearOptions.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <button onClick={clearAllFilters} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">清空筛选</button>
      </div>

      {/* 列表 */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((it) => (
          <div key={(it.oe || it.id) + '-card'} className="flex gap-4 rounded-xl border p-4 hover:shadow-sm">
            <div className="w-40 shrink-0">
              {it.imageUrls?.length ? (
                <img src={it.imageUrls[0]} alt={it.name} className="h-28 w-40 rounded-md object-cover" />
              ) : (
                <div className="flex h-28 w-40 items-center justify-center rounded-md border text-gray-400">No Image</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Link
                href={`/stock/${encodeURIComponent(it.sn || it.id || it.oe || '')}?d=${encodeURIComponent(encodeItemForParam(it._raw || it))}`}
                className="line-clamp-1 text-lg font-medium hover:underline"
                title="查看详情"
              >
                {it.name}
              </Link>
              <div className="mt-1 text-sm text-gray-500">IMG</div>
              {!!it.oe && <div className="mt-1 text-sm text-gray-600">OE: {it.oe}</div>}

              <div className="mt-3 flex gap-2">
                <button onClick={() => addToCart(it)} className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50">加入购物车</button>
                <Link
                  href={`/stock/${encodeURIComponent(it.sn || it.id || it.oe || '')}?d=${encodeURIComponent(encodeItemForParam(it._raw || it))}`}
                  className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50"
                >查看详情</Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 加载状态 + 兜底按钮 + 哨兵 */}
      <div ref={sentinelRef} className="h-10" />
      <div className="mt-6 flex items-center justify-center">
        {loading ? (
          <div className="rounded-lg border px-4 py-2 text-gray-500">加载中…</div>
        ) : hasMore ? (
          <button
            onClick={() => { const next = page + 1; setPage(next); fetchPage(next); }}
            className="rounded-lg border px-4 py-2 hover:bg-gray-50"
          >加载更多</button>
        ) : (
          <div className="text-sm text-gray-400">没有更多了</div>
        )}
      </div>

      {/* 数据源 */}
      <div className="mt-10 text-sm text-gray-400">
        数据源： <a className="hover:underline" href="https://niuniuparts.com" target="_blank">niuniuparts.com</a>（测试预览用途）
      </div>

      {/* 结算弹窗 */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-semibold">结算</div>
              <button onClick={() => setCartOpen(false)} className="rounded-lg border px-3 py-1 hover:bg-gray-50">关闭</button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* 购物车 */}
              <div>
                <div className="mb-2 text-sm text-gray-500">购物车（{cart.length}）</div>
                <div className="space-y-3">
                  {cart.map((it) => (
                    <div key={(it.oe || it.id) + '-cart'} className="flex gap-3 rounded-lg border p-3">
                      <div className="w-20 shrink-0">
                        {it.imageUrls?.length ? (
                          <img src={it.imageUrls[0]} className="h-16 w-20 rounded object-cover" alt={it.name} />
                        ) : (
                          <div className="flex h-16 w-20 items-center justify-center rounded border text-gray-400">No Img</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-1 font-medium">{it.name}</div>
                        {!!it.oe && <div className="text-sm text-gray-600">OE: {it.oe}</div>}
                        <div className="mt-2 flex items-center gap-2 text-sm">
                          <button onClick={() => setQty(it, (it.qty || 1) - 1)} className="rounded border px-2">-</button>
                          <span>{it.qty || 1}</span>
                          <button onClick={() => setQty(it, (it.qty || 1) + 1)} className="rounded border px-2">+</button>
                          <button onClick={() => removeFromCart(it)} className="ml-3 rounded border px-2 text-red-600">移除</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {cart.length > 0 && (
                  <div className="mt-3 text-right">
                    <button onClick={clearCart} className="rounded border px-3 py-1 hover:bg-gray-50">清空购物车</button>
                  </div>
                )}
              </div>

              {/* 表单 */}
              <div>
                <div className="mb-2 flex gap-2">
                  <button onClick={() => setMode('B2C')} className={`rounded-lg px-3 py-1 ${mode === 'B2C' ? 'bg-blue-600 text-white' : 'border'}`}>B2C（个人）</button>
                  <button onClick={() => setMode('B2B')} className={`rounded-lg px-3 py-1 ${mode === 'B2B' ? 'bg-blue-600 text-white' : 'border'}`}>B2B（公司）</button>
                </div>

                <div className="space-y-3">
                  {mode === 'B2B' ? (
                    <input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder="公司名称 *" className="w-full rounded border px-3 py-2" />
                  ) : (
                    <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="联系人姓名 *" className="w-full rounded border px-3 py-2" />
                  )}

                  <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="联系电话 *" className="w-full rounded border px-3 py-2" />

                  {/* 邮箱必填 */}
                  <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="邮箱（必填） *" className="w-full rounded border px-3 py-2" />

                  <div className="grid grid-cols-2 gap-3">
                    <input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} placeholder="国家" className="w-full rounded border px-3 py-2" />
                    <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="城市" className="w-full rounded border px-3 py-2" />
                  </div>

                  <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="详细地址" className="w-full rounded border px-3 py-2" />
                  <input value={form.zip} onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))} placeholder="邮编" className="w-full rounded border px-3 py-2" />
                  <textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="备注（可选）" className="h-24 w-full rounded border px-3 py-2" />
                </div>

                <div className="mt-4 flex gap-3">
                  <button onClick={submitOrder} className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">提交订单</button>
                  <button onClick={() => setCartOpen(false)} className="rounded-lg border px-4 py-2 hover:bg-gray-50">继续浏览</button>
                </div>
              </div>
            </div>

            <div className="mt-8 text-sm text-gray-400">
              数据源： <a className="hover:underline" href="https://niuniuparts.com" target="_blank">niuniuparts.com</a>（测试预览用途）
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

