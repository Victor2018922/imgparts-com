import Link from "next/link";
import { headers } from "next/headers";

type Item = {
  brand?: string;
  car?: string;
  carCode?: string;
  count?: number;
  name: string;
  num: string;
  oe?: string;
  pics?: string[];
  price?: number | string;
};

function getOriginFromHeaders() {
  const h = headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("x-forwarded-host") || h.get("host");
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL || "https://imgparts-com.vercel.app";
}

function safeNum(v: unknown, def: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export default async function StockDetail({
  params,
  searchParams,
}: {
  params: { num: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const num = decodeURIComponent(params.num);

  // 列表携带过来的定位信息
  const size = safeNum(searchParams?.size, 20);
  const page = safeNum(searchParams?.page, 0);
  const idx = safeNum(searchParams?.i, 0);
  const imgIndex = Math.max(0, safeNum(searchParams?.img, 0));

  const origin = getOriginFromHeaders();

  // 单条详情
  let item: Item | null = null;
  try {
    const res = await fetch(`${origin}/api/stock/item?num=${encodeURIComponent(num)}`, {
      cache: "no-store",
      next: { revalidate: 0 },
    });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      const data = (json as any)?.data;
      if (data && typeof data === "object") item = data as Item;
    }
  } catch {}

  // 当前页列表（用于上一条/下一条）
  let list: Item[] = [];
  try {
    const qs = new URLSearchParams({ size: String(size), page: String(page) }).toString();
    const res2 = await fetch(`${origin}/api/stock?${qs}`, {
      cache: "no-store",
      next: { revalidate: 0 },
    });
    if (res2.ok) {
      const json2 = await res2.json().catch(() => null);
      const data2 = (json2 as any)?.data;
      if (Array.isArray(data2)) list = data2 as Item[];
    }
  } catch {}

  // 如果 /item 没拿到，用列表兜底
  if (!item && list.length) {
    item = list.find((x) => x.num === num) ?? null;
  }

  // 相册
  const pics =
    item?.pics && item.pics.length > 0
      ? item.pics
      : ["https://dummyimage.com/1024x768/eeeeee/aaaaaa&text=No+Image"];

  const chosen = pics[Math.min(imgIndex, pics.length - 1)] ?? pics[0];

  // 上一条/下一条（基于本页索引）
  const currentIndex = Math.min(Math.max(idx, 0), Math.max(0, list.length - 1));
  const prevIdx = currentIndex - 1;
  const nextIdx = currentIndex + 1;

  const prevItem = prevIdx >= 0 ? list[prevIdx] : null;
  const nextItem = nextIdx < list.length ? list[nextIdx] : null;

  const backHref = `/stock?size=${size}&page=${page}`;
  const toHref = (it: Item | null, i: number) =>
    it ? `/stock/${encodeURIComponent(it.num)}?size=${size}&page=${page}&i=${i}` : "#";

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* 顶部：返回 + 上/下一条 */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href={backHref}
          prefetch={false}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-gray-50"
        >
          ← 返回列表
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href={toHref(prevItem, prevIdx)}
            prefetch={false}
            aria-disabled={!prevItem}
            className={`px-3 py-2 rounded-md border ${
              !prevItem ? "opacity-40 pointer-events-none" : ""
            }`}
          >
            上一条
          </Link>
          <Link
            href={toHref(nextItem, nextIdx)}
            prefetch={false}
            aria-disabled={!nextItem}
            className={`px-3 py-2 rounded-md border ${
              !nextItem ? "opacity-40 pointer-events-none" : ""
            }`}
          >
            下一条
          </Link>
        </div>
      </div>

      {/* 主体两列 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 相册：大图 + 缩略图（无 JS，靠地址参数切换） */}
        <div className="rounded-xl border p-3">
          <a href={chosen} target="_blank" rel="noopener" className="block">
            <div className="aspect-[4/3] bg-white flex items-center justify-center overflow-hidden rounded-lg">
              <img
                src={chosen}
                alt={item?.name ?? item?.num ?? "image"}
                className="w-full h-full object-contain"
              />
            </div>
          </a>

          <div className="mt-3 grid grid-cols-5 sm:grid-cols-6 md:grid-cols-5 gap-2">
            {pics.map((p, i) => {
              const href = `/stock/${encodeURIComponent(
                num
              )}?size=${size}&page=${page}&i=${currentIndex}&img=${i}`;
              const active = i === Math.min(imgIndex, pics.length - 1);
              return (
                <Link
                  key={p + i}
                  href={href}
                  prefetch={false}
                  className={`border rounded-md overflow-hidden ${
                    active ? "ring-2 ring-black" : ""
                  }`}
                >
                  <img src={p} alt={`thumb-${i}`} className="w-full h-20 object-cover" />
                </Link>
              );
            })}
          </div>
        </div>

        {/* 信息 */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Product Detail</h2>
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-gray-500">Num:</span> {item?.num ?? "—"}
            </div>
            <div>
              <span className="text-gray-500">Name:</span> {item?.name ?? "—"}
            </div>
            <div>
              <span className="text-gray-500">Brand:</span> {item?.brand ?? "—"}
            </div>
            <div>
              <span className="text-gray-500">Model:</span> {item?.carCode ?? "—"}
            </div>
            <div>
              <span className="text-gray-500">Year:</span> — 
            </div>
            <div>
              <span className="text-gray-500">Price:</span>{" "}
              {typeof item?.price === "number"
                ? (item!.price as number).toFixed(2)
                : item?.price ?? "N/A"}
            </div>
            <div>
              <span className="text-gray-500">Stock:</span>{" "}
              {Number.isFinite(item?.count) ? String(item?.count) : "N/A"}
            </div>
          </div>

          {item?.oe && (
            <div className="mt-4 text-sm">
              <span className="text-gray-500">OE：</span>
              {item.oe}
            </div>
          )}
        </div>
      </div>

      <footer className="mt-10 text-xs text-gray-400">
        数据源： niuniuparts.com（测试预览用途）
      </footer>
    </div>
  );
}
