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

// 统一规范化，避免“610474 ”、“ 610474”、“610 474”、“６１０４７４”等对比失败
function normalize(v: any) {
  if (v === null || v === undefined) return "";
  // 转字符串
  let s = String(v);
  // 全角转半角
  s = s.replace(/[\uFF01-\uFF5E]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
  s = s.replace(/\u3000/g, " "); // 全角空格
  // 去除所有空白和分隔符、去掉常见前后缀
  s = s
    .trim()
    .replace(/\s+/g, "")
    .replace(/[-_–—·•]/g, "")
    .toLowerCase();
  return s;
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
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((data) => {
        const list: StockItem[] = Array.isArray(data) ? data : [];

        // 1) 严格匹配（规范化完全相等）
        let foun

