import Link from "next/link";

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

  // 拉取当前页数据
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/stock?${qs}`, {
    // 保证每次刷新取新数据
    cache: "no-store",
  });

  let items: Item[] = [];
  if (res.ok) {
    const json = await res.json();
    items = Array.isArray(json?.data) ? (json.data as Item[]) : [];
  }

  // 分页链接（上一页/下一页）
  const prevPage = Math.max(0, page - 1);
  const nextPage = page + 1;

  const prevHref = `/stock?size=${size}&page=${prevPage}`;
  const nextHref = `/stock?size=${size}&page=${nextPage}`;

  // 到达末尾的简单判定：返回数量 < size 就认为是最后一页
  const isLastPage = items.length < size;

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
              {/* 图片 */}
              {/* 直接用 <img>，保持与现有外链兼容 */}
              <div className="aspect-[4/3] bg-white flex items-center justify-center overflow-hidden">
                <img
                  src={thumb}
                  alt={it.name ?? it.num}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>

              {/* 文本 */}
              <div className="p-3">
                <div className="text-sm text-gray-500 mb-1">{it.num}</div>
                <div className="font-medium leading-snug line-clamp-2 min-h-[40px]">
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

      {/* 空状态 */}
      {items.length === 0 && (
        <div className="text-center text-gray-500 py-16">本页暂无数据</div>
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

      {/* 数据源标注（仅一处） */}
      <footer className="mt-10 text-xs text-gray-400">
        数据源： niuniuparts.com（测试预览用途）
      </footer>
    </div>
  );
}
