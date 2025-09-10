import Link from "next/link";
import { headers } from "next/headers";
import Script from "next/script";

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
function toNumOrNull(val: unknown): number | null {
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

  // 从列表页保留过来的参数（用于返回与 Prev/Next）
  const size = n(searchParams?.size, 20);
  const page = n(searchParams?.page, 0);
  const i = n(searchParams?.i, -1);
  const brand = s(searchParams?.brand, "");
  const q = s(searchParams?.q, "");
  const sort = s(searchParams?.sort, "default");
  const hasPic = s(searchParams?.hasPic, "") === "1";
  const minPrice = toNumOrNull(searchParams?.minPrice);
  const maxPrice = toNumOrNull(searchParams?.maxPrice);

  const sharedParams: Record<string, any> = {
    size,
    page,
    brand: brand || undefined,
    q: q || undefined,
    sort: sort !== "default" ? sort : undefined,
    hasPic: hasPic ? 1 : undefined,
    minPrice: minPrice ?? undefined,
    maxPrice: maxPrice ?? undefined,
  };

  // 拉取该页数据（用于拿到该条目与同页前后条）
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

  // 优先用列表传来的索引 i；否则按 num 匹配
  let idx = i;
  if (!(idx >= 0 && idx < items.length && items[idx]?.num === num)) {
    idx = Math.max(0, items.findIndex((x) => x.num === num));
  }
  const item: Item | undefined = items[idx];

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
  const oeText = item?.oe || "—";

  const backHref = buildHref("/stock", sharedParams);

  // 同页的上一条/下一条
  const hasPrev = idx > 0 && idx < items.length;
  const hasNext = idx >= 0 && idx < items.length - 1;

  const prevHref =
    hasPrev && items[idx - 1]
      ? buildHref(`/stock/${encodeURIComponent(items[idx - 1].num)}`, {
          ...sharedParams,
          i: idx - 1,
        })
      : null;

  const nextHref =
    hasNext && items[idx + 1]
      ? buildHref(`/stock/${encodeURIComponent(items[idx + 1].num)}`, {
          ...sharedParams,
          i: idx + 1,
        })
      : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* 复制提示气泡 */}
      <div id="copy-toast" className="hidden fixed top-4 right-4 z-50 rounded-md border bg-white px-3 py-2 text-sm shadow">
        已复制
      </div>

      {/* 顶部导航 + 上一条/下一条 */}
      <nav className="text-sm mb-4 flex flex-wrap items-center gap-2">
        <Link href="/" className="text-gray-500 hover:underline">首页</Link>
        <span className="mx-1">/</span>
        <Link href={backHref} prefetch={false} className="text-gray-500 hover:underline">
          库存预览
        </Link>
        <span className="mx-1">/</span>
        <span className="text-gray-900">商品详情</span>

        <span className="flex-1" />
        <div className="flex items-center gap-2">
          <Link
            href={prevHref || "#"}
            prefetch={false}
            aria-disabled={!prevHref}
            className={cn(
              "inline-flex items-center px-3 py-1.5 rounded-md border text-sm",
              prevHref ? "hover:bg-gray-50" : "opacity-40 cursor-not-allowed"
            )}
          >
            ← 上一条
          </Link>
          <Link
            href={nextHref || "#"}
            prefetch={false}
            aria-disabled={!nextHref}
            className={cn(
              "inline-flex items-center px-3 py-1.5 rounded-md border text-sm",
              nextHref ? "hover:bg-gray-50" : "opacity-40 cursor-not-allowed"
            )}
          >
            下一条 →
          </Link>
        </div>
      </nav>

      <h1 className="text-xl font-semibold mb-4">Product Detail</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 图片区 */}
        <div>
          <div className="relative">
            <div className="aspect-[4/3] rounded-xl border bg-white flex items-center justify-center overflow-hidden">
              <img
                id="main-img"
                src={pics[0] || "https://dummyimage.com/800x600/eeeeee/aaaaaa&text=No+Image"}
                alt={name}
                className="w-full h-full object-contain"
                loading="eager"
              />
            </div>
          </div>

          {/* 缩略图条：可横向滚动 + 左右箭头 */}
          {pics.length > 1 && (
            <div className="relative mt-3">
              <button
                type="button"
                aria-label="Scroll left"
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 rounded-full border bg-white/90 px-2 py-2 shadow hover:bg-white"
                id="thumb-left"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Scroll right"
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 rounded-full border bg-white/90 px-2 py-2 shadow hover:bg-white"
                id="thumb-right"
              >
                ›
              </button>

              <div
                id="thumb-strip"
                className="overflow-x-auto scroll-smooth pr-8 pl-8"
              >
                <div className="flex gap-2 min-w-full">
                  {pics.slice(0, 20).map((p, tIdx) => (
                    <button
                      key={p}
                      type="button"
                      className={cn(
                        "thumb-btn block border rounded-lg overflow-hidden bg-white shrink-0",
                        tIdx === 0 ? "ring-2 ring-emerald-500" : "hover:border-gray-400"
                      )}
                      data-src={p}
                      title={`图片 ${tIdx + 1}`}
                    >
                      <img
                        src={p}
                        alt={`thumb ${tIdx + 1}`}
                        className="w-28 h-20 object-contain"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 右侧信息 */}
        <div className="space-y-2">
          <div className="text-sm text-gray-500 flex items-center gap-2">
            <span>Num: {num}</span>
            <button
              id="copy-num"
              data-copy={num}
              type="button"
              className="px-2 py-0.5 text-xs rounded border hover:bg-gray-50"
              title="复制编号"
            >
              复制编号
            </button>
          </div>

          <div className="text-lg font-medium">{name}</div>
          <div className="text-sm text-gray-700">Brand: {brandText}</div>
          <div className="text-sm text-gray-700">Model: {modelText}</div>
          <div className="text-sm text-gray-700">Year: {yearText}</div>

          <div className="text-sm text-gray-700 flex items-center gap-2">
            <span>OE: {oeText}</span>
            {oeText !== "—" && (
              <button
                id="copy-oe"
                data-copy={oeText}
                type="button"
                className="px-2 py-0.5 text-xs rounded border hover:bg-gray-50"
                title="复制 OE"
              >
                复制 OE
              </button>
            )}
          </div>

          <div className="text-emerald-600 text-xl font-semibold mt-2">
            {priceText !== "—" ? `${priceText}` : "—"}
          </div>
          <div className="text-sm text-gray-700">Stock: {stockText}</div>

          <div className="pt-4 flex gap-3">
            <Link
              href={backHref}
              prefetch={false}
              className="inline-flex items-center px-4 py-2 rounded-md border hover:bg-gray-50"
            >
              ← 返回列表
            </Link>
            <Link
              href={prevHref || "#"}
              prefetch={false}
              aria-disabled={!prevHref}
              className={cn(
                "inline-flex items-center px-3 py-2 rounded-md border",
                prevHref ? "hover:bg-gray-50" : "opacity-40 cursor-not-allowed"
              )}
            >
              上一条
            </Link>
            <Link
              href={nextHref || "#"}
              prefetch={false}
              aria-disabled={!nextHref}
              className={cn(
                "inline-flex items-center px-3 py-2 rounded-md border",
                nextHref ? "hover:bg-gray-50" : "opacity-40 cursor-not-allowed"
              )}
            >
              下一条
            </Link>
          </div>

          <div className="text-xs text-gray-400 pt-6">
            数据源： niuniuparts.com（测试预览用途）
          </div>
        </div>
      </div>

      {/* 内联脚本：复制 + 画廊交互 + 缩略条滚动 */}
      <Script id="detail-interactions" strategy="afterInteractive">
        {`
          (function(){
            // 复制提示
            function showToast(msg){
              var el = document.getElementById('copy-toast');
              if(!el) return;
              el.textContent = msg || '已复制';
              el.classList.remove('hidden');
              clearTimeout(window.__copy_toast_timer);
              window.__copy_toast_timer = setTimeout(function(){
                el.classList.add('hidden');
              }, 1200);
            }
            function bindCopy(btnId){
              var b = document.getElementById(btnId);
              if(!b) return;
              b.addEventListener('click', function(){
                var text = b.getAttribute('data-copy') || '';
                if (!text) return;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(text).then(function(){
                    showToast('已复制：' + text);
                  }, function(){
                    fallbackCopy(text);
                  });
                } else {
                  fallbackCopy(text);
                }
              });
            }
            function fallbackCopy(text){
              var ta = document.createElement('textarea');
              ta.value = text;
              ta.style.position = 'fixed';
              ta.style.left = '-9999px';
              document.body.appendChild(ta);
              ta.select();
              try { document.execCommand('copy'); showToast('已复制：' + text); } catch(e) {}
              document.body.removeChild(ta);
            }
            bindCopy('copy-num');
            bindCopy('copy-oe');

            // 画廊：点击缩略图切换大图 + 高亮边框
            var mainImg = document.getElementById('main-img');
            var strip = document.getElementById('thumb-strip');
            var btns = document.querySelectorAll('.thumb-btn');
            function setActive(btn){
              btns.forEach(function(b){ b.classList.remove('ring-2','ring-emerald-500'); });
              btn.classList.add('ring-2','ring-emerald-500');
            }
            btns.forEach(function(b){
              b.addEventListener('click', function(){
                var src = b.getAttribute('data-src');
                if (src && mainImg) {
                  mainImg.setAttribute('src', src);
                  setActive(b);
                }
              });
            });

            // 缩略条左右滚动
            var left = document.getElementById('thumb-left');
            var right = document.getElementById('thumb-right');
            function scrollByAmount(dir){
              if (!strip) return;
              var step = 160;
              strip.scrollBy({ left: dir * step, behavior: 'smooth' });
            }
            if (left) left.addEventListener('click', function(){ scrollByAmount(-1); });
            if (right) right.addEventListener('click', function(){ scrollByAmount(1); });

            // 键盘左右键也可滚动缩略条
            document.addEventListener('keydown', function(e){
              if (!strip) return;
              if (e.key === 'ArrowLeft') scrollByAmount(-1);
              if (e.key === 'ArrowRight') scrollByAmount(1);
            });
          })();
        `}
      </Script>
    </div>
  );
}

