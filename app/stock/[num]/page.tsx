"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";

/** 基础类型 */
type StockItem = {
  num?: string | number;
  product?: string;
  oe?: string;
  brand?: string;
  model?: string;
  year?: string;
  [k: string]: any; // 可能还会有 image/price 等
};

/** 工具：字符串规范化，用于匹配 */
function normalize(v: any) {
  if (v === null || v === undefined) return "";
  let s = String(v);
  s = s.replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  s = s.replace(/\u3000/g, " ");
  s = s.trim().replace(/\s+/g, "").replace(/[-_–—·•]/g, "").toLowerCase();
  return s;
}

/** 工具：稳健解析（兼容 text/JSON/BOM） */
async function parseResponse(res: Response) {
  try {
    return await res.json();
  } catch {
    const txt = (await res.text()).trim().replace(/^\uFEFF/, "");
    try { return JSON.parse(txt); } catch { return txt; }
  }
}

/** 工具：尽量从一条记录里识别图片、价格 */
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

export default function StockDetailPage() {
  const params: any = useParams();
  const searchParams = useSearchParams();

  // 路由参数中的 num
  const rawNum =
    typeof params?.num === "string" ? params.num :
    Array.isArray(params?.num) ? params.num[0] : "";
  const normNum = normalize(rawNum);

  // 1) 优先用地址栏参数（来自列表页的直传）
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

  // 新增：图片、价格两个展示位的状态
  const [imageUrl, setImageUrl] = useState<string | null>(preload?.image ? String(preload.image) : null);
  const [priceStr, setPriceStr] = useState<string | null>(preload?.price ? String(preload.price) : null);

  // 2) 没有预加载时，自己到接口兜底找一遍，并智能识别图片/价格
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

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">产品详情</h1>

      {Header}

      {/* 左图右信息 */}
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

        {/* 关键信息 + 价格 */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><span className="font-semibold">Num：</span>{numStr}</div>
              <div><span className="font-semibold">Product：</span>{item.product ?? "-"}</div>
              <div><span className="font-semibold">OE：</span>{oeStr}</div>
              <div><span className="font-semibold">Brand：</span>{item.brand ?? "-"}</div>

              {/* 新增：价格 */}
              <div><span className="font-semibold">Price：</span>{priceDisplay}</div>

              <div><span className="font-semibold">Model：</span>{item.model ?? "-"}</div>
              <div><span className="font-semibold">Year：</span>{item.year ?? "-"}</div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-6">数据源：niuniuparts.com（测试预览用途）</p>
    </div>
  );
}
