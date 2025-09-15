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

export default function StockDetailPage() {
  const params: any = useParams();
  const searchParams = useSearchParams();

  // URL 中的 num
  const rawNum =
    typeof params?.num === "string"
      ? params.num
      : Array.isArray(params?.num)
      ? params.num[0]
      : "";

  // 如果列表页传过来完整数据（通过 query 参数）
  const preload = searchParams.get("product")
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
  const [loading, setLoading] = useState(!preload); // 如果有预加载，就不用 loading
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preload) return; // 已有数据，跳过请求

    if (!rawNum) {
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
        const found = list.find((x) => String(x?.num) === String(rawNum));
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
  }, [rawNum, preload]);

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
          <div><span classNa

