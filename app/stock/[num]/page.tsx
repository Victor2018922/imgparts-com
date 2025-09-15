"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";

/* ------------------ 基础解析 ------------------ */
type AnyRec = Record<string, any>;

async function parseResponse(res: Response) {
  try {
    return await res.json();
  } catch {
    const txt = (await res.text()).trim().replace(/^\uFEFF/, "");
    try { return JSON.parse(txt); } catch { return txt; }
  }
}

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

/* ------------------ 字段识别 ------------------ */
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

/** 识别编号（Num） */
function pickNum(row: AnyRec) {
  return (
    pickStr(row, ["num", "code", "partNo", "sku", "编号", "编码"]) ||
    pickStr(row, [], /num|code|part|sku|编号|编码/i)
  );
}
/** 识别标题/名称 */
function pickTitle(row: AnyRec) {
  return (
    pickStr(row, ["title", "name", "product", "productName", "goodsName", "desc", "description"]) ||
    pickStr(row, [], /title|name|product|goods|desc/i)
  );
}
/** 识别品牌/车型/OE/年份 */
function pickBrand(row: AnyRec) {
  return pickStr(row, ["brand","brandName","partBrand","品牌"], /brand|品牌/i);
}
function pickModel(row: AnyRec) {
  return pickStr(row, ["model","carModel","vehicleModel","车型"], /model|车型/i);
}
function pickOE(row: AnyRec) {
  return pickStr(row, ["oe","oeNo","oe_num","oeNumber","OE号","OE码"], /oe/i);
}
function pickYear(row: AnyRec) {
  return pickStr(row, ["year","年份"], /year|年份/i);
}
/** 识别图片（支持数组/对象） */
function pickImage(row: AnyRec): string | null {
  // 1) 常见单值字段
  const single = pickStr(
    row,
    [
      "imageUrl","image_url","imgUrl","img_url","image","img","photo",
      "picture","thumb","thumbnail","cover","pic","picUrl","url"
    ],
    /image|img|photo|pic|thumb|cover|url/i
  );
  if (single) return single;

  // 2) 常见数组：images/pics/photos/gallery/imgs等
  const candidates = ["images","imgs","photos","pics","gallery","pictures","album"];
  for (const key of candidates) {
    const v = row[key];
    if (Array.isArray(v) && v.length) {
      // 数组元素可能是字符串或对象
      const first = v[0];
      if (typeof first === "string") {
        if (first.trim()) return first.trim();
      } else if (first && typeof first === "object") {
        const objUrl =
          pickStr(first, ["url","image","img","src","link","path"], /url|image|img|src|path/i);
        if (objUrl) return objUrl;
      }
    }
  }

  // 3) 对象字段：image/cover/picture 里面再套 url 等
  const objKeys = ["image","img","photo","picture","cover","thumb"];
  for (const k of objKeys) {
    const v = row[k];
    if (v && typeof v === "object") {
      const objUrl =
        pickStr(v, ["url","imageUrl","src","path"], /url|image|src|path/i);
      if (objUrl) return objUrl;
    }
  }

  return null;
}
/** 识别价格/库存 */
function pickPrice(row: AnyRec) {
  const v = pickAny(row, ["price","salePrice","sale_price","unit_price","unitPrice","amount","cost","usdPrice","cnyPrice"], /price|amount|cost|unit/i);
  return v === null || v === undefined || v === "" ? null : String(v);
}
function pickStock(row: AnyRec) {
  const v = pickAny(row, ["stock","stockQty","stockQuantity","qty","quantity","inventory","available","库存","数量"], /stock|qty|quantity|inventory|库存|数量|可用/i);
  return v === null || v === undefined || v === "" ? null : String(v);
}

/* ------------------ 页面 ------------------ */
export default function StockDetailPage() {
  const params: any = useParams();
  const sp = useSearchParams();

  // 路由参数里的 num
  const rawNum =
    typeof params?.num === "string"
      ? params.num
      : Array.isArray(params?.num)
      ? params.num[0]
      : "";

  // URL兜底值（从列表页带过来时可直接显示）
  const fallback = {
    image: sp.get("image") || "",
    price: sp.get("price") || "",
    stock: sp.get("stock") || "",
    title: sp.get("product") || "",
    brand: sp.get("brand") || "",
    model: sp.get("model") || "",
    oe: sp.get("oe") || "",
    year: sp.get("year") || "",
  };

  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<AnyRec | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // 把兜底值与接口值合并（接口优先）
  const view = useMemo(() => {
    const v = {
      num: rawNum || "-",
      title: fallback.title || "-",
      oe: fallback.oe || "-",
      brand: fallback.brand || "-",
      model: fallback.model || "-",
      year: fallback.year || "-",
      image: fallback.image || "",
      price: fallback.price || "",
      stock: fallback.stock || "",
    };
    if (row) {
      v.num = pickNum(row) || v.num;
      v.title = pickTitle(row) || v.title;
      v.oe = pickOE(row) || v.oe;
      v.brand = pickBrand(row) || v.brand;
      v.model = pickModel(row) || v.model;
      v.year = pickYear(row) || v.year;
      v.image = pickImage(row) || v.image;
      v.price = pickPrice(row) || v.price;
      v.stock = pickStock(row) || v.stock;
    }
    return v;
  }, [row, fallback, rawNum]);

  if (loading) return <p className="p-4">Loading...</p>;

  const Header = (
    <div className="flex items-center gap-3 mb-6 flex-wrap">
      <Link href="/stock" className="px-4 py-2 bg-gray-800 text-white rounded">← 返回列表</Link>
      <a
        href="https://niuniuparts.com:6001/scm-product/v1/stock2/excel"
        target="_blank"
        className="ml-auto px-4 py-2 bg-blue-600 text-white rounded"
      >
        下载库存 Excel
      </a>
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

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">产品详情</h1>

      {Header}

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
              <div><span className="font-semibold">标题：</span>{view.title || "-"}</div>
              <div><span className="font-semibold">Num：</span>{view.num || "-"}</div>
              <div><span className="font-semibold">OE：</span>{view.oe || "-"}</div>
              <div><span className="font-semibold">Brand：</span>{view.brand || "-"}</div>
              <div><span className="font-semibold">Model：</span>{view.model || "-"}</div>
              <div><span className="font-semibold">Year：</span>{view.year || "-"}</div>
              <div><span className="font-semibold">Price：</span>{view.price || "-"}</div>
              <div><span className="font-semibold">Stock：</span>{view.stock || "-"}</div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-6">数据源：niuniuparts.com（测试预览用途）</p>
    </div>
  );
}
