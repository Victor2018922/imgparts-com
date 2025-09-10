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

function cn(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(" ");
}

function getOriginFromHeaders() {
  const h = headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("x-forwarded-host") || h.get("host");
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL || "https://imgparts-com.vercel.app";
}

function n(v: unknown, def: number) {
  const x = Number(v);
  return Number.isFinite(x) ? x : def;
}
function toNumber(val: unknown): number | null {
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

function buildHref(base: string, params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    sp.set(k, String(v));
  });
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

function applyFiltersAndSort(
  items: Item[],
  brand: string,
  q: string,
  sort: string
) {
  let filtered = items.slice();

  if (brand) {
    filtered = filtered.filter((it) => (it.brand || "").toLowerCase() === brand.toLowerCase());
  }
  if (q) {
    const key = q.toLowerCase();
    filtered = filtered.filter((it) => {
      return (
        (it.name || "").toLowerCase().includes(key) ||
        (it.num || "").toLowerCase().includes(key) ||
        (it.oe || "").toLowerCase().includes(key)
      );
    });
  }

  if (sort === "price_asc" || sort === "price_desc") {
    filtered.sort((a, b) => {
      const ap = toNumber(a.price) ?? Number.POSITIVE_INFINITY;
      const bp = toNumber(b.price) ?? Number.POSITIVE_INFINITY;
      return sort === "price_asc" ? ap - bp : bp - ap;
    });
  } else if (sort === "name_asc") {
    filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }
  // default：不处理
  return filtered;
}

export default async function DetailPage({
  params,
  searchParams,
}: {
  params: { num: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const size = n(searchParams?.size, 20);
  const page = n(searchParams?.page, 0);
  const iFromQuery = searchParams?.i ? n(searchParams?.i, 0) : null;

  const brand = (searchParams?.brand as string | undefined) || "";
  const q = (searchParams?.q as string | undefined)?.trim() || "";
  const sort = (searchParams?.sort as string | undefined) || "default";

  const baseListParams = { size, page, brand, q, sort };

  // 1) 拉取“当前列表页”的数据（与列表页一致）
  const qsApi = new URLSearchParams({ size: String(size), page: String(page) }).toString();
  let items: Item[] = [];
  try {
    const origin = getOriginFromHeaders();
    const url = `${origin}/api/stock?${qsApi}`;
    const res = await fetch(url, { cache: "no-store", next: { revalidate: 0 } });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      const data = (json as any)?.data;
      if (Array.isArray(data)) items = data as Item[];
    }
  } catch {
    // 忽略，保持空数组
  }

  // 2) 在“当前页数据”上复用筛选与排序（与列表页逻辑一致）
  const filtered = applyFiltersAndSort(items, brand, q, sort);

  // 3) 确定当前条目的 index
  const num = decodeURIComponent(params.num);
  let index = iFromQuery ?? filtered.findIndex((x) => x.num === num);
  if (index < 0) index = 0;

  // 4) 当前条目，如果越界则回退
  const item = filtered[index] ?? filtered[0] ?? items.find((x) => x.num === num) ?? null;

  // 5) 上一条 / 下一条（基于“过滤后当前页”的相对位置）
  const hasPrev = index > 0;
  const hasNext = index < filtered.length - 1;

  const prevHref =
    hasPrev && filtered[index - 1]
      ? buildHref(`/stock/${encodeURIComponent(filtered[index - 1].num)}`, {
          ...baseListParams,
          i: index - 1,
        })
      : undefined;

  const nextHref =
    hasNext && filtered[index + 1]
      ? buildHref(`/stock/${encodeURIComponent(filtered[index + 1].num)}`, {
          ...baseListParams,
          i: index + 1,
        })
      : undefined;

  const backHref = buildHref("/stock", baseListParams);

  // 6) 展示
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* 返回列表 */}
      <div className="mb-4">
        <Link href={backHref} prefetch={false} className="text-sm underline">
          ← 返回列表
        </Link>
      </div>

      {!item ? (
        <div className="text-center text-gray-500 py-16">未找到该商品</div>
      ) : (
        <>
          {/* 标题区 */}
          <header className="mb-6">
            <h1 className="text-xl font-semibold">Product Detail</h1>
            <p className="text-sm text-gray-500 mt-1">数据源：niuniuparts.com（测试预览用途）</p>
          </header>

          {/* 主体区 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 左侧：图片展示（网格，全部图片） */}
            <div className="rounded-xl border p-3">
              <div className="grid grid-cols-2 gap-3">
                {(item.pics && item.pics.length > 0 ? item.pics : [null]).map((src, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "aspect-[4/3] bg-white flex items-center justify-center overflow-hidden rounded-lg border"
                    )}
                  >
                    {src ? (
                      <img
                        src={src}
                        alt={`${item.name || item.num} - ${idx + 1}`}
                        className="w-full h-full object-contain"
                        loading={idx > 0 ? "lazy" : "eager"}
                      />
                    ) : (
                      <span className="text-gray-400 text-xs">暂无图片</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 右侧：信息 */}
            <div className="rounded-xl border p-4">
              <div className="text-sm text-gray-500 mb-1">Num</div>
              <div className="text-lg font-semibold mb-3">{item.num}</div>

              <div className="text-sm text-gray-500 mb-1">Name</div>
              <div className="font-medium mb-3">{item.name}</div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Brand</div>
                  <div className="font-medium">{item.brand || "—"}</div>
                </div>
                <div>
                  <div className="text-gray-500">Model</div>
                  <div className="font-medium">{item.carCode || item.car || "—"}</div>
                </div>
                <div>
                  <div className="text-gray-500">OE</div>
                  <div className="font-medium break-all">{item.oe || "—"}</div>
                </div>
                <div>
                  <div className="text-gray-500">Stock</div>
                  <div className="font-medium">{Number.isFinite(item.count) ? item.count : "N/A"}</div>
                </div>
                <div>
                  <div className="text-gray-500">Price</div>
                  <div className="font-semibold text-emerald-600">
                    {typeof item.price === "number" ? item.price.toFixed(2) : item.price ?? "—"}
                  </div>
                </div>
              </div>

              {/* 上/下一条 */}
              <div className="mt-6 flex items-center gap-3">
                <Link
                  href={prevHref || "#"}
                  prefetch={false}
                  className={cn(
                    "px-4 py-2 rounded-md border",
                    !hasPrev && "pointer-events-none opacity-40"
                  )}
                  aria-disabled={!hasPrev}
                >
                  ← 上一条
                </Link>
                <Link
                  href={nextHref || "#"}
                  prefetch={false}
                  className={cn(
                    "px-4 py-2 rounded-md border",
                    !hasNext && "pointer-events-none opacity-40"
                  )}
                  aria-disabled={!hasNext}
                >
                  下一条 →
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

