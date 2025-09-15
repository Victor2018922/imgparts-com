"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type StockItem = {
  num?: string;
  product?: string;
  oe?: string;
  brand?: string;
  model?: string;
  year?: string;
  [k: string]: any;
};

export default function StockDetailPage() {
  // 兼容各种形态，避免 params 类型导致的异常
  const params: any = useParams();
  const num =
    typeof params?.num === "string"
      ? params.num
      : Array.isArray(params?.num)
      ? params.num[0]
      : "";

  const [item, setItem] = useState<StockItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 没有 num，直接给出错误，不再继续请求，防止异常
    if (!num) {
      setError("参数无效");
      setLoading(false);
      return;
    }

    // 直接从上游获取全量，再就地筛选；加上完整的错误兜底
    const url = "https://niuniuparts.com:6001/scm-product/v1/stock2";

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`upstream_${res.status}`);
        return res.json();
      })
      .then((data) => {
        // 防御：确保是数组，避免 JSON 结构变化导致崩溃
        const list = Array.isArray(data) ? data : [];
        const found = list.find(
          (x: any) => String(x?.num) === String(num)
        );
        if (!found) {
          setError("未找到该商品");
        } else {
          setItem(found);
        }
        setLoading(false);
      })
      .catch(() => {
        // 任何异常都只更新状态，不抛错
        setError("加载失败");
        setLoading(false);
      });
  }, [num]);

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

  // 正常展示
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">产品详情</h1>

      <div className="rounded-xl border p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><span className="font-semibold">Num：</span>{item.num ?? "-"}</div>
          <div><span className="font-semibold">Product：</span>{item.product ?? "-"}</div>
          <div><span className="font-semibold">OE：</span>{item.oe ?? "-"}</div>
          <div><span className="font-semibold">Brand：</span>{item.brand ?? "-"}</div>
          <div><span className="font-semibold">Model：</span>{item.model ?? "-"}</div>
          <div><span className="font-semibold">Year：</span>{item.year ?? "-"}</div>
        </div>
      </div>

      <div className="mt-6">
        <Link href="/stock" className="px-4 py-2 bg-gray-800 text-white rounded">
          ← 返回列表
        </Link>
      </div>

      <p className="text-xs text-gray-500 mt-6">
        数据源：niuniuparts.com（测试预览用途）
      </p>
    </div>
  );
}

