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
  specs?: string;
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
  const specsText = item?.specs || ""; // 目前 API 里为空，预留字段

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

  const picsJson = JSON.stringify(pics);

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
                className="w-full h-full object-contain cursor-zoom-in"
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

              <div id="thumb-strip" className="overflow-x-auto scroll-smooth pr-8 pl-8">
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
                      data-index={tIdx}
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

      {/* 产品参数区块 */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold mb-3">产品参数</h2>
        <div className="border rounded-xl overflow-hidden">
          <dl className="grid grid-cols-1 sm:grid-cols-2">
            <div className="px-4 py-3 border-b sm:border-b sm:border-r">
              <dt className="text-xs text-gray-500 mb-1">商品编号（Num）</dt>
              <dd className="text-sm text-gray-900">{num}</dd>
            </div>
            <div className="px-4 py-3 border-b">
              <dt className="text-xs text-gray-500 mb-1">品牌（Brand）</dt>
              <dd className="text-sm text-gray-900">{brandText}</dd>
            </div>
            <div className="px-4 py-3 border-b sm:border-r">
              <dt className="text-xs text-gray-500 mb-1">OE 编号</dt>
              <dd className="text-sm text-gray-900">{oeText}</dd>
            </div>
            <div className="px-4 py-3 border-b">
              <dt className="text-xs text-gray-500 mb-1">适配车型（Model）</dt>
              <dd className="text-sm text-gray-900">{modelText}</dd>
            </div>
            <div className="px-4 py-3 sm:border-r">
              <dt className="text-xs text-gray-500 mb-1">库存（Stock）</dt>
              <dd className="text-sm text-gray-900">{stockText}</dd>
            </div>
            <div className="px-4 py-3">
              <dt className="text-xs text-gray-500 mb-1">价格（Price）</dt>
              <dd className="text-sm text-gray-900">{priceText !== "—" ? priceText : "—"}</dd>
            </div>
          </dl>
          {specsText && (
            <div className="px-4 py-3 border-t text-sm text-gray-700">
              {specsText}
            </div>
          )}
        </div>
      </section>

      {/* 灯箱（放大预览） */}
      <div
        id="lightbox"
        className="hidden fixed inset-0 z-50 bg-black/80"
        role="dialog"
        aria-modal="true"
      >
        <button
          id="lb-close"
          aria-label="关闭"
          className="absolute top-4 right-4 text-white text-3xl leading-none px-3"
        >
          ×
        </button>

        <button
          id="lb-prev"
          aria-label="上一张"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-white text-4xl px-3"
        >
          ‹
        </button>
        <button
          id="lb-next"
          aria-label="下一张"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white text-4xl px-3"
        >
          ›
        </button>

        <div className="w-full h-full flex items-center justify-center p-4">
          <img
            id="lb-img"
            src=""
            alt="preview"
            className="max-w-[96%] max-h-[92%] object-contain select-none"
            draggable={false}
          />
        </div>
      </div>

      {/* 交互脚本：复制、画廊、缩略滚动、灯箱 */}
      <Script id="detail-interactions" strategy="afterInteractive">
        {`
          (function(){
            // 提供图片数组给脚本
            window.__PICS = ${picsJson};

            // ========== 复制 ==========
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

            // ========== 画廊（缩略图切换大图） ==========
            var mainImg = document.getElementById('main-img');
            var strip = document.getElementById('thumb-strip');
            var btns = document.querySelectorAll('.thumb-btn');
            var currentIndex = 0;

            function setActiveByIndex(i){
              btns.forEach(function(b){ b.classList.remove('ring-2','ring-emerald-500'); });
              if (btns[i]) btns[i].classList.add('ring-2','ring-emerald-500');
              currentIndex = i;
            }

            btns.forEach(function(b){
              b.addEventListener('click', function(){
                var idx = Number(b.getAttribute('data-index') || '0');
                var src = b.getAttribute('data-src');
                if (src && mainImg) {
                  mainImg.setAttribute('src', src);
                  setActiveByIndex(idx);
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
            document.addEventListener('keydown', function(e){
              if (e.key === 'ArrowLeft') scrollByAmount(-1);
              if (e.key === 'ArrowRight') scrollByAmount(1);
            });

            // ========== 灯箱（放大预览） ==========
            var lb = document.getElementById('lightbox');
            var lbImg = document.getElementById('lb-img');
            var lbClose = document.getElementById('lb-close');
            var lbPrev = document.getElementById('lb-prev');
            var lbNext = document.getElementById('lb-next');
            var PICS = Array.isArray(window.__PICS) ? window.__PICS : [];

            function openLightbox(index){
              if (!PICS.length) return;
              currentIndex = Math.max(0, Math.min(index || 0, PICS.length - 1));
              if (lb && lbImg) {
                lbImg.src = PICS[currentIndex];
                lb.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
                preloadAround(currentIndex);
              }
            }
            function closeLightbox(){
              if (lb) {
                lb.classList.add('hidden');
                document.body.style.overflow = '';
              }
            }
            function showIndex(i){
              if (!PICS.length) return;
              currentIndex = (i + PICS.length) % PICS.length;
              if (lbImg) lbImg.src = PICS[currentIndex];
              setActiveByIndex(currentIndex);
              preloadAround(currentIndex);
            }
            function preloadAround(i){
              [i-1, i+1].forEach(function(k){
                if (k >=0 && k < PICS.length){
                  var img = new Image();
                  img.src = PICS[k];
                }
              });
            }

            // 点击大图打开
            if (mainImg) {
              mainImg.addEventListener('click', function(){
                var idx = currentIndex || 0;
                openLightbox(idx);
              });
            }
            // 灯箱按钮/遮罩/ESC
            if (lbClose) lbClose.addEventListener('click', closeLightbox);
            if (lbPrev) lbPrev.addEventListener('click', function(){ showIndex(currentIndex - 1); });
            if (lbNext) lbNext.addEventListener('click', function(){ showIndex(currentIndex + 1); });
            if (lb) {
              lb.addEventListener('click', function(e){
                // 点击黑色遮罩关闭（点图片不关）
                if (e.target === lb) closeLightbox();
              });
            }
            document.addEventListener('keydown', function(e){
              if (lb && !lb.classList.contains('hidden')) {
                if (e.key === 'Escape') closeLightbox();
                if (e.key === 'ArrowLeft') showIndex(currentIndex - 1);
                if (e.key === 'ArrowRight') showIndex(currentIndex + 1);
              }
            });

            // 触控滑动（灯箱）
            var startX = 0, startY = 0, moved = false;
            function onTouchStart(e){
              var t = e.touches && e.touches[0];
              if (!t) return;
              startX = t.clientX; startY = t.clientY; moved = false;
            }
            function onTouchMove(e){
              moved = true;
            }
            function onTouchEnd(e){
              if (!moved) return;
              var t = e.changedTouches && e.changedTouches[0];
              if (!t) return;
              var dx = t.clientX - startX;
              var dy = t.clientY - startY;
              if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40){
                if (dx < 0) showIndex(currentIndex + 1); else showIndex(currentIndex - 1);
              }
            }
            if (lb) {
              lb.addEventListener('touchstart', onTouchStart, {passive:true});
              lb.addEventListener('touchmove', onTouchMove, {passive:true});
              lb.addEventListener('touchend', onTouchEnd, {passive:true});
            }
          })();
        `}
      </Script>
    </div>
  );
}


