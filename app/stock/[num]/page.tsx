"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
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

// —— 规范化：去空白、全角转半角、去分隔符、统一小写 ——
function normalize(v: any) {
  if (v === null || v === undefined) return "";
  let s = String(v);
  // 全角 -> 半角
  s = s.replace(/[\uFF01-\uFF5E]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
  s = s.replace(/\u3000/g, " ");
  // 去空白/分隔符，小写
  s = s.trim().replace(/\s+/g, "").replace(/[-_–—·•]/g, "").toLowerCase();
  return s;
}

// 兼容后端返回 text/JSON/BOM 的解析
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

// 复制工具
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

export default function StockDetailPage() {
  const params: any = useParams();
  const searchParams = useSearchParams();

  const rawNum =
    typeof params?.num === "string"
      ? params.num
      : Array.isArray(params?.num)
      ? params.num[0]
      : "";
  const normNum = normalize(rawNum);

  // —— 优先用列表页带来的数据（无需请求） ——
  const preload: StockItem | null =
    searchParams?.get("product") !== null
      ? {
          num: rawNum,
          product: searchParams.get("product") || "-",
          oe: searchParams.get("oe") || "-",
          brand: searchParams.get("brand") || "-",
          model: searchParams.get("model") || "-",
          year: searchParams.get("year") || "-",
        }
      : null;

  const [item, setItem] = useState<StockItem | null>(preload);
  const [loading, setLoading] = useState(!preload);
  const [error, setError] = useState<string | null>(null);

  // 复制反馈状态
  const [copied, setCopied] = useState<null | "num" | "oe">(null);
  const showCopied = (key: "num" | "oe") => {
    setCopied(key);
    setTimeout(() => setCopied(null), 1200);
  };

  useEffect(() => {
    if (preload) return; // 已有数据，跳过请求

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

        // 多重匹配
        const byNumEq = list.find((x) => normalize(x?.num) === normNum);
        const byNumIn =
          byNumEq ? null : list.find((x) => normalize(x?.num).includes(normNum));
        const byOEIn =
          byNumEq || byNumIn
            ? null
            : list.find((x) => normalize(x?.oe).includes(normNum));
        const byProdIn =
          byNumEq || byNumIn || byOEIn
            ? null
            : list.find((x) => normalize(x?.product).includes(normNum));

        const found = byNumEq || byNumIn || byOEIn || byProdIn || null;

        if (!found) setError("未找到该商品");
        else setItem(found);

        setLoading(false);
      })
      .catch(() => {
        setError("加载失败");
        setLoading(false);
      });
  }, [normNum, preload]);

  // Excel 下载按钮（始终显示）
  const DownloadBtn = (
    <a
      href="https://niuniuparts.com:6001/scm-product/v1/stock2/excel"
      target="_blank"
      className="px-4 py-2 bg-blue-600 text-white rounded"
    >
      下载库存 Excel
    </a>
  );

  if (loading) return <p className="p-4">Loading...</p>;

  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-600 mb-4">加载失败：{error}</p>
        <div className="flex gap-3 mb-6">
          <Link href="/stock" className="px-4 py-2 bg-gray-800 text-white rounded">
            ← 返回列表
          </Link>
          {DownloadBtn}
        </div>
        <p className="text-xs text-gray-500 mt-6">数据源：niuniuparts.com（测试预览用途）</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-4">
        <p className="text-red-600 mb-4">未找到该商品</p>
        <div className="flex gap-3 mb-6">
          <Link href="/stock" className="px-4 py-2 bg-gray-800 text-white rounded">
            ← 返回列表
          </Link>


