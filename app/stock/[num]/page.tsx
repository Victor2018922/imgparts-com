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
  s = s.replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  s = s.replace(/\u3000/g, " ");
  s = s.trim().replace(/\s+/g, "").replace(/[-_–—·•]/g, "").toLowerCase();
  return s;
}

// 兼容后端返回 text/JSON/BOM 的解析
async function parseResponse(res: Response) {
  try {
    return await res.json();
  } catch {
    const txt = (await res.text()).trim().replace(/^\uFEFF/, "");
    try { return JSON.parse(txt); } catch { return txt; }
  }
}

// 构建详情页跳转链接（携带该行字段，减少再次查找失败的概率）
function buildDetailUrl(it: StockItem) {
  const num = String(it?.num ?? "").trim();
  const q = new URLSearchParams({
    product: (it?.product ?? "-").toString(),
    oe: (it?.oe ?? "-").toString(),
    brand: (it?.brand ?? "-").toString(),
    model: (it?.model ?? "-").toString(),
    year: (it?.year ?? "-").toString(),
  }).toString();
  return `/stock/${encodeURIComponent(num)}?${q}`;
}

// 复制
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
    typeof params?.num === "string" ? params.num :
    Array.isArray(params?.num) ? params.num[0] : "";
  const normNum = normalize(rawNum);

  // 1) 优先用列表页带来的字段直接展示
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

  // 复制反馈
  const [copied, setCopied] = useState<null | "num" | "oe">(null);
  const showCopied = (k: "num" | "oe") => { setCopied(k); setTimeout(() => setCopied(null), 1200); };

  // 2) 无预加载时兜底查找（多重匹配）
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
        const byOEIn   = byNumEq || byNumIn ? null : list.find((x) => normalize(x?.oe).includes(normNum));
        const byProdIn = byNumEq || byNumIn || byOEIn ? null : list.find((x) => normalize(x?.product).includes(normNum));
        const found = byNumEq || byNumIn || byOEIn || byProdIn || null;

        if (!found) setError("未找到该商品"); else setItem(found);
        setLoading(false);
      })
      .catch(() => { setError("加载失败"); setLoading(false); });
  }, [normNum, preload]);

  // 3) 拉取列表，计算上一条 / 下一条（不改列表页）
  const [prevItem, setPrevItem] = useState<StockItem | null>(null);
  const [nextItem, setNextItem] = useState<StockItem | null>(null);
  useEffect(() => {
    const url = "https://niuniuparts.com:6001/scm-product/v1/stock2";
    fetch(url, { cache: "no-store" })
      .then(parseResponse)
      .then((raw) => {
        const list: StockItem[] = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as any)?.data) ? (raw as any).data : [];

        if (!list || list.length === 0) return;

        const idx = list.findIndex((x) => normalize(x?.num) === normNum);
        if (idx === -1) return;

        const prev = idx > 0 ? list[idx - 1] : null;
        const next = idx < list.length - 1 ? list[idx + 1] : null;
        setPrevItem(prev);
        setNextItem(next);
      })
      .catch(() => { /* 忽略导航失败，不影响主体展示 */ });
  }, [normNum]);

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

  // —— 头部操作区（返回 / 上一条 / 下一条 / Excel）——
  const HeaderActions = (
    <div className="flex items-center gap-3 mb-6 flex-wrap">
      <Link href="/stock" className="px-4 py-2 bg-gray-800 text-white rounded">
        ← 返回列表
      </Link>

      {/* 上一条 */}
      {prevItem ? (
        <Link href={buildDetailUrl(prevItem)} className="px-3 py-2 border rounded hover:bg-gray-50">
          上一条
        </Link>
      ) : (
        <button className="px-3 py-2 border rounded opacity-50 cursor-not-allowed">上一条</button>
      )}

      {/* 下一条 */}
      {nextItem ? (
        <Link href={buildDetailUrl(nextItem)} className="px-3 py-2 border rounded hover:bg-gray-50">
          下一条
        </Link>
      ) : (
        <button className="px-3 py-2 border rounded opacity-50 cursor-not-allowed">下一条</button>
      )}

      <span className="ml-auto">{DownloadBtn}</span>
    </div>
  );

  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-600 mb-4">加载失败：{error}</p>
        {HeaderActions}
        <p className="text-xs text-gray-500 mt-6">数据源：niuniuparts.com（测试预览用途）</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-4">
        <p className="text-red-600 mb-4">未找到该商品</p>
        {HeaderActions}
        <p className="text-xs text-gray-500 mt-6">数据源：niuniuparts.com（测试预览用途）</p>
      </div>
    );
  }

  const numStr = String(item.num ?? "-");
  const oeStr = String(item.oe ?? "-");

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">产品详情</h1>

      {HeaderActions}

      <div className="rounded-xl border p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Num：</span>
            <span>{numStr}</span>
            <button
              onClick={async () => { if (await copyText(numStr)) showCopied("num"); }}
              className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
            >
              {copied === "num" ? "已复制" : "复制"}
            </button>
          </div>

          <div><span className="font-semibold">Product：</span>{item.product ?? "-"}</div>

          <div className="flex items-center gap-2">
            <span className="font-semibold">OE：</span>
            <span>{oeStr}</span>
            <button
              onClick={async () => { if (await copyText(oeStr)) showCopied("oe"); }}
              className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
            >
              {copied === "oe" ? "已复制" : "复制"}
            </button>
          </div>

          <div><span className="font-semibold">Brand：</span>{item.brand ?? "-"}</div>
          <div><span className="font-semibold">Model：</span>{item.model ?? "-"}</div>
          <div><span className="font-semibold">Year：</span>{item.year ?? "-"}</div>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-6">数据源：niuniuparts.com（测试预览用途）</p>
    </div>
  );
}
