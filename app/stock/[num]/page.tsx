"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface StockItem {
  num: string;
  name: string;
  brand: string;   // 零件品牌（展示为 Parts Brand）
  model: string;   // 车型型号（展示为 Model）
  year: string;    // 年份（展示为 Year）
  price: number;
  stock: number;
  oe?: string;
  pics?: string[];
}

export default function StockDetailPage() {
  const router = useRouter();

  // 关键修复：先拿 params，再安全取 num，避免 TS 报错
  const params = useParams() as Record<string, string> | null;
  const num = useMemo(() => params?.num ?? "", [params]);

  const [item, setItem] = useState<StockItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!num) return;

    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        // 直接请求外部接口，保持简单稳定
        const res = await fetch(
          `https://niuniuparts.com:6001/scm-product/v1/stock2?num=${encodeURIComponent(
            num
          )}`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          throw new Error(`加载失败：HTTP ${res.status}`);
        }

        const data = await res.json();

        // 接口返回通常是数组，取第一个
        if (Array.isArray(data) && data.length > 0) {
          // 做一层兜底，防止空字段破坏渲染
          const d = data[0] || {};
          setItem({
            num: d.num ?? "",
            name: d.name ?? "",
            brand: d.brand ?? "",   // Parts Brand
            model: d.car ?? d.model ?? "", // 这里不少数据用 car 表示品牌/车型，兜底兼容
            year: d.year ?? "",
            price: Number(d.price ?? 0),
            stock: Number(d.stock ?? 0),
            oe: d.oe ?? "",
            pics: Array.isArray(d.pics) ? d.pics : [],
          });
        } else {
          setError("未找到该商品");
        }
      } catch (err: any) {
        setError(err?.message || "加载失败");
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [num]);

  if (!num) {
    return (
      <div className="p-6">
        <p className="text-red-600">加载失败：缺少商品编号</p>
        <button
          onClick={() => router.push("/stock")}
          className="mt-4 px-4 py-2 bg-gray-700 text-white rounded"
        >
          ← 返回列表
        </button>
      </div>
    );
  }

  if (loading) return <div className="p-6">加载中...</div>;

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-600">加载失败：{error}</p>
        <button
          onClick={() => router.push("/stock")}
          className="mt-4 px-4 py-2 bg-gray-700 text-white rounded"
        >
          ← 返回列表
        </button>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-6">
        <p className="text-red-600">未找到该商品</p>
        <button
          onClick={() => router.push("/stock")}
          className="mt-4 px-4 py-2 bg-gray-700 text-white rounded"
        >
          ← 返回列表
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Product Detail</h1>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-[420px]">
          {item.pics && item.pics.length > 0 ? (
            <img
              src={item.pics[0]}
              alt={item.name}
              className="w-full h-[320px] object-contain border rounded"
            />
          ) : (
            <div className="w-full h-[320px] flex items-center justify-center border rounded">
              暂无图片
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2">
          <p>
            <strong>Num:</strong> {item.num}
          </p>
          <p>
            <strong>Name:</strong> {item.name}
          </p>

          {/* 你之前的要求：Parts Brand / Brand / Model / Year 的呈现 */}
          <p>
            <strong>Parts Brand:</strong> {item.brand || "-"}
          </p>
          <p>
            <strong>Brand:</strong> {item.model || "-"}
          </p>
          <p>
            <strong>Model:</strong> {item.model || "-"}
          </p>
          <p>
            <strong>Year:</strong> {item.year || "-"}
          </p>

          <p>
            <strong>OE:</strong> {item.oe || "-"}
          </p>
          <p>
            <strong>Price:</strong> ${item.price}
          </p>
          <p>
            <strong>Stock:</strong> {item.stock}
          </p>

          <div className="pt-2">
            <button
              onClick={() => router.push("/stock")}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              ← 返回列表
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
