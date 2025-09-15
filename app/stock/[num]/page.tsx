"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

/** --------- 工具：解析 & 字段识别 --------- */
type AnyRec = Record<string, any>;

async function parseResponse(res: Response) {
  try {
    return await res.json();
  } catch {
    const txt = (await res.text()).trim().replace(/^\uFEFF/, "");
    try { return JSON.parse(txt); } catch { return txt; }
  }
}

/** 在对象树里“找到第一个数组列表” */
function findArrayInObject(input: any): any[] {
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object") {
    const prefer = ["data", "records", "list", "content", "items", "rows", "result"];
    for (const k of prefer) {
      const v = (input as AnyRec)[k];
      if (Array.isArray(v)) return v;
    }
    let best: any[] = [];
    for (const v of Object.values(input)) {
      if (Array.isArray(v) && v.length > best.length) best = v;
    }
    if (best.length) return best;
  }
  return [];
}

function pickStr(row: AnyRec, keys: string[], regex?: RegExp): string | null {
  if (!row) return null;
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  if (regex) {
    const hit = Object.keys(row).find((k) => regex.test(k));
    const v = hit ? row[hit] : null;
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}
function pickAny(row: AnyRec, keys: string[], regex?: RegExp): any {
  if (!row) return null;
  for (const k of keys) {
    if (k in row) {
      const v = row[k];
      if (v !== null && v !== undefined && v !== "") return v;
    }
  }
  if (regex) {
    const hit = Object.keys(row).find((k) => regex.test(k));
    if (hit) return row[hit];
  }
  return null;
}

function pickNum(row: AnyRec) {
  return (
    pickStr(row, ["num", "code", "partNo", "sku", "编号", "编码"]) ||
    pickStr(row, [], /num|code|part|sku|编号|编码/i)
  );
}
function pickTitle(row: AnyRec) {
  return (
    pickStr(row, ["title", "name", "product", "productName", "goodsName", "desc", "description"]) ||
    pickStr(row, [], /title|name|product|goods|desc/i)
  );
}
function pickOE(row: AnyRec) {
  return pickStr(row, ["oe", "oeNo", "oe_num", "oeNumber", "OE号", "OE码"], /oe/i);
}
function pickBrand(row: AnyRec) {
  return pickStr(row, ["brand", "brandName", "partBrand", "品牌"], /brand|品牌/i);
}
function pickModel(row: AnyRec) {
  return pickStr(row, ["model", "carModel", "vehicleModel", "车型"], /model|车型/i);
}
function pickYear(row: AnyRec) {
  return pickStr(row, ["year", "年份"], /year|年份/i);
}
function pickImage(row: AnyRec) {
  return pickStr(
    row,
    ["imageUrl","image_url","imgUrl","img_url","image","img","photo","picture","thumb","thumbnail","cover","pic"],
    /image|img|photo|pic|thumb|cover/i
  );
}
function pickPrice(row: AnyRec) {
  const v = pickAny(row, ["price","salePrice","sale_price","unit_price","unitPrice","amount","cost"], /price|amount|cost|unit/i);
  return v === null || v === undefined || v === "" ? null : String(v);
}
function pickStock(row: AnyRec) {
  const v = pickAny(row, ["stock","qty","quantity","inventory","available","库存","数量"], /stock|qty|quantity|inventory|库存|数量|可用/i);
  return v === null || v === undefined || v === "" ? null : String(v);
}

/** --------- 组件 --------- */

export default function StockDetailPage() {
  const params: any = useParams();
  const rawNum =
    typeof params?.num === "string"
      ? params.num
      : Array.isArray(params?.num)
      ? params.num[0]
      : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<AnyRec | null>(null);

  // 直接到 /stock2 拉全页（该接口实际会返回 500 条，我们遍历筛选 num）
  useEffect(() => {
    if (!rawNum) {
      setError("无效的参数");
      setLoading(false);
      return;
    }
    const url = `https://niuniuparts.com:6001/scm-product/v1/stock2?size=500&page=0`;
    setLoading(true);
    setError(null);
    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const raw = await parseResponse(res);
        const arr = findArrayInObject(raw);
        const found =
          arr.find((x: AnyRec) => String(pickNum(x) || "").trim() === String(rawNum).trim()) ||
          arr.find((x: AnyRec) => String(pickNum(x) || "").includes(String(rawNum).trim()));
        if (!found) {
          setError("未找到该商品");
          setRow(null);
        } else {
          setRow(found);
        }
      })
      .catch(() => {
        setError("加载失败");
        setRow(null);
      })
      .finally(() => setLoading(false));
  }, [rawNum]);

  const view = useMemo(() => {
    if (!row) return null;
    return {
      num: pickNum(row) || "-",
      title: pickTitle(row) || "-",
      oe: pickOE(row) || "-",
      brand: pickBrand(row) || "-",
      model: pickModel(row) || "-",
      year: pickYear(row) || "-",
      image: pickImage(row),
      price: pickPrice(row),
      stock: pickStock(row),
    };
  }, [row]);

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
        <p className="text-red-600 mb-2">{error}</p>
        {Header}
        <p className="text-xs text-gray-500 mt-6">数据源：niuniuparts.com（测试预览用途）</p>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">产品详情</h1>
        <p className="text-red-600 mb-2">未找到该商品</p>
        {Header}
        <p className="text-xs text-gray-500 mt-6">数据源：niuniuparts.com（测试预览用途）</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">产品详情</h1>

      {Header}

      {/* 左图右信息 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* 图片 */}
        <div className="lg:col-span-1">
          <div className="border rounded-xl p-3 flex items-center justify-center" style={{ minHeight: 260 }}>
            {view.image ? (
              <img
                src={view.image}
                alt={view.num}
                style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 8 }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="text-gray-400">无图</div>
            )}
          </div>
        </div>

        {/* 信息 */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><span className="font-semibold">标题：</span>{view.title}</div>
              <div><span className="font-semibold">Num：</span>{view.num}</div>
              <div><span className="font-semibold">OE：</span>{view.oe}</div>
              <div><span className="font-semibold">Brand：</span>{view.brand}</div>
              <div><span className="font-semibold">Model：</span>{view.model}</div>
              <div><span className="font-semibold">Year：</span>{view.year}</div>
              <div><span className="font-semibold">Price：</span>{view.price ?? "-"}</div>
              <div><span className="font-semibold">Stock：</span>{view.stock ?? "-"}</div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-6">数据源：niuniuparts.com（测试预览用途）</p>
    </div>
  );
}
