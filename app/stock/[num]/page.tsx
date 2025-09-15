"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";

/** 数据类型 */
type StockItem = {
  num?: string | number;
  product?: string;
  oe?: string;
  brand?: string;
  model?: string;
  year?: string;
  [k: string]: any;
};

type CartItem = {
  num: string;
  product: string;
  brand?: string;
  oe?: string;
  price?: string; // 原样保存（可能带货币符号）
  qty: number;
  image?: string;
};

const CART_KEY = "imgparts_cart_v1";

/** 工具：规范化、稳健解析、识别图片/价格、复制、价格转数字 */
function normalize(v: any) {
  if (v === null || v === undefined) return "";
  let s = String(v);
  s = s.replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  s = s.replace(/\u3000/g, " ");
  s = s.trim().replace(/\s+/g, "").replace(/[-_–—·•]/g, "").toLowerCase();
  return s;
}

async function parseResponse(res: Response) {
  try {
    return await res.json();
  } catch {
    const txt = (await res.text()).trim().replace(/^\uFEFF/, "");
    try { return JSON.parse(txt); } catch { return txt; }
  }
}

function pickImageUrl(row: Record<string, any>): string | null {
  if (!row) return null;
  const keys = [
    "imageUrl","image_url","imgUrl","img_url",
    "image","img","photo","picture","thumb","thumbnail",
  ];
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const hit = Object.keys(row).find((k) => /image|img|photo|pic|thumb/i.test(k));
  const v = hit ? row[hit] : null;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function pickPrice(row: Record<string, any>): string | null {
  if (!row) return null;
  const keys = ["price","unit_price","unitPrice","salePrice","sale_price","amount","cost"];
  for (const k of keys) {
    const v = row[k];
    if (v !== null && v !== undefined && v !== "") return String(v);
  }
  const hit = Object.keys(row).find((k) => /price|amount|cost/i.test(k));
  const v = hit ? row[hit] : null;
  return v !== null && v !== undefined && v !== "" ? String(v) : null;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

function priceToNumber(p?: string | null): number | null {
  if (!p) return null;
  const s = String(p).replace(/[^0-9.]/g, "");
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/** 购物车工具 */
function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch { return []; }
}

function saveCart(list: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(list));
}

function addToCart(item: CartItem) {
  const list = loadCart();
  const idx = list.findIndex((x) => x.num === item.num);
  if (idx >= 0) {
    list[idx].qty += item.qty;
    // 更新价格/图片等可能变化的字段
    list[idx].price = item.price ?? list[idx].price;
    list[idx].image = item.image ?? list[idx].image;
    list[idx].brand = item.brand ?? list[idx].brand;
    list[idx].oe = item.oe ?? list[idx].oe;
    list[idx].product = item.product ?? list[idx].product;
  } else {
    list.push(item);
  }
  saveCart(list);
  return list;
}

export default function StockDetailPage() {
  const params: any = useParams();
  const searchParams = useSearchParams();

  const rawNum =
    typeof params?.num === "string" ? params.num :
    Array.isArray(params?.num) ? params.num[0] : "";
  const normNum = normalize(rawNum);

  // 1) 优先用地址栏参数（来自列表页）
  const preload: StockItem | null =
    searchParams?.get("product") !== null
      ? {
          num: rawNum,
          product: searchParams.get("product") || "-",
          oe: searchParams.get("oe") || "-",
          brand: searchParams.get("brand") || "-",
          model: searchParams.get("model") || "-",
          year: searchParams.get("year") || "-",
          image: searchParams.get("image") || "",
          price: searchParams.get("price") || "",
        }
      : null;

  const [item, setItem] = useState<StockItem | null>(preload);
  const [loading, setLoading] = useState(!preload);
  const [error, setError] = useState<string | null>(null);

  // 图片、价格
  const [imageUrl, setImageUrl] = useState<string | null>(preload?.image ? String(preload.image) : null);
  const [priceStr, setPriceStr] = useState<string | null>(preload?.price ? String(preload.price) : null);

  // 购物车状态
  const [qty, setQty] = useState<number>(1);
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setCart(loadCart());
  }, []);

  // 2) 无预加载时，接口兜底查找并识别图片/价格
  useEffect(() => {
    if (preload) return;
    if (!normNum) { setError("参数无效"); setLoading(false); return; }

    const url = "https://niuniuparts.com:6001/scm-product/v1/stock2";
    fetch(url, { cache: "no-store" })
      .then(parseResponse)
      .then((raw) => {
        const list: StockItem[] = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as any)?.data) ? (raw as any).data : [];

        const byNumEq = list.find((x) => normalize(x?.num) === normNum);
        const byNumIn = byNumEq ? null : list.find((x) => normalize(x?.num).includes(normNum));
        const byOEIn  = byNumEq || byNumIn ? null : list.find((x) => normalize(x?.oe).includes(normNum));
        const byProd  = byNumEq || byNumIn || byOEIn ? null : list.find((x) => normalize(x?.product).includes(normNum));
        const found = byNumEq || byNumIn || byOEIn || byProd || null;

        if (!found) {
          setError("未找到该商品");
        } else {
          setItem(found);
          setImageUrl(pickImageUrl(found));
          setPriceStr(pickPrice(found));
        }
        setLoading(false);
      })
      .catch(() => { setError("加载失败"); setLoading(false); });
  }, [normNum, preload]);

  if (loading) return <p className="p-4">Loading...</p>;

  const DownloadBtn = (
    <a
      href="https://niuniuparts.com:6001/scm-product/v1/stock2/excel"
      target="_blank"
      className="px-4 py-2 bg-blue-600 text-white rounded"
    >
      下载库存 Excel
    </a>
  );

  const Header = (
    <div className="flex items-center gap-3 mb-6 flex-wrap">
      <Link href="/stock" className="px-4 py-2 bg-gray-800 text-white rounded">← 返回列表</Link>
      <span className="ml-auto">{DownloadBtn}</span>
    </div>
  );

  if (error) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">产品详情</h1>
        <p className="text-red-600 mb-4">加载失败：{error}</p>
        {Header}
        <p className="text-xs text-gray-500 mt-6">数据源：niuniuparts.com（测试预览用途）</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">产品详情</h1>
        <p className="text-red-600 mb-4">未找到该商品</p>
        {Header}
        <p className="text-xs text-gray-500 mt-6">数据源：niuniuparts.com（测试预览用途）</p>
      </div>
    );
  }

  const numStr = String(item.num ?? "-");
  const oeStr = String(item.oe ?? "-");
  const priceDisplay = priceStr ? String(priceStr) : "-";

  /** 购物车操作 */
  const onAddToCart = () => {
    const newList = addToCart({
      num: numStr,
      product: String(item.product ?? "-"),
      brand: item.brand ? String(item.brand) : undefined,
      oe: item.oe ? String(item.oe) : undefined,
      price: priceStr ?? undefined,
      qty: Math.max(1, qty),
      image: imageUrl ?? undefined,
    });
    setCart(newList);
    setToast("已加入购物车");
    setTimeout(() => setToast(null), 1200);
  };

  const cartCount = cart.reduce((s, x) => s + (x.qty || 0), 0);
  const cartTotal = cart.reduce((s, x) => {
    const n = priceToNumber(x.price);
    return n ? s + n * (x.qty || 0) : s;
    }, 0);

  const inquiryText = () => {
    const lines = cart.map((x, i) => {
      const n = priceToNumber(x.price);
      const total = n ? (n * (x.qty || 0)).toFixed(2) : "-";
      return `${i + 1}. Num: ${x.num} | OE: ${x.oe ?? "-"} | Product: ${x.product ?? "-"} | Brand: ${x.brand ?? "-"} | Qty: ${x.qty} | Price: ${x.price ?? "-"} | LineTotal: ${total}`;
    });
    const sumLine = cartTotal > 0 ? `\nTotal: ${cartTotal.toFixed(2)}` : "";
    return `Inquiry List:\n${lines.join("\n")}${sumLine}\n\nFrom: ImgParts Preview`;
  };

  const onCopyInquiry = async () => {
    if (await copyText(inquiryText())) {
      setToast("已复制询价单");
      setTimeout(() => setToast(null), 1200);
    }
  };

  const onClearCart = () => {
    saveCart([]);
    setCart([]);
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">产品详情</h1>

      {Header}

      {/* 左图右信息 + 加入购物车 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* 图片框 */}
        <div className="lg:col-span-1">
          <div className="border rounded-xl p-3 flex items-center justify-center" style={{ minHeight: 260 }}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={numStr}
                style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 8 }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="text-gray-400">无图</div>
            )}
          </div>
        </div>

        {/* 信息 + 价格 + 购物车操作 */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><span className="font-semibold">Num：</span>{numStr}</div>
              <div><span className="font-semibold">Product：</span>{item.product ?? "-"}</div>
              <div><span className="font-semibold">OE：</span>{oeStr}</div>
              <div><span className="font-semibold">Brand：</span>{item.brand ?? "-"}</div>
              <div><span className="font-semibold">Price：</span>{priceDisplay}</div>
              <div><span className="font-semibold">Model：</span>{item.model ?? "-"}</div>
              <div><span className="font-semibold">Year：</span>{item.year ?? "-"}</div>
            </div>

            {/* 购物车操作区 */}
            <div className="mt-4 flex items-center gap-3">
              <label className="text-sm text-gray-600">数量</label>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 px-2 py-1 border rounded"
              />
              <button
                onClick={onAddToCart}
                className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
              >
                加入购物车
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 悬浮购物车按钮 */}
      <button
        onClick={() => setCartOpen(true)}
        className="fixed bottom-6 right-6 px-4 py-3 bg-gray-900 text-white rounded-full shadow-lg"
        aria-label="open-cart"
      >
        🛒 购物车（{cartCount}）
      </button>

      {/* 购物车弹层 */}
      {cartOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center">
          <div className="bg-white w-full md:w-[720px] max-h-[80vh] rounded-t-2xl md:rounded-2xl overflow-hidden">
            <div className="p-4 border-b flex items-center">
              <h3 className="font-semibold text-lg">购物车</h3>
              <button onClick={() => setCartOpen(false)} className="ml-auto px-3 py-1 border rounded hover:bg-gray-50">关闭</button>
            </div>
            <div className="p-4 overflow-auto" style={{ maxHeight: "60vh" }}>
              {cart.length === 0 ? (
                <div className="text-gray-500">购物车为空</div>
              ) : (
                <table className="w-full text-sm border">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border px-2 py-1">Num</th>
                      <th className="border px-2 py-1">OE</th>
                      <th className="border px-2 py-1">Product</th>
                      <th className="border px-2 py-1">Brand</th>
                      <th className="border px-2 py-1">Qty</th>
                      <th className="border px-2 py-1">Price</th>
                      <th className="border px-2 py-1">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((c, i) => {
                      const n = priceToNumber(c.price);
                      return (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="border px-2 py-1">{c.num}</td>
                          <td className="border px-2 py-1">{c.oe ?? "-"}</td>
                          <td className="border px-2 py-1">{c.product ?? "-"}</td>
                          <td className="border px-2 py-1">{c.brand ?? "-"}</td>
                          <td className="border px-2 py-1">{c.qty}</td>
                          <td className="border px-2 py-1">{c.price ?? "-"}</td>
                          <td className="border px-2 py-1">{n ? (n * c.qty).toFixed(2) : "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {cart.length > 0 && (
                <div className="mt-3 text-right">
                  <div className="text-sm text-gray-600">
                    合计（仅统计有数字价格的商品）：<span className="font-semibold">{cartTotal > 0 ? cartTotal.toFixed(2) : "-"}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t flex items-center gap-3">
              <button onClick={onCopyInquiry} className="px-4 py-2 border rounded hover:bg-gray-50">复制询价单</button>
              <button onClick={onClearCart} className="px-4 py-2 border rounded hover:bg-gray-50">清空</button>
              <button onClick={() => setCartOpen(false)} className="ml-auto px-4 py-2 bg-gray-900 text-white rounded">关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* 轻提示 */}
      {toast && (
        <div className="fixed bottom-24 right-6 bg-black/80 text-white text-sm px-3 py-2 rounded">
          {toast}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-6">数据源：niuniuparts.com（测试预览用途）</p>
    </div>
  );
}
