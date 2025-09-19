'use client';

import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

/* ----------------- 工具 ----------------- */
type AnyObj = Record<string, any>;

function toNum(v: any, dft = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dft;
}

// 更“贪心”的取值
function pick<T extends AnyObj>(obj: T | null | undefined, keys: string[], dft: any = '') {
  for (const k of keys) {
    const v = (obj as any)?.[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return dft;
}

// CDN 压缩 + 回退
function smartCdn(url: string, w = 800) {
  if (!url) return '';
  try {
    const u = new URL(url);
    const bare = `${u.hostname}${u.pathname}${u.search}`;
    // 1) weserv（官方域名）
    return `https://images.weserv.nl/?url=${encodeURIComponent(bare)}&w=${w}&q=82&output=webp`;
  } catch {
    return url;
  }
}

function extractImages(fromObj: AnyObj | null | undefined): string[] {
  const out: string[] = [];
  const push = (s?: string) => {
    if (!s) return;
    if (typeof s !== 'string') return;
    const t = s.trim();
    if (!t || t === 'null' || t === 'undefined') return;
    out.push(t);
  };

  if (fromObj) {
    // 1) 常见集合字段
    const direct = fromObj.images ?? fromObj.imageList ?? fromObj.imgs;
    if (Array.isArray(direct)) direct.forEach((x) => push(String(x || '')));
    if (typeof direct === 'string')
      direct.split(/[|,;\s]+/g).forEach((x) => push(x));

    // 2) 逐个字段：image1..、img1..、pic1..、photo1..（不区分大小写）
    Object.keys(fromObj).forEach((k) => {
      if (/^(img|image|pic|photo)\d*$/i.test(k)) push(String(fromObj[k] || ''));
    });

    // 3) 单字段兜底
    push(
      pick(fromObj, ['image', 'img', 'cover', 'pic', 'picUrl', 'imageUrl', 'url'], '')
    );
  }

  const uniq = Array.from(
    new Set(out.filter((x) => /^https?:\/\//i.test(x)))
  );
  return uniq.slice(0, 12);
}

/* ----------------- 共享购物车（与详情页完全一致，localStorage 同 KEY） ----------------- */
type CartItem = { num: string; title: string; price: number; image?: string; qty: number };
function useCart() {
  const KEY = 'imgparts_cart_v2';
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [step, setStep] = useState<'cart' | 'form' | 'done'>('cart');
  const [order, setOrder] = useState<{ id: string; total: number } | null>(null);

  // 结算表单
  const [form, setForm] = useState({ name: '', phone: '', address: '' });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  const add = useCallback((it: Omit<CartItem, 'qty'>, qty = 1) => {
    setItems((prev) => {
      const i = prev.findIndex((x) => x.num === it.num);
      if (i > -1) {
        const next = [...prev];
        next[i] = { ...next[i], qty: Math.min(999, next[i].qty + qty) };
        return next;
      }
      return [...prev, { ...it, qty: Math.max(1, qty) }];
    });
    setOpen(true);
  }, []);
  const setQty = useCallback((numNo: string, qty: number) => {
    setItems((prev) =>
      prev.map((x) => (x.num === numNo ? { ...x, qty: Math.max(1, qty) } : x))
    );
  }, []);
  const remove = useCallback(
    (numNo: string) => setItems((prev) => prev.filter((x) => x.num !== numNo)),
    []
  );
  const clear = useCallback(() => setItems([]), []);
  const total = useMemo(
    () => items.reduce((s, x) => s + x.price * x.qty, 0),
    [items]
  );

  const checkout = () => {
    if (items.length === 0) return;
    setStep('form');
  };

  const submitForm = () => {
    // 简单校验
    if (!form.name.trim() || !/^1\d{10}$/.test(form.phone) || form.address.trim().length < 5) {
      alert('请填写正确的收货信息（姓名、手机号、详细地址）。');
      return;
    }
    const id = 'IP' + String(Date.now()).slice(-10);
    setOrder({ id, total });
    clear();
    setStep('done');
  };

  return {
    open,
    setOpen,
    items,
    add,
    setQty,
    remove,
    clear,
    total,
    step,
    setStep,
    form,
    setForm,
    checkout,
    submitForm,
    order,
  };
}

function CartButton({ cart }: { cart: ReturnType<typeof useCart> }) {
  return (
    <button
      onClick={() => cart.setOpen(true)}
      className="fixed z-40 right-6 bottom-6 rounded-full bg-emerald-600 text-white px-4 py-3 shadow-lg hover:bg-emerald-500"
    >
      🛒 购物车（{cart.items.reduce((s, x) => s + x.qty, 0)}）
    </button>
  );
}

function CartDrawer({ cart }: { cart: ReturnType<typeof useCart> }) {
  return (
    <>
      <div
        className={`fixed z-50 top-0 right-0 h-full w-[360px] bg-white shadow-2xl transition-transform duration-200 ${
          cart.open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold">购物车</div>
          <button
            onClick={() => cart.setOpen(false)}
            className="text-slate-500 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        {/* 步骤切换 */}
        {cart.step === 'cart' && (
          <>
            <div className="p-4 space-y-3 overflow-auto h-[calc(100%-170px)]">
              {cart.items.length === 0 ? (
                <div className="text-slate-400 text-sm">购物车是空的～</div>
              ) : (
                cart.items.map((it) => (
                  <div key={it.num} className="flex gap-3 items-center">
                    <img
                      src={smartCdn(it.image || '', 120)}
                      onError={(e) => {
                        const el = e.currentTarget as HTMLImageElement;
                        el.onerror = null;
                        el.src = it.image || '';
                      }}
                      alt=""
                      className="w-16 h-16 object-contain rounded bg-slate-50"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm">{it.title}</div>
                      <div className="text-emerald-600 font-semibold">
                        ￥{it.price.toFixed(2)}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <button
                          className="px-2 border rounded"
                          onClick={() => cart.setQty(it.num, it.qty - 1)}
                        >
                          -
                        </button>
                        <input
                          className="w-12 text-center border rounded py-0.5"
                          value={it.qty}
                          onChange={(e) =>
                            cart.setQty(it.num, Number(e.target.value || 1))
                          }
                        />
                        <button
                          className="px-2 border rounded"
                          onClick={() => cart.setQty(it.num, it.qty + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <button
                      className="text-slate-400 hover:text-rose-600"
                      onClick={() => cart.remove(it.num)}
                    >
                      删除
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="border-t p-4">
              <div className="flex justify-between mb-3">
                <span className="text-slate-500">合计</span>
                <span className="text-lg font-bold text-emerald-600">
                  ￥{cart.total.toFixed(2)}
                </span>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 border rounded px-3 py-2" onClick={cart.clear}>
                  清空
                </button>
                <button
                  className="flex-1 bg-emerald-600 text-white rounded px-3 py-2 hover:bg-emerald-500"
                  onClick={cart.checkout}
                >
                  去结算
                </button>
              </div>
            </div>
          </>
        )}

        {cart.step === 'form' && (
          <div className="p-4 flex flex-col gap-3">
            <div className="text-lg font-semibold mb-2">收货信息</div>
            <input
              className="border rounded px-3 py-2"
              placeholder="姓名"
              value={cart.form.name}
              onChange={(e) => cart.setForm({ ...cart.form, name: e.target.value })}
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="手机号"
              value={cart.form.phone}
              onChange={(e) => cart.setForm({ ...cart.form, phone: e.target.value })}
            />
            <textarea
              className="border rounded px-3 py-2"
              placeholder="详细地址"
              rows={3}
              value={cart.form.address}
              onChange={(e) => cart.setForm({ ...cart.form, address: e.target.value })}
            />
            <div className="flex gap-2 mt-2">
              <button className="flex-1 border rounded px-3 py-2" onClick={() => cart.setStep('cart')}>上一步</button>
              <button className="flex-1 bg-emerald-600 text-white rounded px-3 py-2 hover:bg-emerald-500" onClick={cart.submitForm}>提交订单</button>
            </div>
          </div>
        )}
      </div>

      {/* 下单成功 */}
      {cart.step === 'done' && cart.order && (
        <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-[420px] shadow-xl">
            <div className="text-center text-emerald-600 text-xl font-bold mb-2">下单成功</div>
            <div className="text-center text-slate-600 mb-2">订单号：{cart.order.id}</div>
            <div className="text-center text-slate-700 mb-6">
              应付合计：￥{cart.order.total.toFixed(2)}
            </div>
            <div className="flex gap-2">
              <button
                className="flex-1 border rounded px-3 py-2"
                onClick={() => {
                  cart.setStep('cart');
                  cart.setOpen(false);
                }}
              >
                继续购物
              </button>
              <button
                className="flex-1 bg-slate-900 text-white rounded px-3 py-2"
                onClick={() => {
                  navigator.clipboard?.writeText(
                    `订单号：${cart.order?.id}，合计：￥${cart.order?.total.toFixed(2)}`
                  );
                  cart.setStep('cart');
                  cart.setOpen(false);
                }}
              >
                复制订单信息
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ----------------- 列表页（使用 Suspense 包裹，避免 useSearchParams 警告） ----------------- */

function PageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<AnyObj[]>([]);
  const [page, setPage] = useState(toNum(search?.get('page'), 0));
  const [size, setSize] = useState(20);

  const fetchList = async (p = page) => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://niuniuparts.com:6001/scm-product/v1/stock2?size=${size}&page=${p}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      const arr: AnyObj[] = data?.content || data?.list || data?.rows || data?.data || [];
      setList(arr);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, size]);

  const cart = useCart();

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-2xl font-bold">库存预览</div>
        <button
          className="border rounded px-3 py-1.5"
          onClick={() => window.open('https://niuniuparts.com', '_blank')}
        >
          下载库存 Excel
        </button>
      </div>

      {/* 分页 */}
      <div className="flex items-center gap-3 mb-4 text-sm text-slate-600">
        <button className="border rounded px-3 py-1 disabled:opacity-40"
          disabled={page <= 0}
          onClick={() => { setPage(Math.max(0, page - 1)); router.replace(`/stock?page=${Math.max(0, page - 1)}`); }}>
          上一页
        </button>
        <span>第 {page + 1} / 1 页</span>
        <button className="border rounded px-3 py-1" onClick={() => { setPage(page + 1); router.replace(`/stock?page=${page + 1}`); }}>
          下一页
        </button>
        <span className="ml-4">每页</span>
        <select
          className="border rounded px-2 py-1"
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
        >
          {[12, 20, 30, 40].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span>条</span>
      </div>

      {loading ? (
        <div className="text-slate-400">加载中…</div>
      ) : list.length === 0 ? (
        <div className="text-slate-400">暂无数据</div>
      ) : (
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((it, i) => {
            const num = String(pick(it, ['num', 'Num', 'code', 'partNo'], ''));
            const title = String(pick(it, ['product', 'title', 'name'], ''));
            const price = toNum(pick(it, ['price', 'Price'], 0), 0);
            const imgs = extractImages(it);
            const cover = imgs[0] || '';

            return (
              <div key={num || i} className="border rounded-xl overflow-hidden bg-white">
                <div className="aspect-[4/3] bg-slate-50 flex items-center justify-center">
                  {cover ? (
                    <img
                      src={smartCdn(cover, 820)}
                      onError={(e) => {
                        const el = e.currentTarget as HTMLImageElement;
                        el.onerror = null;
                        el.src = cover; // 回退到原图
                      }}
                      alt=""
                      className="w-full h-full object-contain"
                      decoding="async"
                      loading="lazy"
                    />
                  ) : (
                    <div className="text-slate-400">无图</div>
                  )}
                </div>

                <div className="p-4">
                  <div className="font-semibold mb-1 line-clamp-2">{title || ' '}</div>
                  <div className="text-sm text-slate-600 mb-2">
                    <div>Brand: {pick(it, ['brand', 'Brand'], '-')}</div>
                    <div>OE: {pick(it, ['oe', 'OE'], '-')}</div>
                    <div>Num: {num || '-'}</div>
                  </div>
                  <div className="text-emerald-600 font-bold mb-3">
                    ￥ {price.toFixed(2)}
                  </div>

                  <div className="flex gap-2">
                    <button
                      className="flex-1 bg-emerald-600 text-white rounded px-3 py-2 hover:bg-emerald-500"
                      onClick={() =>
                        cart.add({ num, title: title || num, price, image: cover }, 1)
                      }
                    >
                      加入购物车
                    </button>

                    <Link
                      className="flex-1 border rounded px-3 py-2 text-center hover:bg-slate-50"
                      href={`/stock/${encodeURIComponent(
                        num
                      )}?title=${encodeURIComponent(title)}&oe=${encodeURIComponent(
                        String(pick(it, ['oe', 'OE'], ''))
                      )}&brand=${encodeURIComponent(
                        String(pick(it, ['brand', 'Brand'], ''))
                      )}&price=${price}&image=${encodeURIComponent(
                        cover
                      )}&idx=${page * size + i}`}
                    >
                      查看详情
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CartButton cart={cart} />
      <CartDrawer cart={cart} />
    </div>
  );
}

export default function StockPage() {
  return (
    <Suspense fallback={<div className="max-w-screen-2xl mx-auto px-4 py-6 text-slate-400">加载中…</div>}>
      <PageInner />
    </Suspense>
  );
}
