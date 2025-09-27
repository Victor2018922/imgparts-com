// 库存页：SSR + 搜索 + 排序
// - ?q= 关键词（匹配 num/oe/brand/product/model）
// - ?sort= price_asc | price_desc | stock_desc
// - 浏览模式：仍按页浏览 ?p= & 每页 20
// - 搜索模式：并发小批量扫描最多 MAX_SCAN_PAGES，早停；每条结果保留其来源页 _page
// - 详情链接携带 ?p=来源页&s=20，保持详情页秒开

import Link from "next/link";

type Item = {
  num?: string;
  brand?: string;
  product?: string;
  oe?: string;
  model?: string;
  year?: string | number;
  price?: string | number;
  stock?: string | number;
  image?: string;
  images?: string[];
  pics?: string[];
  gallery?: string[];
  imageUrls?: string[];
  [k: string]: any;
};

type Row = Item & { _page?: number };

const API_BASE = "https://niuniuparts.com:6001/scm-product/v1/stock2";
const SIZE = 20;
const MAX_SCAN_PAGES = 8;    // 搜索最多扫描 8 页
const BATCH = 3;             // 并发批量
const REQ_TIMEOUT = 5000;    // 单页 5s 超时

function toInt(v: unknown, def: number) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : def;
}

async function fetchPageOnce(page: number, size: number, timeoutMs = REQ_TIMEOUT): Promise<Item[]> {
  const url = `${API_BASE}?size=${size}&page=${page}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!resp.ok) return [];
    const data = await resp.json();
    if (Array.isArray(data)) return data as Item[];
    if (Array.isArray((data as any)?.content)) return (data as any).content as Item[];
    if (Array.isArray((data as any)?.data)) return (data as any).data as Item[];
    return [];
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

async function fetchPageStable(page: number, size: number): Promise<Item[]> {
  // 最多 2 次快速重试
  for (let i = 0; i < 2; i++) {
    const rows = await fetchPageOnce(page, size, REQ_TIMEOUT);
    if (rows.length) return rows;
  }
  return [];
}

function norm(s: any) {
  return String(s ?? "").toLowerCase();
}

function matchQuery(it: Item, q: string) {
  if (!q) return true;
  const k = q.toLowerCase();
  return (
    norm(it.num).includes(k) ||
    norm(it.oe).includes(k) ||
    norm(it.brand).includes(k) ||
    norm(it.product).includes(k) ||
    norm(it.model).includes(k)
  );
}

function sortRows(rows: Row[], sort: string) {
  if (!sort) return rows;
  const cp = [...rows];
  if (sort === "price_asc") {
    cp.sort((a, b) => Number(a.price ?? 0) - Number(b.price ?? 0));
  } else if (sort === "price_desc") {
    cp.sort((a, b) => Number(b.price ?? 0) - Number(a.price ?? 0));
  } else if (sort === "stock_desc") {
    cp.sort((a, b) => Number(b.stock ?? 0) - Number(a.stock ?? 0));
  }
  return cp;
}

function primaryImage(it: Item): string {
  const raw: string[] =
    it.images || it.pics || it.gallery || it.imageUrls || (it.image ? [it.image] : []) || [];
  const seen = new Set<string>();
  const cleaned = raw
    .filter(Boolean)
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter((s) => s.length > 0)
    .filter((u) => {
      const key = u.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const placeholder =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAQAAABx0wduAAAAAklEQVR42u3BMQEAAADCoPVPbQ0PoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8JwC0QABG4zJSwAAAABJRU5ErkJggg==";
  return cleaned[0] || placeholder;
}

function titleOf(it: Item) {
  return [it.brand, it.product, it.oe, it.num].filter(Boolean).join(" | ");
}

export default async function StockPage({
  searchParams,
}: {
  searchParams?: { [k: string]: string | string[] | undefined };
}) {
  const p = toInt((searchParams?.p as string) ?? "0", 0);
  const q = ((searchParams?.q as string) || "").trim();
  const sort = ((searchParams?.sort as string) || "").trim();

  let rows: Row[] = [];
  let hasNext = false;

  if (!q) {
    // 浏览模式：只取当前页，保持速度与稳定
    const pageRows = await fetchPageStable(p, SIZE);
    rows = pageRows.map((r) => ({ ...r, _page: p }));
    hasNext = pageRows.length === SIZE;
  } else {
    // 搜索模式：从第 0 页开始按批次并发扫描，早停
    let found: Row[] = [];
    let reachedEnd = false;
    for (let start = 0; start < MAX_SCAN_PAGES && !reachedEnd; start += BATCH) {
      const batchPages = Array.from({ length: Math.min(BATCH, MAX_SCAN_PAGES - start) }, (_, i) => start + i);
      const lists = await Promise.all(batchPages.map((pg) => fetchPageStable(pg, SIZE)));
      for (let i = 0; i < lists.length; i++) {
        const pg = batchPages[i];
        const filtered = lists[i].filter((it) => matchQuery(it, q)).map((it) => ({ ...it, _page: pg }));
        found.push(...filtered);
        if (lists[i].length < SIZE) reachedEnd = true;
      }
      // 早停：搜到足够多（例如 60 条）就停止
      if (found.length >= 60) break;
    }
    rows = found;
    hasNext = false; // 搜索模式不展示“下一页”，可改为“继续扫描更多”在后续迭代
  }

  // 排序（仅对当前 rows）
  rows = sortRows(rows, sort);

  // 预加载首屏若干图片
  const preloadImgs = rows.slice(0, 8).map(primaryImage);

  // 构建顶部/底部控件的链接
  const baseQuery = (extra: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sort) params.set("sort", sort);
    if (typeof extra.p !== "undefined") params.set("p", String(extra.p));
    return `/stock${params.toString() ? "?" + params.toString() : ""}`;
  };

  const prevHref = !q && p > 0 ? baseQuery({ p: p - 1 }) : "#";
  const nextHref = !q && hasNext ? baseQuery({ p: p + 1 }) : "#";

  return (
    <>
      {preloadImgs.map((src, i) => (
        <link key={`preload-${i}`} rel="preload" as="image" href={src} />
      ))}

      <main style={{ padding: "24px 0" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>库存预览</h1>

        {/* 搜索与排序条（GET 提交，SSR 渲染，稳定） */}
        <form method="GET" action="/stock" style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, marginBottom: 12 }}>
          <input
            name="q"
            defaultValue={q}
            placeholder="输入 OE / 品名 / 品牌 / 车型 进行搜索"
            aria-label="搜索"
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb" }}
          />
          <select
            name="sort"
            defaultValue={sort}
            aria-label="排序"
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff" }}
          >
            <option value="">默认排序</option>
            <option value="price_asc">价格从低到高</option>
            <option value="price_desc">价格从高到低</option>
            <option value="stock_desc">库存从高到低</option>
          </select>
          <button
            type="submit"
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #111827",
              background: "#111827",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            搜索
          </button>
        </form>

        {/* 浏览模式才展示页码条 */}
        {!q && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, fontSize: 14 }}>
            <Link
              href={prevHref}
              aria-disabled={p === 0}
              style={{
                pointerEvents: p === 0 ? "none" : "auto",
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: p === 0 ? "#f3f4f6" : "#fff",
                color: "#111827",
                textDecoration: "none",
              }}
            >
              上一页
            </Link>
            <Link
              href={nextHref}
              aria-disabled={!hasNext}
              style={{
                pointerEvents: !hasNext ? "none" : "auto",
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: !hasNext ? "#f3f4f6" : "#fff",
                color: "#111827",
                textDecoration: "none",
              }}
            >
              下一页
            </Link>
            <span style={{ color: "#6b7280" }}>当前第 {p + 1} 页</span>
          </div>
        )}

        {/* 列表 */}
        {rows.length === 0 ? (
          <div style={{ padding: 24 }}>{q ? "未找到匹配结果，请更换关键词" : "暂无数据或加载失败，请刷新重试"}</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
            {rows.map((it) => {
              const srcPage = typeof it._page === "number" ? it._page : p;
              const href = `/stock/${encodeURIComponent(String(it.num ?? ""))}?p=${srcPage}&s=${SIZE}`;
              const img = primaryImage(it);
              const title = titleOf(it);
              return (
                <div
                  key={String(it.num)}
                  style={{
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <Link href={href} title="查看详情" prefetch>
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        overflow: "hidden",
                        borderRadius: 10,
                        background: "#fff",
                        border: "1px solid #f3f4f6",
                      }}
                    >
                      <img
                        src={img}
                        alt={String(it.product ?? "product")}
                        loading="eager"
                        fetchPriority="high"
                        decoding="sync"
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    </div>
                  </Link>

                  <Link
                    href={href}
                    title={title}
                    prefetch
                    style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.35, textDecoration: "none", color: "#111827" }}
                  >
                    {title}
                  </Link>

                  <div style={{ fontSize: 12, color: "#4b5563", display: "grid", gap: 4 }}>
                    {it.oe && <div>OE：{it.oe}</div>}
                    {typeof it.price !== "undefined" && <div>价格：{String(it.price)}</div>}
                    {typeof it.stock !== "undefined" && <div>库存：{String(it.stock)}</div>}
                  </div>

                  <div style={{ marginTop: "auto" }}>
                    <Link
                      href={href}
                      prefetch
                      aria-label="查看详情"
                      title="查看详情"
                      style={{
                        display: "inline-block",
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "#fff",
                        color: "#111827",
                        border: "1px solid #e5e7eb",
                        textAlign: "center",
                        textDecoration: "none",
                        width: "100%",
                      }}
                    >
                      查看详情
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 浏览模式才展示底部分页 */}
        {!q && (
          <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
            <Link
              href={prevHref}
              aria-disabled={p === 0}
              style={{
                pointerEvents: p === 0 ? "none" : "auto",
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: p === 0 ? "#f3f4f6" : "#fff",
                color: "#111827",
                textDecoration: "none",
              }}
            >
              上一页
            </Link>
            <Link
              href={nextHref}
              aria-disabled={!hasNext}
              style={{
                pointerEvents: !hasNext ? "none" : "auto",
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: !hasNext ? "#f3f4f6" : "#fff",
                color: "#111827",
                textDecoration: "none",
              }}
            >
              下一页
            </Link>
            <span style={{ alignSelf: "center", color: "#6b7280" }}>第 {p + 1} 页</span>
          </div>
        )}
      </main>
    </>
  );
}

