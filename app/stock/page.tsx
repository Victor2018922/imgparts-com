'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/* ----------------- 工具方法 ----------------- */
type AnyObj = Record<string, any>;

function cdn(url: string, w = 1200) {
  if (!url) return '';
  try {
    const u = new URL(url);
    // wsrv.nl 代理压缩
    const bare = `${u.hostname}${u.pathname}${u.search}`;
    return `https://wsrv.nl/?url=${encodeURIComponent(bare)}&w=${w}&output=webp&q=82`;
  } catch {
    return url;
  }
}

function pick<T extends AnyObj>(obj: T | null | undefined, keys: string[], dft: any = '') {
  for (const k of keys) {
    const v = (obj as any)?.[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return dft;
}

function toNum(v: any, dft = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dft;
}

/** 从对象里尽可能抽取图片（最多 12 张，去重） */
function extractImages(fromObj: AnyObj | null): string[] {
  const out: string[] = [];
  const push = (s?: string) => {
    const t = String(s ?? '').trim();
    if (!t || t === 'null' || t === 'undefined') return;
    if (!/^https?:\/\//i.test(t)) return;
    out.push(t);
  };

  if (fromObj) {
    // 常见字段（数组/分隔字符串）
    const direct = pick(fromObj, ['images', 'imageList', 'imgs', 'pictures', 'album'], null);
    if (Array.isArray(direct)) direct.forEach((x: any) => push(String(x || '')));
    if (typeof direct === 'string') direct.split(/[|,;\s]+/g).forEach((x) => push(x));

    // 常见单字段
    push(pick(fromObj, ['image', 'img', 'cover', 'pic', 'picUrl', 'imageUrl', 'url', 'thumb'], ''));

    // 兼容 pic1..pic12 / img1..img12 / photo*
    Object.keys(fromObj).forEach((k) => {
      if (/^(img|image|pic|photo)\d*$/i.test(k)) push(String(fromObj[k] || ''));
    });
  }

  return Array.from(new Set(out)).slice(0, 12);
}

/* ----------------- 购物车（与详情页一致，共享 localStorage） ----------------- */
type CartItem = { num: string; title: string; price: number; image?: string; qty: number };

function useCart() {
  const KEY = 'imgparts_cart_v2';
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [step, setStep] = useState<'cart' | 'form' | 'done'>('cart');
  const [order, setOrder] = useState<{ id: string; total: number } | null>(null);

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
    setStep('cart');
  }, []);

  const setQty = useCallback((numNo: string, qty: number) => {
    setItems((prev) => prev.map((x) => (x.num === numNo ? { ...x, qty: Math.max(1, qty) } : x)));
  }, []);
  const remove = useCallback((numNo: string) => setItems((prev) => prev.filter((x) => x.num !== numNo)), []);
  const clear = useCallback(() => setItems([]), []);

  const total = useMemo(() => items.reduce((s, x) => s + x.price * x.qty, 0), [items]);

  const gotoForm = () => setStep('form');
  const submitOrder = (buyer: { name: string; phone: string; addr: string; note?: string }) => {
    const id = 'IP' + String(Date.now()).slice(-10);
    const totalMoney = total;
    setOrder({ id, total: totalMoney });
    localStorage.setItem('imgparts_last_buyer', JSON.stringify(buyer));
    clear();
    setStep('done');
  };

  return { open, setOpen, items, add, setQty, remove, clear, total, step, setStep, gotoForm, submitOrder, order };
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
  const [form, setForm] = useState<{ name: string; phone: string; addr: string; note?: string }>({
    name: '',
    phone: '',
    addr: '',
    note: '',
  });

  useEffect(() => {
    if (cart.step === 'form') {
      try {
        const raw = localStorage.getItem('imgparts_last_buyer');
        if (raw) setForm(JSON.parse(raw));
      } catch {}
    }
  }, [cart.step]);

  const valid = form.name.trim() && form.phone.trim() && form.addr.trim();

  return (
    <>
      <div
        className={`fixed z-50 top-0 right-0 h-full w-[360px] bg-white shadow-2xl transition-transform duration-200 ${
          cart.open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold">
            {cart.step === 'cart' ? '购物车' : cart.step === 'form' ? '填写收件信息' : '下单成功'}
          </div>
          <button onClick={() => cart.setOpen(false)} className="text-slate-500 hover:text-slate-700">
            ✕
          </button>
        </div>

        {/* 购物车列表 */}
        {cart.step === 'cart' && (
          <>
            <div className="p-4 space-y-3 overflow-auto h-[calc(100%-170px)]">
              {cart.items.length === 0 ? (
                <div className="text-slate-400 text-sm">购物车是空的～</div>
              ) : (
                cart.items.map((it) => (
                  <div key={it.num} className="flex gap-3 items-center">
                    <img src={cdn(it.image || '', 120)} alt="" className="w-16 h-16 object-contain rounded bg-slate-50" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm">{it.title}</div>
                      <div className="text-emerald-600 font-semibold">￥{it.price.toFixed(2)}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <button className="px-2 border rounded" onClick={() => cart.setQty(it.num, it.qty - 1)}>
                          -
                        </button>
                        <input
                          className="w-12 text-center border rounded py-0.5"
                          value={it.qty}
                          onChange={(e) => cart.setQty(it.num, Number(e.target.value || 1))}
                        />
                        <button className="px-2 border rounded" onClick={() => cart.setQty(it.num, it.qty + 1)}>
                          +
                        </button>
                      </div>
                    </div>
                    <button className="text-slate-400 hover:text-rose-600" onClick={() => cart.remove(it.num)}>
                      删除
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="border-t p-4">
              <div className="flex justify-between mb-3">
                <span className="text-slate-500">合计</span>
                <span className="text-lg font-bold text-emerald-600">￥{cart.total.toFixed(2)}</span>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 border rounded px-3 py-2" onClick={cart.clear}>
                  清空
                </button>
                <button
                  className="flex-1 bg-emerald-600 text-white rounded px-3 py-2 hover:bg-emerald-500 disabled:opacity-40"
                  disabled={cart.items.length === 0}
                  onClick={cart.gotoForm}
                >
                  去结算
                </button>
              </div>
            </div>
          </>
        )}

        {/* 表单页 */}
        {cart.step === 'form' && (
          <div className="p-4 flex flex-col h-[calc(100%-56px)]">
            <div className="space-y-3 flex-1 overflow-auto">
              <div>
                <div className="text-sm text-slate-500 mb-1">收件人</div>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                  placeholder="姓名"
                />
              </div>
              <div>
                <div className="text-sm text-slate-500 mb-1">手机</div>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                  placeholder="手机"
                />
              </div>
              <div>
                <div className="text-sm text-slate-500 mb-1">地址</div>
                <textarea
                  value={form.addr}
                  onChange={(e) => setForm((f) => ({ ...f, addr: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                  placeholder="省市区 + 详细地址"
                  rows={3}
                />
              </div>
              <div>
                <div className="text-sm text-slate-500 mb-1">备注（可选）</div>
                <input
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                  placeholder="开票/送货等备注"
                />
              </div>
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between mb-3">
                <span className="text-slate-500">应付合计</span>
                <span className="text-lg font-bold text-emerald-600">￥{cart.total.toFixed(2)}</span>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 border rounded px-3 py-2" onClick={() => cart.setStep('cart')}>
                  返回购物车
                </button>
                <button
                  className="flex-1 bg-emerald-600 text-white rounded px-3 py-2 hover:bg-emerald-500 disabled:opacity-40"
                  disabled={!valid}
                  onClick={() => cart.submitOrder(form)}
                >
                  提交订单
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 成功页（在抽屉内） */}
        {cart.step === 'done' && cart.order && (
          <div className="p-6 flex flex-col h-[calc(100%-56px)] items-center justify-center">
            <div className="text-emerald-600 text-xl font-bold mb-2">下单成功</div>
            <div className="text-slate-600 mb-2">订单号：{cart.order.id}</div>
            <div className="text-slate-700 mb-6">应付合计：￥{cart.order.total.toFixed(2)}</div>
            <div className="flex gap-2">
              <button className="border rounded px-3 py-2" onClick={() => cart.setOpen(false)}>
                继续购物
              </button>
              <button
                className="bg-slate-900 text-white rounded px-3 py-2"
                onClick={() => navigator.clipboard?.writeText(`订单号：${cart.order!.id}，合计：￥${cart.order!.total.toFixed(2)}`)}
              >
                复制订单信息
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ----------------- 列表页主体 ----------------- */
export default function StockPage() {
  const router = useRouter();
  const cart = useCart();

  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [list, setList] = useState<AnyObj[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stop = false;
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(`https://niuniuparts.com:6001/scm-product/v1/stock2?size=${size}&page=${page}`, {
          cache: 'no-store',
        });
        const data = await res.json();
        const rows: AnyObj[] = data?.content || data?.list || data?.rows || data?.data || [];
        if (!stop) {
          setList(rows);
          setTotalPages(Number(data?.totalPages ?? 1) || 1);
        }
      } catch {
        if (!stop) {
          setList([]);
          setTotalPages(1);
        }
      } finally {
        if (!stop) setLoading(false);
      }
    };
    run();
    return () => {
      stop = true;
    };
  }, [page, size]);

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-2xl font-semibold">库存预览</div>
        <a
          href={`https://niuniuparts.com:6001/scm-product/v1/stock2?size=${size}&page=${page}`}
          target="_blank"
          className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-500"
        >
          下载库存 Excel
        </a>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <button className="px-3 py-1.5 border rounded disabled:opacity-40" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>
          上一页
        </button>
        <div>第 {page + 1} / {totalPages} 页</div>
        <button
          className="px-3 py-1.5 border rounded disabled:opacity-40"
          disabled={page >= totalPages - 1}
          onClick={() => setPage((p) => p + 1)}
        >
          下一页
        </button>

        <div className="ml-6">每页</div>
        <select
          className="border rounded px-2 py-1"
          value={size}
          onChange={(e) => {
            setPage(0);
            setSize(Number(e.target.value));
          }}
        >
          <option value={20}>20</option>
          <option value={40}>40</option>
          <option value={80}>80</option>
        </select>
        <div>条</div>
      </div>

      {loading ? (
        <div className="text-slate-400">加载中…</div>
      ) : list.length === 0 ? (
        <div className="text-slate-400">暂无数据</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {list.map((it, i) => {
            const num = String(pick(it, ['num', 'Num', 'code', 'partNo'], ''));
            const title = String(pick(it, ['product', 'title', 'name'], ''));
            const oe = String(pick(it, ['oe', 'OE'], ''));
            const brand = String(pick(it, ['brand', 'Brand'], ''));
            const price = toNum(pick(it, ['price', 'Price'], 0), 0);
            const imgs = extractImages(it);
            const firstImg = imgs[0] || '';

            return (
              <div key={num || i} className="border rounded-xl overflow-hidden bg-white">
                <div className="aspect-[4/3] bg-slate-50 flex items-center justify-center">
                  {firstImg ? (
                    <img src={cdn(firstImg, 900)} alt="" className="w-full h-full object-contain"
                      onError={(e) => ((e.currentTarget.src = ''), (e.currentTarget.alt = ''))} />
                  ) : (
                    <div className="text-slate-400">无图</div>
                  )}
                </div>
                <div className="p-4 space-y-1">
                  <div className="font-medium line-clamp-2 min-h-[48px]">{title || num}</div>
                  <div className="text-slate-600 text-sm">Brand: {brand || '-'}</div>
                  <div className="text-slate-600 text-sm">OE: {oe || '-'}</div>
                  <div className="text-emerald-600 font-semibold">¥ {price.toFixed(2)}</div>
                  <div className="flex gap-2 pt-2">
                    <button
                      className="flex-1 bg-emerald-600 text-white rounded px-3 py-2 hover:bg-emerald-500"
                      onClick={() => cart.add({ num, title: title || num, price, image: firstImg }, 1)}
                    >
                      加入购物车
                    </button>
                    <Link
                      className="flex-1 border rounded px-3 py-2 text-center hover:bg-slate-50"
                      href={`/stock/${encodeURIComponent(num)}?title=${encodeURIComponent(title)}&oe=${encodeURIComponent(
                        oe
                      )}&brand=${encodeURIComponent(brand)}&price=${price}&image=${encodeURIComponent(firstImg)}&idx=${page * size + i}`}
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
