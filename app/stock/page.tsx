// 服务端组件：不使用 "use client"

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

export const revalidate = 0; // 禁用缓存，始终取最新

async function fetchStock(): Promise<StockItem[]> {
  try {
    const res = await fetch(
      "https://niuniuparts.com:6001/scm-product/v1/stock2",
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const json = await res.json();
    if (Array.isArray(json)) return json as StockItem[];
    if (json?.data && Array.isArray(json.data)) return json.data as StockItem[];
    return [];
  } catch {
    return [];
  }
}

export default async function StockPage() {
  const data = await fetchStock();

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Stock List</h1>

      <p className="mb-3 text-gray-600">共 {data.length} 条数据</p>

      <a
        href="https://niuniuparts.com:6001/scm-product/v1/stock2/excel"
        className="inline-block mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        target="_blank"
      >
        下载库存 Excel
      </a>

      <table className="w-full border border-gray-300 text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1">Num</th>
            <th className="border px-2 py-1">Product</th>
            <th className="border px-2 py-1">OE</th>
            <th className="border px-2 py-1">Brand</th>
            <th className="border px-2 py-1">Model</th>
            <th className="border px-2 py-1">Year</th>
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map((item, idx) => {
              const num = item?.num ? String(item.num) : "";
              return (
                <tr key={`${num}-${idx}`} className="hover:bg-gray-50">
                  <td className="border px-2 py-1">
                    {num ? (
                      <Link
                        href={`/stock/${encodeURIComponent(num)}`}
                        className="text-blue-600 hover:underline"
                      >
                        {num}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="border px-2 py-1">{item?.product ?? "-"}</td>
                  <td className="border px-2 py-1">{item?.oe ?? "-"}</td>
                  <td className="border px-2 py-1">{item?.brand ?? "-"}</td>
                  <td className="border px-2 py-1">{item?.model ?? "-"}</td>
                  <td className="border px-2 py-1">{item?.year ?? "-"}</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={6} className="border px-2 py-6 text-center text-gray-500">
                暂无数据（上游接口无返回或暂时不可用）
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <p className="text-xs text-gray-500 mt-3">
        数据源：niuniuparts.com（测试预览用途）
      </p>
    </div>
  );
}


