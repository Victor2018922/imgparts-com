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
  // 在 Vercel/代理后：从请求头安全推导站点 origin，避免相对路径在 SSR 中出错
  const h = headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("x-forwarded-host") || h.get("host");
  if (host) return `${proto}://${host}`;
  // 本地或极端情况的兜底（可按需改成你的域名）
  return process.env.NEXT_PUBLIC_SITE_URL || "https://imgparts-com.vercel.app";
}

export default async function StockPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const size = Number(searchParams?.size ?? 20);
  const page = Number(searchParams?.page ?? 0);

  const qs = new URLSearchParams({
    size: String(size),
    page: String(page),
  }).toString();

  // —— 关键：构造绝对 URL，并且任何错误都不让页面崩溃 ——
  let items: Item[] = [];
  try {
    const origin = getOriginFromHeaders();
    const url = `${origin}/api/stock?${qs}`;

    const res = await fetch(url, {
      // 禁缓存，避免旧数据/代理问题
      cache: "no-store",
      // 强制 SSR 立即取新
      next: { revalidate: 0 },
      // 超时/网络问题有时会抛异常，try/catch 兜底
    });

    if (res.ok) {
      const json = await res.json().catch(() => null);
      const data = (json as any)?.data;
      if (Array.isArray(data)) items = data as Item[];
    }
  } catch (e) {
    // 保持 items = []，页面继续渲染
  }

  const prevPage = Math.max(0, page - 1);
  const nextPage = page + 1;
  const prevHref = `/stock?size=${size}&page=${prevPage}`;
  const nextHref = `/stock?size=${size}&page=${nextPage}`;
  const isLastPage = items.length < size; // 简单末页判定

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">库存预览</h1>

        {/* 每页数量切换 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">每页数量</span>
          <nav className="flex rounded-md overflow-hidden border">
            {[12, 20, 30, 40].map((n) => {
              const href = `/stock?size=${n}&page=0`;
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

      {/* 卡片网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
        {items.map((it) => {
          const thumb =
            (it.pics && it.pics[0]) ||
            "https://dummyimage.com/640x480/eeeeee/aaaaaa&text=No+Image";

          return (
            <Link
              key={it.num}
              href={`/stock/${encodeURIComponent(it.num)}`}
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
                <div className="text-sm text-gray-500 mb-1">{it.num}</div>
                <div className="font-medium leading-snug min-h-[40px]">
                  {it.name}
                </div>
                <div className="mt-2 text-emerald-600 font-semibold">
                  {typeof it.price === "number" ? it.price.toFixed(2) : it.price ?? ""}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {items.length === 0 && (
        <div className="text-center text-gray-500 py-16">
          本页暂无数据（接口无响应或已到末页）
        </div>
      )}

      {/* 分页条 */}
      <div className="flex items-center justify-between mt-8">
        <div className="text-sm text-gray-500">当前第 {page + 1} 页</div>

        <div className="flex items-center gap-3">
          <Link
            href={prevHref}
            prefetch={false}
            className={cn(
              "px-4 py-2 rounded-md border",
              page <= 0 && "pointer-events-none opacity-40"
            )}
            aria-disabled={page <= 0}
          >
            上一页
          </Link>

          <Link
            href={nextHref}
            prefetch={false}
            className={cn(
              "px-4 py-2 rounded-md border",
              isLastPage && "pointer-events-none opacity-40"
            )}
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
