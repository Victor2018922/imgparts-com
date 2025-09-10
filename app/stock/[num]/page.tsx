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
function s(v: unknown, def = ""): string {
  if (typeof v === "string") return v;
  return def;
}
function toNumber(val: unknown): number | null {
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

function buildHref(base: string, params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    sp.set(k, String(v));
  });
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

export default async function DetailPage({
  params,
  searchParams,
}: {
  params: { num: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const num = decodeURIComponent(params.num);

  // 从列表页保留过来的参数（用于“返回列表”）
  const size = n(searchParams?.size, 20);
  const page = n(searchParams?.page, 0);
  const i = n(searchParams?.i, -1);
  const brand = s(searchParams?.brand, "");
  const q = s(searchParams?.q, "");
  const sort = s(searchParams?.sort, "default");
  const hasPic = s(searchParams?.hasPic, "") === "1";
  const minPrice = searchParams?.minPrice ? Number(searchParams?.minPrice) : undefined;
  const maxPrice = searchParams?.maxPrice ? Number(searchParams?.maxPrice) : undefined;

  const backParams: Record<string, any> = {
    size,
    page,
    brand: brand || undefined,
    q: q || undefined,
    sort: sort !== "default" ? sort : undefined,
    hasPic: hasPic ? 1 : undefined,
    minPrice,
    maxPrice,
  };

  // 拉取当前页数据（用于拿到该条目的完整信息与图片）
  const origin = getOriginFromHeaders();
  const url = `${origin}/api/stock?size=${size}&page=${page}`;
  let items: Item[] = [];
  try {
    const res = await fetch(url, { cache: "no-store", next: { revalidate: 0 } });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      const data = (json as any)?.data;
      if (Array.isArray(data)) items = data as Item[];
    }
  } catch {
    // 忽略
  }

  // 优先用列表传来的索引 i；找不到就按 num 匹配
  let item: Item | undefined;
  if (i >= 0 && i < items.length && items[i]?.num === num) {
    item = items[i];
  } else {
    item = items.find((x) => x.num === num);
  }

  const name = item?.name || num;
  const brandText = item?.brand || "—";
  const modelText = item?.carCode || "—";
  const yearText = "—";
  const priceText =
    typeof item?.price === "number"
      ? Number(item?.price).toFixed(2)
      : (item?.price as string | undefined) || "—";
  const stockText =
    typeof item?.count === "number" ? (item!.count >= 0 ? String(item!.count) : "N/A") : "N/A";
  const pics = Array.isArray(item?.pics) ? item!.pics : [];

  const backHref = buildHref("/stock", backParams);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <nav className="text-sm mb-4">
        <Link href="/" className="text-gray-500 hover:underline">首页</Link>
        <span className="mx-2">/</span>
        <Link href={backHref} prefetch={false} className="text-gray-500 hover:underline">
          库存预览
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">商品详情</span>
      </nav>

      <h1 className="text-xl font-semibold mb-4">Product Detail</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 图片画廊 */}
        <div>
          <div className="aspect-[4/3] rounded-xl border bg-white flex items-center justify-center overflow-hidden">
            {pics.length > 0 ? (
              <img
                src={pics[0]}
                alt={name}
                className="w-full h-full object-contain"
                loading="eager"
              />
            ) : (
              <img
                src="https://dummyimage.com/800x600/eeeeee/aaaaaa&text=No+Image"
                alt="No image"
                className="w-full h-full object-contain"
                loading="eager"
              />
            )}
          </div>

          {/* 缩略图 */}
          {pics.length > 1 && (
            <div className="mt-3 grid grid-cols-5 sm:grid-cols-6 md:grid-cols-5 gap-2">
              {pics.slice(0, 10).map((p, idx) => (
                <a
                  key={p}
                  href={p}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block border rounded-lg overflow-hidden bg-white"
                  title={`图片 ${idx + 1}`}
                >
                  <img
                    src={p}
                    alt={`thumb ${idx + 1}`}
                    className="w-full h-20 object-contain"
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* 右侧信息 */}
        <div className="space-y-2">
          <div className="text-sm text-gray-500">Num: {num}</div>
          <div className="text-lg font-medium">{name}</div>
          <div className="text-sm text-gray-700">Brand: {brandText}</div>
          <div className="text-sm text-gray-700">Model: {modelText}</div>
          <div className="text-sm text-gray-700">Year: {yearText}</div>
          <div className="text-emerald-600 text-xl font-semibold mt-2">
            {priceText !== "—" ? `${priceText}` : "—"}
          </div>
          <div className="text-sm text-gray-700">Stock: {stockText}</div>

          <div className="pt-4">
            <Link
              href={backHref}
              prefetch={false}
              className="inline-flex items-center px-4 py-2 rounded-md border hover:bg-gray-50"
            >
              ← 返回列表
            </Link>
          </div>

          <div className="text-xs text-gray-400 pt-6">
            数据源： niuniuparts.com（测试预览用途）
          </div>
        </div>
      </div>
    </div>
  );
}

