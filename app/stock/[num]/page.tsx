"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type StockItem = {
  num?: string | number;
  product?: string;
  oe?: string;
  brand?: string;
  model?: string;
  year?: string;
  [k: string]: any;
};

// 统一规范化，避免“610 474”、“６１０４７４”、“-610474-”等无法命中
function normalize(v: any) {
  if (v === null || v === undefined) return "";
  let s = String(v);
  // 全角转半角
  s = s.replace(/[\uFF01-\uFF5E]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
  s = s.replace(/\u3000/g, " "); // 全角空格
  // 去空白与常见分隔符，统一小写
  s = s.trim().replace(/\s+/g, "").replace(/[-_–—·•]/g, "").toLowerCase();
  return s;
}

// 尽量稳健地解析（兼容 text/JSON、BOM）
async function parseResponse(res: Response) {
  try {
    return await res.json();
  } catch {
    const txt = (await res.text()).trim().replace(/^\uFEFF/, "");
    try {
      return JSON.parse(txt);
    } catch {
      return txt;
    }
  }
}

export default function StockDetailPage() {
  const params: any = useParams();
  const rawNum =
    typeof params?.num === "string"
      ? params.num
      : Array.isArray(params?.num)
      ? params.num[0]
      : "";
  const normNum = normalize(rawNum);

  const [item, setItem] = useState<StockItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!normNum) {
      setError("参数无效");
      setLoading(false);
      return;
    }

    const url = "https://niuniuparts.com:6001/scm-product/v1/stock2";

    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const raw = await parseResponse(res);
        const list: StockItem[] = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as any)?.data)
          ? (raw as any).data
          : [];

        // —— 多重匹配策略（按优先级）——
        const exactByNum = list.find((x) => normalize(x?.num) === normNum);
        const containsInNum = exactByNum
          ? null
          : list.find((x) => normalize(x?.num).includes(normNum));
        const containsInOE =
          exactByNum || containsInNum
            ? null
            : list.find((x) => normalize(x?.oe).includes(normNum));
        const containsInProduct =
          exactByNum || containsInNum || containsInOE
            ? null
            : list.find((x) => normalize(x?.product).includes(normNum));

        const found = exactByNum || containsInNum || containsInOE || containsInProduct || null;

        if (!found) {
          setError("未找到该商品");
        } else {
          setItem(found);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("加载失败");
        setLoading(false);
      });
  }, [normNum]);

  if (loading) return <p className="p-4">Loading...</p>;

  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-600 mb-4">加载失败：{error}</p>
        <Link
          href="/stock"
          className="inline-block px-4 py-2 bg-gray-800 text-white rounded"
        >
          ← 返回列表
        </Link>
        <p className="text-xs text-gray-500 mt-6">
          数据源：niuniuparts.com（测试预览用途）
        </p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-4">
        <p className="text-red-600 mb-4">未找到该商品</p>
        <Link
          href="/stock"
          className="inline-block px-4 py-2 bg-gray-800 text-white rounded"
        >
          ← 返回列表
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">产品详情</h1>

      <div className="rounded-xl border p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><span className="font-semibold">Num：</span>{String(item.num ?? "-")}</div>
          <div><span className="font-semibold">Product：</span>{item.product ?? "-"}</div>
          <div><span className="font-semibold">OE：</span>{item.oe ?? "-"}</div>
          <div><span className="font-semibold">Brand：</span>{item.brand ?? "-"}</div>
          <div><span className="font-semibold">Model：</span>{item.model ?? "-"}</div>
          <div><span className="font-semibold">Year：</span>{item.year ?? "-"}</div>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <Link href="/stock" className="px-4 py-2 bg-gray-800 text-white rounded">
          ← 返回列表
        </Link>
        <a
          href="https://niuniuparts.com:6001/scm-product/v1/stock2/excel"
          target="_blank"
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          下载库存 Excel
        </a>
      </div>

      <p className="text-xs text-gray-500 mt-6">
        数据源：niuniuparts.com（测试预览用途）
      </p>
    </div>
  );
}

