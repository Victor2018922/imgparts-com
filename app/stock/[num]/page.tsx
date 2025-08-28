// app/stock/[num]/page.tsx
import React from "react";

type Item = {
  num: string;
  product?: string;
  oe?: string;
  brand?: string;
  model?: string;
  year?: string;
  category?: string;
  note?: string;
  raw?: Record<string, any>;
};

async function fetchItem(num: string): Promise<Item | null> {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://imgparts-com.vercel.app";

  const res = await fetch(`${base}/api/stock/item?num=${encodeURIComponent(num)}`, {
    cache: "no-store",
  });

  if (!res.ok) return null;
  return (await res.json()) as Item;
}

export default async function StockDetailPage({
  params,
}: {
  params: { num: string };
}) {
  const item = await fetchItem(params.num);

  if (!item) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">SKU 未找到</h1>
        <p className="mt-2 text-sm text-gray-500">
          没有找到编号为 <span className="font-mono">{params.num}</span> 的产品。
        </p>
        <a href="/stock" className="mt-4 inline-block underline">
          ← 返回库存列表
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          {item.product || "未命名产品"}
        </h1>
        <p className="mt-1 text-gray-500">SKU：{item.num}</p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        {/* 左侧：图片占位/品牌色块 */}
        <div className="rounded-2xl bg-gray-100 aspect-[4/3] flex items-center justify-center text-gray-400">
          {/* 将来可替换为 next/image 加真实图片 */}
          <span className="text-sm">No Image</span>
        </div>

        {/* 右侧：关键信息 */}
        <div className="md:col-span-2 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Info label="OE" value={item.oe} />
            <Info label="品牌" value={item.brand} />
            <Info label="类目" value={item.category} />
            <Info label="车型" value={item.model} />
            <Info label="年份" value={item.year} />
          </div>

          {item.note && (
            <div className="mt-4 rounded-xl border p-4">
              <div className="text-sm text-gray-500">备注</div>
              <div className="mt-1">{item.note}</div>
            </div>
          )}

          {/* CTA：后续接入 RFQ 表单（C 目标） */}
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
              href={`/stock`}
            >
              返回列表
            </a>
            <a
              className="rounded-xl bg-black px-4 py-2 text-sm text-white"
              href={`https://wa.me/?text=Inquiry%20for%20SKU%20${encodeURIComponent(
                item.num
              )}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp 询价
            </a>
            <a
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white"
              href={`https://t.me/share/url?url=${encodeURIComponent(
                "https://imgparts-com.vercel.app/stock/" + item.num
              )}&text=${encodeURIComponent("Inquiry for SKU " + item.num)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Telegram 询价
            </a>
          </div>

          {/* 调试：原始行（必要时可展开查看字段映射是否正确） */}
          <details className="mt-6">
            <summary className="cursor-pointer text-sm text-gray-500">
              原始数据（调试用）
            </summary>
            <pre className="mt-2 overflow-auto rounded-lg bg-gray-50 p-4 text-xs">
              {JSON.stringify(item.raw ?? {}, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 font-medium">{value || "-"}</div>
    </div>
  );
}
