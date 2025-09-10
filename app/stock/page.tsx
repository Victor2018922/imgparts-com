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
function fnum(v: unknown): number | null {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}
function toNumber(val: unknown): number | null {
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}
function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
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

export default async function StockPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  // 基础分页
  const size = n(searchParams?.size, 20);
  const page = n(searchParams?.page, 0);

  // 已有筛选/排序
  const brand = (searchParams?.brand as string | undefined) || "";
  const q = (searchParams?.q as string | undefined)?.trim() || "";
  const sort = (searchParams?.sort as string | undefined) || "default";

  // 新增：只看有图 + 价格区间
  const hasPic = (searchParams?.hasPic as string | undefined) === "1"; // 1 表示开启
  const minPrice = fnum(searchParams?.minPrice) ?? null;
  const maxPrice = fnum(searchParams?.maxPrice) ?? null;

  const baseParams = { size, page, brand, q, sort, hasPic: hasPic ? 1 : undefined, minPrice, maxPrice };

  // 拉取当前页数据
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
    // 忽略
  }

  // —— 在“当前页数据”上做雏形筛选 —— //
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
  if (hasPic) {
    filtered = filtered.filter((it) => Array.isArray(it.pics) && it.pics.length > 0);
  }
  if (minPrice !== null || maxPrice !== null) {
    filtered = filtered.filter((it) => {
      const p = toNumber(it.price);
      if (p === null) return false;
      if (minPrice !== null && p < minPrice) return false;
      if (maxPrice !== null && p > maxPrice) return false;
      return true;
    });
  }

  // 排序
  if (sort === "price_asc" || sort === "price_desc") {
    filtered.sort((a, b) => {
      const ap = toNumber(a.price) ?? Number.POSITIVE_INFINITY;
      const bp = toNumber(b.price) ?? Number.POSITIVE_INFINITY;
      return sort === "price_asc" ? ap - bp : bp - ap;
    });
  } else if (sort === "name_asc") {
    filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }

  // 当前页可用品牌
  const brands = uniq(
    items
      .map((x) => (x.brand || "").trim())
      .filter((x) => x && x !== "-")
  ).sort((a, b) => a.localeCompare(b));

  // 分页链接
  const prevPage = Math.max(0, page - 1);
  const nextPage = page + 1;
  const isLastPage = items.length < size;

  const prevHref = buildHref("/stock", { ...baseParams, page: prevPage });
  const nextHref = buildHref("/stock", { ...baseParams, page: nextPage });

  const sizeOptions = [12, 20, 30, 40];

  // 构建一个工具：提交“价格区间”的链接（由于是纯 SSR，我们用链接组合）
  function submitPrice(min: number | null, max: number | null) {
    return buildHref("/stock", {
      ...baseParams,
      page: 0,
      minPrice: min ?? undefined,
      maxPrice: max ?? undefined,
    });
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* 顶部标题 + 每页数量 */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
        <h1 className="text-xl font-semibold">库存预览</h1>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">每页数量</span>
          <nav className="flex rounded-md overflow-hidden border">
            {sizeOptions.map((n) => {
              const href = buildHref("/stock", { ...baseParams, size: n, page: 0 });
              const active = n === size;
              return (
                <Link
                  key={n}
                  href={href}
                  prefetch={false}
                  className={cn(
                    "px-3 py-1.5 text-sm border-r last:border-r-0",
                    active && "bg-black text-white"
                  )}
                >
                  {n}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* 筛选区 */}
      <section className="mb-4 space-y-3">
        {/* 品牌 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500">品牌</span>
          <Link
            href={buildHref("/stock", { ...baseParams, brand: "", page: 0 })}
            prefetch={false}
            className={cn(
              "px-3 py-1.5 text-sm rounded-full border hover:bg-gray-50",
              !brand && "bg-black text-white hover:bg-black"
            )}
          >
            全部
          </Link>
          {brands.map((b) => (
            <Link
              key={b}
              href={buildHref("/stock", { ...baseParams, brand: b, page: 0 })}
              prefetch={false}
              className={cn(
                "px-3 py-1.5 text-sm rounded-full border hover:bg-gray-50",
                brand.toLowerCase() === b.toLowerCase() && "bg-black text-white hover:bg-black"
              )}
            >
              {b}
            </Link>
          ))}
        </div>

        {/* 常用关键词 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500">常用关键词</span>
          {["保险杠", "马达", "油封", "节温器"].map((kw) => (
            <Link
              key={kw}
              href={buildHref("/stock", { ...baseParams, q: kw, page: 0 })}
              prefetch={false}
              className={cn(
                "px-3 py-1.5 text-sm rounded-full border hover:bg-gray-50",
                q === kw && "bg-black text-white hover:bg-black"
              )}
            >
              {kw}
            </Link>
          ))}
          <Link
            href={buildHref("/stock", { ...baseParams, q: "", page: 0 })}
            prefetch={false}
            className={cn(
              "px-3 py-1.5 text-sm rounded-full border hover:bg-gray-50",
              !q && "opacity-60 pointer-events-none"
            )}
            aria-disabled={!q}
          >
            清除
          </Link>
        </div>

        {/* 只看有图 + 排序 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500">筛选</span>
          <Link
            href={buildHref("/stock", { ...baseParams, hasPic: hasPic ? undefined : 1, page: 0 })}
            prefetch={false}
            className={cn(
              "px-3 py-1.5 text-sm rounded-full border hover:bg-gray-50",
              hasPic && "bg-black text-white hover:bg-black"
            )}
          >
            只看有图
          </Link>

          <span className="ml-3 text-sm text-gray-500">排序</span>
          {[
            { key: "default", label: "综合" },
            { key: "price_asc", label: "价格 ↑" },
            { key: "price_desc", label: "价格 ↓" },
            { key: "name_asc", label: "名称 A-Z" },
          ].map((opt) => (
            <Link
              key={opt.key}
              href={buildHref("/stock", { ...baseParams, sort: opt.key, page: 0 })}
              prefetch={false}
              className={cn(
                "px-3 py-1.5 text-sm rounded-full border hover:bg-gray-50",
                sort === opt.key && "bg-black text-white hover:bg-black"
              )}
            >
              {opt.label}
            </Link>
          ))}

          <Link
            href={buildHref("/stock", { size, page: 0 })}
            prefetch={false}
            className="px-3 py-1.5 text-sm rounded-full border hover:bg-gray-50"
          >
            重置
          </Link>
        </div>

        {/* 价格区间（链接式提交） */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500">价格</span>
          {/* 常用价格快捷键 */}
          {[
            { label: "≤ 50", min: null, max: 50 },
            { label: "50 - 200", min: 50, max: 200 },
            { label: "200 - 500", min: 200, max: 500 },
            { label: "≥ 500", min: 500, max: null },
          ].map((r) => {
            const active =
              (minPrice ?? null) === (r.min ?? null) && (maxPrice ?? null) === (r.max ?? null);
            return (
              <Link
                key={r.label}
                href={submitPrice(r.min, r.max)}
                prefetch={false}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-full border hover:bg-gray-50",
                  active && "bg-black text-white hover:bg-black"
                )}
              >
                {r.label}
              </Link>
            );
          })}

          {/* 清除价格 */}
          <Link
            href={submitPrice(null, null)}
            prefetch={false}
            className={cn(
              "px-3 py-1.5 text-sm rounded-full border hover:bg-gray-50",
              minPrice === null && maxPrice === null && "opacity-60 pointer-events-none"
            )}
            aria-disabled={minPrice === null && maxPrice === null}
          >
            清除价格
          </Link>
        </div>
      </section>

      {/* 统计条 */}
      <div className="text-sm text-gray-600 mb-3">
        共 <strong>{filtered.length}</strong> 条（当前页筛选结果）
        {brand && <> · 品牌：<strong>{brand}</strong></>}
        {q && <> · 关键词：<strong>{q}</strong></>}
        {hasPic && <> · <strong>只看有图</strong></>}
        {(minPrice !== null || maxPrice !== null) && (
          <>
            {" "}
            · 价格：
            <strong>
              {minPrice !== null ? `≥ ${minPrice}` : ""}
              {minPrice !== null && maxPrice !== null ? " & " : ""}
              {maxPrice !== null ? `≤ ${maxPrice}` : ""}
            </strong>
          </>
        )}
        {sort !== "default" && <> · 排序：<strong>{sort}</strong></>}
      </div>

      {/* 列表 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
        {filtered.map((it, i) => {
          const thumb =
            (it.pics && it.pics[0]) ||
            "https://dummyimage.com/640x480/eeeeee/aaaaaa&text=No+Image";
          return (
            <Link
              key={it.num}
              href={buildHref(`/stock/${encodeURIComponent(it.num)}`, {
                size,
                page,
                i,
                brand,
                q,
                sort,
                hasPic: hasPic ? 1 : undefined,
                minPrice: minPrice ?? undefined,
                maxPrice: maxPrice ?? undefined,
              })}
              prefetch={false}
              className="block rounded-xl border hover:shadow-md transition overflow-hidden"
            >
              <div className="aspect-[4/3] bg-white flex items-center justify-center overflow-hidden">
                <img
                  src={thumb}
                  alt={it.name ?? it.num}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
              <div className="p-3">
                <div className="text-sm text-gray-500 mb-1 flex items-center justify-between">
                  <span>{it.num}</span>
                  {it.brand && <span className="ml-2 truncate max-w-[50%]">{it.brand}</span>}
                </div>
                <div className="font-medium leading-snug line-clamp-2 min-h-[40px]">{it.name}</div>
                <div className="mt-2 text-emerald-600 font-semibold">
                  {typeof it.price === "number" ? Number(it.price).toFixed(2) : it.price ?? ""}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-gray-500 py-16">
          当前页无匹配结果（可尝试更换品牌/关键字/排序/价格/只看有图，或切换页码）
        </div>
      )}

      {/* 分页 */}
      <div className="flex items-center justify-between mt-8">
        <div className="text-sm text-gray-500">
          当前第 <strong>{page + 1}</strong> 页
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={prevHref}
            prefetch={false}
            className={cn("px-4 py-2 rounded-md border", page <= 0 && "pointer-events-none opacity-40")}
            aria-disabled={page <= 0}
          >
            上一页
          </Link>

          <Link
            href={nextHref}
            prefetch={false}
            className={cn("px-4 py-2 rounded-md border", isLastPage && "pointer-events-none opacity-40")}
            aria-disabled={isLastPage}
          >
            下一页
          </Link>
        </div>
      </div>

      <footer className="mt-10 text-xs text-gray-400">
        数据源： niuniuparts.com（测试预览用途）
      </footer>
    </div>
  );
}
