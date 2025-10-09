import Link from "next/link";
import { cookies } from "next/headers";
import Script from "next/script";

/* ------------ Types ------------ */
type Item = {
  num?: string; brand?: string; product?: string; oe?: string; model?: string;
  year?: string | number; price?: string | number; stock?: string | number;
  image?: string; images?: string[]; pics?: string[]; gallery?: string[]; imageUrls?: string[];
  productCn?: string; productEn?: string; productNameCn?: string; productNameEn?: string;
  partNameCn?: string; partNameEn?: string; stdNameCn?: string; stdNameEn?: string;
  summary?: string; description?: string; desc?: string; remark?: string;
  [k: string]: any;
};
type Row = Item & { _page?: number };

/* ------------ Const ------------ */
const API_BASE = "https://niuniuparts.com:6001/scm-product/v1/stock2";
const PAGE_SIZE = 20;
const SEARCH_SCAN_SIZE = 200;
const MAX_SCAN_PAGES = 12;
const BATCH = 6;
const REQ_TIMEOUT = 6000;
const EARLY_STOP = 48;

/* ------------ i18n ------------ */
function tFactory(lang: "zh" | "en") {
  return lang === "en"
    ? {
        stockPreview: "Stock Preview",
        searchPH: "Type OE / Product / Brand / Model",
        defaultSort: "Default",
        sortPriceAsc: "Price: Low to High",
        sortPriceDesc: "Price: High to Low",
        sortStockDesc: "Stock: High to Low",
        prev: "Prev", next: "Next", pageN: "Page",
        partName: "Part Name", oe: "OE", price: "Price", stock: "Stock",
        addToCart: "Add to Cart", added: "Added", checkout: "Proceed to Checkout", viewDetail: "View Details",
        submitOrder: "Submit Order", cancel: "Cancel",
        contactName: "Name", phone: "Phone", email: "Email",
        company: "Company", country: "Country", address: "Address", mode: "Mode", note: "Notes",
        currency: "Currency", total: "Total",
        b2c: "B2C", b2b: "B2B",
        emptyCart: "Cart is empty", item: "Item", qty: "Qty",
        submittedTip: "Submitted (Demo): saved to local orders",
        requiredAll: "Please complete all required fields.",
        invalidEmail: "Invalid email format.",
        invalidPhone: "Invalid phone number.",
        downloadTpl: "Download Template", uploadNeeds: "Upload Needs (CSV)", register: "Register/Login",
        needLogin: "Please register/login first.",
        noData: "No data or failed to load, refresh and try again",
        noMatch: "No results, try other keywords",
        myOrders: "My Orders", orders: "Orders", exportCsv: "Export CSV", clearAll: "Clear All", close: "Close",
        createdAt: "Created At",
      }
    : {
        stockPreview: "库存预览",
        searchPH: "输入 OE / 品名 / 品牌 / 车型 进行搜索",
        defaultSort: "默认排序",
        sortPriceAsc: "价格从低到高",
        sortPriceDesc: "价格从高到低",
        sortStockDesc: "库存从高到低",
        prev: "上一页", next: "下一页", pageN: "第",
        partName: "配件名称", oe: "OE", price: "价格", stock: "库存",
        addToCart: "加入购物车", added: "已加入", checkout: "去结算", viewDetail: "查看详情",
        submitOrder: "提交订单", cancel: "取消",
        contactName: "姓名 / Name", phone: "电话 / Phone", email: "邮箱 / Email",
        company: "公司", country: "国家 / Country", address: "地址 / Address", mode: "交易模式", note: "备注 / Notes",
        currency: "货币 / Currency", total: "合计",
        b2c: "B2C", b2b: "B2B",
        emptyCart: "购物车为空", item: "商品", qty: "数量",
        submittedTip: "提交成功（演示）：已保存到本地订单列表",
        requiredAll: "请完整填写所有必填字段。",
        invalidEmail: "邮箱格式不正确。",
        invalidPhone: "电话格式不正确。",
        downloadTpl: "下载模板", uploadNeeds: "上传需求 (CSV)", register: "注册/登录",
        needLogin: "请先完成注册/登录。",
        noData: "暂无数据或加载失败，请刷新重试",
        noMatch: "未找到匹配结果，请更换关键词",
        myOrders: "我的订单", orders: "订单信息", exportCsv: "导出 CSV", clearAll: "清空全部", close: "关闭",
        createdAt: "创建时间",
      };
}

/* ------------ Helpers ------------ */
function toInt(v: unknown, def: number) { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : def; }

async function fetchPageOnce(page: number, size: number, timeoutMs = REQ_TIMEOUT): Promise<Item[]> {
  const url = `${API_BASE}?size=${size}&page=${page}`;
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!resp.ok) return [];
    const data = await resp.json();
    if (Array.isArray(data)) return data as Item[];
    if (Array.isArray((data as any)?.content)) return (data as any).content as Item[];
    if (Array.isArray((data as any)?.data)) return (data as any).data as Item[];
    return [];
  } catch { return []; } finally { clearTimeout(t); }
}
async function fetchPageStable(page: number, size: number): Promise<Item[]> {
  for (let i = 0; i < 2; i++) { const rows = await fetchPageOnce(page, size, REQ_TIMEOUT); if (rows.length) return rows; }
  return [];
}
function norm(s: any) { return String(s ?? "").toLowerCase(); }
function matchQuery(it: Item, q: string) {
  if (!q) return true; const k = q.toLowerCase();
  return norm(it.num).includes(k) || norm(it.oe).includes(k) || norm(it.brand).includes(k) || norm(it.product).includes(k) || norm(it.model).includes(k);
}
function sortRows(rows: Row[], sort: string) {
  if (!sort) return rows;
  const cp = [...rows];
  if (sort === "price_asc") cp.sort((a, b) => Number(a.price ?? 0) - Number(b.price ?? 0));
  else if (sort === "price_desc") cp.sort((a, b) => Number(b.price ?? 0) - Number(a.price ?? 0));
  else if (sort === "stock_desc") cp.sort((a, b) => Number(b.stock ?? 0) - Number(a.stock ?? 0));
  return cp;
}
function hasZh(s: string) { return /[\u4e00-\u9fff]/.test(s); }
function stdCn(it: Item) {
  const arr = [it.stdNameCn, it.productCn, it.productNameCn, it.partNameCn].filter(Boolean) as string[];
  let val = arr.find((x) => String(x).trim().length > 0) || "";
  if (!val) { for (const [k, v] of Object.entries(it)) { if (typeof v === "string" && hasZh(v) && /(std|standard|name|product|part|desc)/.test(k.toLowerCase())) { val = v; break; } } }
  return val;
}
function stdEn(it: Item) {
  const arr = [it.stdNameEn, it.productEn, it.productNameEn, it.partNameEn].filter(Boolean) as string[];
  let val = arr.find((x) => String(x).trim().length > 0) || "";
  if (!val) { for (const [k, v] of Object.entries(it)) { if (typeof v === "string" && !hasZh(v) && /(std|standard|name|product|part|desc|en)/.test(k.toLowerCase())) { val = v; break; } } }
  return val;
}
function cnPartToEn(cn: string): string {
  if (!cn) return "";
  let s = cn.replace(/\s+/g, "");
  const has = (re: RegExp) => re.test(s);
  const take = (re: RegExp) => (has(re) ? (s = s.replace(re, ""), true) : false);
  const dir: string[] = [];
  if (take(/前/)) dir.push("Front"); if (take(/后/)) dir.push("Rear");
  if (take(/左|L\b/i)) dir.push("Left"); if (take(/右|R\b/i)) dir.push("Right");
  if (take(/上/)) dir.push("Upper"); if (take(/下/)) dir.push("Lower");
  const map: [RegExp, string][] = [
    [/悬挂|底盘|悬架|摆臂|控制臂/, "Suspension"], [/控制臂|摆臂|下摆臂|上摆臂/, "Control Arm"],
    [/球头|万向节/, "Ball Joint"], [/拉杆|横拉杆|转向拉杆/, "Tie Rod"],
    [/减震器|避震器/, "Shock Absorber"], [/水箱|散热器/, "Radiator"],
    [/风扇|电子扇/, "Cooling Fan"], [/保险杠/, "Bumper"], [/挡泥板|翼子板/, "Fender"],
    [/刹车片|制动片/, "Brake Pads"], [/刹车盘|制动盘/, "Brake Disc"],
    [/前大灯|大灯|车灯/, "Headlamp"], [/后视镜|反光镜/, "Door Mirror"],
  ];
  let noun = "Part"; for (const [re, en] of map) { if (has(re)) { noun = en; break; } }
  const order = ["Front", "Rear", "Left", "Right", "Upper", "Lower"];
  const dirs = order.filter(d => dir.includes(d));
  return (dirs.concat([noun])).join(" ");
}
function primaryImage(it: Item): string {
  const raw: string[] = it.images || it.pics || it.gallery || it.imageUrls || (it.image ? [it.image] : []) || [];
  const seen = new Set<string>();
  const cleaned = raw.filter(Boolean).map((s) => (typeof s === "string" ? s.trim() : "")).filter((s) => s.length > 0)
    .filter((u) => { const k = u.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  const ph = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAQAAABx0wduAAAAAklEQVR42u3BMQEAAADCoPVPbQ0PoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8JwC0QABG4zJSwAAAABJRU5ErkJggg==";
  return cleaned[0] || ph;
}

/* ------------ TopBar ------------ */
function TopBar({ lang, mode }: { lang: "zh" | "en", mode: "B2C" | "B2B" }) {
  const tr = tFactory(lang);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, alignItems: "center" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button id="lang-zh" disabled={lang === "zh"} style={{ opacity: lang === "zh" ? 0.6 : 1, cursor: "pointer", background: "transparent", border: "1px solid #e5e7eb", padding: "4px 8px", borderRadius: 6 }}>中文</button>
        <button id="lang-en" disabled={lang === "en"} style={{ opacity: lang === "en" ? 0.6 : 1, cursor: "pointer", background: "transparent", border: "1px solid #e5e7eb", padding: "4px 8px", borderRadius: 6 }}>EN</button>
        <div style={{ width: 12 }} />
        <span style={{ alignSelf: "center", color: "#6b7280" }}>{lang === "en" ? "Mode" : "交易模式"}：</span>
        <button id="mode-b2c" disabled={mode === "B2C"} style={{ opacity: mode === "B2C" ? 0.6 : 1, cursor: "pointer", background: "transparent", border: "1px solid #e5e7eb", padding: "4px 8px", borderRadius: 6 }}>B2C</button>
        <button id="mode-b2b" disabled={mode === "B2B"} style={{ opacity: mode === "B2B" ? 0.6 : 1, cursor: "pointer", background: "transparent", border: "1px solid #e5e7eb", padding: "4px 8px", borderRadius: 6 }}>B2B</button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button id="download-template" style={{ cursor: "pointer", background: "#fff", border: "1px solid #e5e7eb", padding: "4px 10px", borderRadius: 6 }}>{tr.downloadTpl}</button>
        <button id="upload-needs" style={{ cursor: "pointer", background: "#fff", border: "1px solid #e5e7eb", padding: "4px 10px", borderRadius: 6 }}>{tr.uploadNeeds}</button>
        <button id="btn-orders" style={{ cursor: "pointer", background: "#fff", border: "1px solid #e5e7eb", padding: "4px 10px", borderRadius: 6 }}>{tr.myOrders}</button>
        <button id="btn-register" style={{ cursor: "pointer", background: "#111827", color: "#fff", border: "1px solid #111827", padding: "4px 10px", borderRadius: 6 }}>{tr.register}</button>
      </div>
    </div>
  );
}

/* ------------ Page ------------ */
export default async function StockPage({ searchParams }: { searchParams?: { [k: string]: string | string[] | undefined } }) {
  const p = toInt((searchParams?.p as string) ?? "0", 0);
  const q = ((searchParams?.q as string) || "").trim();
  const sort = ((searchParams?.sort as string) || "").trim();
  const langCookie = cookies().get("lang")?.value === "en" ? "en" : "zh";
  const modeCookie = cookies().get("mode")?.value === "B2B" ? "B2B" : "B2C";
  const tr = tFactory(langCookie);

  // 数据
  let rows: Row[] = [];
  let hasNext = false;

  if (!q) {
    const pageRows = await fetchPageStable(p, PAGE_SIZE);
    if (pageRows.length === 0 && p > 0) {
      const fallback = await fetchPageStable(0, PAGE_SIZE);
      rows = fallback.map((r) => ({ ...r, _page: 0 }));
      hasNext = fallback.length === PAGE_SIZE;
    } else {
      rows = pageRows.map((r) => ({ ...r, _page: p }));
      hasNext = pageRows.length === PAGE_SIZE;
    }
  } else {
    // 搜索：中心向两侧扫描
    const order = (function centered(pp: number, max: number) {
      const out: number[] = []; let step = 0;
      while (out.length < max) {
        const a = pp + step; if (a >= 0 && !out.includes(a)) out.push(a);
        const b = pp - step; if (b >= 0 && !out.includes(b)) out.push(b);
        step++;
      }
      if (!out.includes(0)) out.push(0);
      return out.slice(0, max);
    })(p, MAX_SCAN_PAGES);

    let found: Row[] = []; let reachedEnd = false;
    for (let i = 0; i < order.length && !reachedEnd && found.length < EARLY_STOP; i += BATCH) {
      const batchPages = order.slice(i, i + BATCH);
      const lists = await Promise.all(batchPages.map((pg) => fetchPageStable(pg, SEARCH_SCAN_SIZE)));
      for (let j = 0; j < lists.length; j++) {
        const pg = batchPages[j], list = lists[j];
        const filtered = list.filter((it) => matchQuery(it, q)).map((it) => ({ ...it, _page: pg }));
        found.push(...filtered);
        if (list.length < SEARCH_SCAN_SIZE) reachedEnd = true;
      }
    }
    rows = found; hasNext = false;
  }

  rows = sortRows(rows, sort);
  const preloadImgs = rows.slice(0, 8).map(primaryImage);

  const mkHref = (np: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sort) params.set("sort", sort);
    params.set("p", String(np));
    return `/stock?${params.toString()}`;
  };
  const prevHref = !q && p > 0 ? mkHref(p - 1) : "#";
  const nextHref = !q && hasNext ? mkHref(p + 1) : "#";

  return (
    <>
      <TopBar lang={langCookie} mode={modeCookie} />
      {preloadImgs.map((src, i) => (<link key={'preload-'+i} rel="preload" as="image" href={src} />))}

      <main style={{ padding: "24px 0" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{tr.stockPreview}</h1>

        <form method="GET" action="/stock" style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, marginBottom: 12 }}>
          <input name="q" defaultValue={q} placeholder={tr.searchPH} aria-label="search"
                 style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb" }} />
          <select name="sort" defaultValue={sort} aria-label="sort"
                  style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff" }}>
            <option value="">{tr.defaultSort}</option>
            <option value="price_asc">{tr.sortPriceAsc}</option>
            <option value="price_desc">{tr.sortPriceDesc}</option>
            <option value="stock_desc">{tr.sortStockDesc}</option>
          </select>
          <button type="submit" style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #111827", background: "#111827", color: "#fff", cursor: "pointer" }}>
            {langCookie === "en" ? "Search" : "搜索"}
          </button>
        </form>

        {!q && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, fontSize: 14 }}>
            <Link href={prevHref} aria-disabled={p === 0}
                  style={{ pointerEvents: p === 0 ? "none" : "auto", padding: "6px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: p === 0 ? "#f3f4f6" : "#fff", color: "#111827", textDecoration: "none" }}>
              {tr.prev}
            </Link>
            <Link href={nextHref} aria-disabled={!hasNext}
                  style={{ pointerEvents: !hasNext ? "none" : "auto", padding: "6px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: !hasNext ? "#f3f4f6" : "#fff", color: "#111827", textDecoration: "none" }}>
              {tr.next}
            </Link>
            <span style={{ color: "#6b7280" }}>
              {langCookie === "en" ? `Page ${p + 1}` : `${tr.pageN} ${p + 1} 页`}
            </span>
          </div>
        )}

        {rows.length === 0 ? (
          <div style={{ padding: 24 }}>{q ? tFactory(langCookie).noMatch : tFactory(langCookie).noData}</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
            {rows.map((it) => {
              const srcPage = typeof it._page === "number" ? it._page : p;
              const sParam = q ? SEARCH_SCAN_SIZE : PAGE_SIZE;
              const href = `/stock/${encodeURIComponent(String(it.num ?? ""))}?p=${srcPage}&s=${sParam}`;

              const raw: string[] = it.images || it.pics || it.gallery || it.imageUrls || (it.image ? [it.image] : []) || [];
              const seen = new Set<string>();
              const cleaned = raw.filter(Boolean).map((s) => (typeof s === "string" ? s.trim() : "")).filter((s) => s.length > 0)
                .filter((u) => { const k = u.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
              const img = cleaned[0] || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAQAAABx0wduAAAAAklEQVR42u3BMQEAAADCoPVPbQ0PoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8JwC0QABG4zJSwAAAABJRU5ErkJggg==";

              const title = [it.brand, it.product, it.oe, it.num].filter(Boolean).join(" | ");
              const scn = stdCn(it);
              const sen = stdEn(it);
              const partEn = sen || (langCookie === "en" ? cnPartToEn(scn) : "");
              const dataPayload = JSON.stringify({
                num: it.num ?? "", price: it.price ?? "", brand: it.brand ?? "", product: it.product ?? "", oe: it.oe ?? ""
              }).replace(/"/g, "&quot;");

              return (
                <div key={String(it.num)}
                     style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <Link href={href} title={tFactory(langCookie).viewDetail} prefetch>
                    <div style={{ width: "100%", aspectRatio: "1 / 1", overflow: "hidden", borderRadius: 10, background: "#fff", border: "1px solid #f3f4f6" }}>
                      <img src={img} alt={String(it.product ?? "product")} loading="eager" fetchPriority="high" decoding="sync"
                           style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    </div>
                  </Link>

                  <Link href={href} title={title} prefetch
                        style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.35, textDecoration: "none", color: "#111827" }}>
                    {title}
                  </Link>

                  {(scn || partEn) && (
                    <div style={{ fontSize: 12, color: "#374151" }}>
                      {scn && <div>{tFactory(langCookie).partName}：{scn}</div>}
                      {partEn && <div>Part Name: {partEn}</div>}
                    </div>
                  )}

                  <div style={{ fontSize: 12, color: "#4b5563", display: "grid", gap: 4 }}>
                    {it.oe && <div>{tFactory(langCookie).oe}：{it.oe}</div>}
                    {typeof it.price !== "undefined" && <div>{tFactory(langCookie).price}：{String(it.price)}</div>}
                    {typeof it.stock !== "undefined" && <div>{tFactory(langCookie).stock}：{String(it.stock)}</div>}
                  </div>

                  <div style={{ marginTop: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn-add" data-payload={dataPayload} data-added={tFactory(langCookie).added}
                            style={{ flex: 1, padding: "8px 12px", borderRadius: 8, background: "#2563eb", color: "#fff", border: "none", cursor: "pointer" }}>
                      {tFactory(langCookie).addToCart}
                    </button>
                    <button className="btn-checkout"
                            style={{ flex: 1, padding: "8px 12px", borderRadius: 8, background: "#10b981", color: "#fff", border: "none", cursor: "pointer" }}>
                      {tFactory(langCookie).checkout}
                    </button>
                    <Link href={href} prefetch title={tFactory(langCookie).viewDetail}
                          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, background: "#fff", color: "#111827", border: "1px solid #e5e7eb", textAlign: "center", textDecoration: "none" }}>
                      {tFactory(langCookie).viewDetail}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!q && (
          <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
            <Link href={prevHref} aria-disabled={p === 0}
                  style={{ pointerEvents: p === 0 ? "none" : "auto", padding: "8px 16px", borderRadius: 8, border: "1px solid #e5e7eb", background: p === 0 ? "#f3f4f6" : "#fff", color: "#111827", textDecoration: "none" }}>
              {tr.prev}
            </Link>
            <Link href={nextHref} aria-disabled={!hasNext}
                  style={{ pointerEvents: !hasNext ? "none" : "auto", padding: "8px 16px", borderRadius: 8, border: "1px solid #e5e7eb", background: !hasNext ? "#f3f4f6" : "#fff", color: "#111827", textDecoration: "none" }}>
              {tr.next}
            </Link>
            <span style={{ alignSelf: "center", color: "#6b7280" }}>
              {langCookie === "en" ? `Page ${p + 1}` : `${tr.pageN} ${p + 1} 页`}
            </span>
          </div>
        )}
      </main>

      {/* 列表页 - 结算弹窗 */}
      <div id="list-mask" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "none", zIndex: 50 }} />
      <div id="list-modal" role="dialog" aria-modal="true" aria-labelledby="list-title"
           style={{ position: "fixed", left: "50%", top: "8vh", transform: "translateX(-50%)", width: "min(720px, 92vw)", background: "#fff",
                    border: "1px solid #e5e7eb", borderRadius: 12, display: "none", zIndex: 51, maxHeight: "84vh", flexDirection: "column" }}>
        <div id="list-title" style={{ padding: "12px 16px", fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>{tr.submitOrder}</div>
        <div style={{ padding: 16, display: "grid", gap: 12, overflow: "auto", flex: 1 }}>
          <div id="list-cart-items" style={{ fontSize: 13, color: "#374151" }}></div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center", gap: 8 }}>
            <div>
              <label>{tr.currency} <span style={{color:"#dc2626"}}>*</span></label>
              <select id="l-currency" defaultValue="USD">
                <option value="CNY">人民币 CNY</option>
                <option value="USD">美元 USD</option>
                <option value="EUR">欧元 EUR</option>
              </select>
            </div>
            <div id="l-total" style={{ textAlign: "right", fontWeight: 700 }}>{tr.total}：--</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label>{tr.contactName} <span style={{color:"#dc2626"}}>*</span></label><input id="l-name" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
            <div><label>{tr.phone} <span style={{color:"#dc2626"}}>*</span></label><input id="l-phone" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label>{tr.email} <span style={{color:"#dc2626"}}>*</span></label><input id="l-email" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
            <div><label id="l-company-label">{tr.company} <span id="l-company-star" style={{color:"#dc2626",display: modeCookie==='B2B'?'inline':'none'}}>*</span></label><input id="l-company" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label>{tr.country} <span style={{color:"#dc2626"}}>*</span></label><input id="l-country" style={{ border: "1px solid "#e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
            <div><label>{tr.mode} <span style={{color:"#dc2626"}}>*</span></label>
              <select id="l-mode" defaultValue={modeCookie} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }}>
                <option value="B2C">{tr.b2c}</option><option value="B2B">{tr.b2b}</option>
              </select>
            </div>
          </div>
          <div><label>{tr.address} <span style={{color:"#dc2626"}}>*</span></label><input id="l-address" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
          <div><label>{tr.note} <span style={{color:"#dc2626"}}>*</span></label><textarea id="l-notes" rows={3} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
          <div id="l-tip" style={{ fontSize: 12 }}></div>
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 8, justifyContent: "flex-end", position: "sticky", bottom: 0, background: "#fff" }}>
          <button id="l-cancel" style={{ padding: "8px 14px", borderRadius: 8, background: "#fff", border: "1px solid #e5e7eb", cursor: "pointer" }}>{tr.cancel}</button>
          <button id="l-submit" style={{ padding: "8px 14px", borderRadius: 8, background: "#111827", color: "#fff", border: "1px solid #111827", cursor: "pointer" }}>{tr.submitOrder}</button>
        </div>
      </div>

      {/* 订单列表弹窗/注册/上传 与之前一致，省略改动（保留原结构） */}

      <Script id="stock-page-js" strategy="afterInteractive">{`
(function(){
  function setCookie(k,v){ document.cookie = k+'='+v+'; path=/; max-age='+(3600*24*365); }
  function closestSel(node, sel){ var el=node && node.nodeType===1?node:(node&&node.parentElement); while(el){ if(el.matches && el.matches(sel)) return el; el=el.parentElement; } return null; }

  // === 事件委托：所有点击统一在 document 上 ===
  document.addEventListener('click', function(e){
    var t=e.target;

    // 语言/模式
    if(closestSel(t,'#lang-zh')){ setCookie('lang','zh'); location.reload(); return; }
    if(closestSel(t,'#lang-en')){ setCookie('lang','en'); location.reload(); return; }
    if(closestSel(t,'#mode-b2c')){ setCookie('mode','B2C'); location.reload(); return; }
    if(closestSel(t,'#mode-b2b')){ setCookie('mode','B2B'); location.reload(); return; }

    // 列表加入购物车
    if(closestSel(t,'.btn-add')){
      var btn=closestSel(t,'.btn-add');
      var payload = btn.getAttribute('data-payload') || '';
      try{
        var it = payload? JSON.parse(payload.replace(/&quot;/g,'"')) : null; if(!it) return;
        var cart = readCart(); var idx = cart.findIndex(function(x){ return String(x.num)===String(it.num); });
        if(idx===-1){ cart.push({ num:it.num, qty:1, price:it.price, brand:it.brand, product:it.product, oe:it.oe }); }
        else { cart[idx].qty = (cart[idx].qty||1)+1; }
        writeCart(cart);
      }catch(e){}
      var txt = btn.innerText; btn.innerText = btn.getAttribute('data-added') || (document.documentElement.lang==='en'?'Added':'已加入');
      setTimeout(function(){ btn.innerText = txt; }, 1200);
      return;
    }

    // 列表去结算
    if(closestSel(t,'.btn-checkout')){ openModal(); return; }

    // 结算弹窗按钮
    if(closestSel(t,'#l-cancel') || t===document.getElementById('list-mask')){ closeModal(); return; }
    if(closestSel(t,'.q-inc,.q-dec,.q-del')){
      var trEl = closestSel(t,'tr'); if(!trEl) return; var idx = Number(trEl.getAttribute('data-idx')||'-1'); if(idx<0) return;
      var cart=readCart(); if(idx>=cart.length) return;
      if(closestSel(t,'.q-inc')) cart[idx].qty = (cart[idx].qty||1)+1;
      else if(closestSel(t,'.q-dec')) cart[idx].qty = Math.max(1,(cart[idx].qty||1)-1);
      else if(closestSel(t,'.q-del')) cart.splice(idx,1);
      writeCart(cart); renderCart(); updateTotal();
      return;
    }
    if(closestSel(t,'#l-submit')){
      if(!validateAll()) return;
      var order={
        items: readCart(),
        contact:{ name: gv('l-name'), phone: gv('l-phone'), email: gv('l-email'),
          company: gv('l-company'), country: gv('l-country'),
          address: gv('l-address'), mode: gv('l-mode') || 'B2C', notes: gv('l-notes'),
          currency: (document.getElementById('l-currency')||{}).value || 'USD',
          totalText: (document.getElementById('l-total')||{}).textContent || ''
        },
        createdAt: new Date().toISOString()
      };
      try{
        var raw=localStorage.getItem('orders'); var arr=raw? JSON.parse(raw): [];
        arr.push(order); localStorage.setItem('orders', JSON.stringify(arr));
        localStorage.setItem('lastOrder', JSON.stringify(order));
        var tip=document.getElementById('l-tip'); if(tip){ tip.style.color='#059669'; tip.textContent=(document.documentElement.lang==='en'?'Submitted (Demo): saved to local orders':'提交成功（演示）：已保存到本地订单列表'); }
      }catch(e){}
      return;
    }

    // 订单列表/模板/注册 触发（保持原逻辑，略）
    if(closestSel(t,'#btn-orders')){ openOrders(); return; }
    if(closestSel(t,'#o-close') || t===document.getElementById('orders-mask')){ closeOrders(); return; }
    if(closestSel(t,'#o-export')){ exportOrdersCsv(); return; }
    if(closestSel(t,'#o-clear')){ if(confirm('OK?')){ try{ localStorage.removeItem('orders'); }catch(e){} renderOrders(); } return; }
    if(closestSel(t,'#download-template')){ downloadTemplate(); return; }
    if(closestSel(t,'#upload-needs')){ uploadNeeds(); return; }
    if(closestSel(t,'#btn-register')){ openReg(); return; }
    if(closestSel(t,'#r-cancel') || t===document.getElementById('reg-mask')){ closeReg(); return; }
    if(closestSel(t,'#r-submit')){
      var nm=gv('r-name'), em=gv('r-email');
      if(!nm || !/^([^@\\s]+)@([^@\\s]+)\\.[^@\\s]+$/.test(em)){ var tp=document.getElementById('r-tip'); if(tp){ tp.textContent=(document.documentElement.lang==='en'?'Please complete all required fields.':'请完整填写所有必填字段。'); } return; }
      try{ localStorage.setItem('user', JSON.stringify({name:nm,email:em,ts:Date.now()})); }catch(e){}
      closeReg(); return;
    }
  });

  // 变更事件
  document.addEventListener('change', function(e){
    var t=e.target;
    if((t as HTMLElement).id==='l-currency') updateTotal();
    if((t as HTMLElement).id==='l-mode'){ var star=document.getElementById('l-company-star'); if(star){ star.style.display = ((document.getElementById('l-mode')||{}).value==='B2B')?'inline':'none'; } }
    if((t as HTMLElement).id==='needs-file'){ handleCsvFile(t as HTMLInputElement); }
  });

  // —— 工具函数（与之前一致）——
  function gv(id){ var el=document.getElementById(id); return el && typeof (el as HTMLInputElement).value!=='undefined' ? (el as HTMLInputElement).value.trim() : ''; }
  function readCart(){ try{ var raw=localStorage.getItem('cart'); return raw? JSON.parse(raw): []; }catch(e){ return []; } }
  function writeCart(c){ try{ localStorage.setItem('cart', JSON.stringify(c)); }catch(e){} }
  var RATES={ USD:1, CNY:7.2, EUR:0.92 };
  function computeTotal(currency){
    var cart=readCart();
    var sum=cart.reduce(function(acc,it){ var p=Number(it.price)||0; var q=Number(it.qty)||1; return acc + p*q; },0);
    var rate=RATES[currency]||1, val=sum*rate, sym=currency==='CNY'?'¥':(currency==='EUR'?'€':'$');
    return sym+' '+(Math.round(val*100)/100).toFixed(2);
  }
  function updateTotal(){
    var cur=(document.getElementById('l-currency')||{}).value || 'USD';
    var el=document.getElementById('l-total'); if(el) el.textContent = (document.documentElement.lang==='en'?'Total':'合计')+'：'+computeTotal(cur);
  }
  function markInvalid(id){ var el=document.getElementById(id); if(el){ (el as HTMLElement).style.borderColor='#dc2626'; (el as HTMLElement).focus(); } }
  function clearInvalid(id){ var el=document.getElementById(id); if(el){ (el as HTMLElement).style.borderColor='#e5e7eb'; } }
  function clearTip(){ var tip=document.getElementById('l-tip'); if(tip){ tip.textContent=''; tip.style.color='#111827'; } }
  function needCompany(){ var m=(document.getElementById('l-mode')||{}).value || 'B2C'; return m==='B2B'; }
  function validateAll(){
    clearTip();
    ['l-name','l-phone','l-email','l-country','l-address','l-notes','l-company'].forEach(clearInvalid);
    var req=['l-name','l-phone','l-email','l-country','l-address','l-notes']; if(needCompany()) req.push('l-company');
    for(var i=0;i<req.length;i++){ var id=req[i]; if(!gv(id)){ markInvalid(id); var tip=document.getElementById('l-tip'); if(tip){ tip.style.color='#dc2626'; tip.textContent=(document.documentElement.lang==='en'?'Please complete all required fields.':'请完整填写所有必填字段。'); } return false; } }
    var email=gv('l-email'); var phone=gv('l-phone').replace(/\\D/g,'');
    if(!/^([^@\\s]+)@([^@\\s]+)\\.[^@\\s]+$/.test(email)){ markInvalid('l-email'); var t1=document.getElementById('l-tip'); if(t1){ t1.style.color='#dc2626'; t1.textContent=(document.documentElement.lang==='en'?'Invalid email format.':'邮箱格式不正确。'); } return false; }
    if(phone.length<5){ markInvalid('l-phone'); var t2=document.getElementById('l-tip'); if(t2){ t2.style.color='#dc2626'; t2.textContent=(document.documentElement.lang==='en'?'Invalid phone number.':'电话格式不正确。'); } return false; }
    return true;
  }
  var mask=document.getElementById('list-mask'), modal=document.getElementById('list-modal');
  function openModal(){ renderCart(); updateTotal(); if(mask) mask.style.display='block'; if(modal) modal.style.display='flex'; syncCompanyStar(); }
  function closeModal(){ if(mask) mask.style.display='none'; if(modal) modal.style.display='none'; }
  function syncCompanyStar(){ var star=document.getElementById('l-company-star'); if(star){ star.style.display = ((document.getElementById('l-mode')||{}).value==='B2B')?'inline':'none'; } }
  function rowTitle(it){ return [it.brand,it.product,it.oe,it.num].filter(Boolean).join(' | '); }
  function renderCart(){
    var el=document.getElementById('list-cart-items'); if(!el) return;
    var cart=readCart(); if(!cart.length){ el.innerHTML='<div>'+(document.documentElement.lang==='en'?'Cart is empty':'购物车为空')+'</div>'; return; }
    var html='<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr>'+
      '<th style="text-align:left;padding:6px;border-bottom:1px solid #e5e7eb">'+(document.documentElement.lang==='en'?'Item':'商品')+'</th>'+
      '<th style="text-align:right;padding:6px;border-bottom:1px solid #e5e7eb">'+(document.documentElement.lang==='en'?'Qty':'数量')+'</th>'+
      '<th style="text-align:right;padding:6px;border-bottom:1px solid #e5e7eb">'+(document.documentElement.lang==='en'?'Price':'价格')+'</th></tr></thead><tbody>';
    cart.forEach(function(it,idx){
      html+='<tr data-idx="'+idx+'">'+
        '<td style="padding:6px;border-bottom:1px solid #f3f4f6">'+rowTitle(it)+'</td>'+
        '<td style="padding:6px;text-align:right;border-bottom:1px solid #f3f4f6">'+
          '<button class="q-dec" style="margin-right:6px">-</button>'+
          '<span class="q-num">'+(it.qty||1)+'</span>'+
          '<button class="q-inc" style="margin-left:6px">+</button>'+
          '<button class="q-del" style="margin-left:12px">✕</button>'+
        '</td>'+
        '<td style="padding:6px;text-align:right;border-bottom:1px solid #f3f4f6)">'+(it.price||'')+'</td>'+
      '</tr>';
    });
    html+='</tbody></table>'; el.innerHTML=html;
  }

  // CSV 上传
  function handleCsvFile(input){
    var f=input.files && input.files[0]; if(!f) return;
    var fr=new FileReader(); fr.onload=function(){ try{
      var text=String(fr.result||''); var lines=text.split(/\\r?\\n/), out=[];
      lines.forEach(function(l){ if(!l || /^\\s*#/.test(l)) return; var c=l.split(',').map(function(s){ return s.trim(); });
        if(c.length>=2){ var num=c[0]||'', oe=c[1]||''; var qty=Number(c[2]||'1'); if(!qty||qty<1) qty=1; out.push({num:num||oe, oe:oe, qty:qty}); }
      });
      var cart=readCart();
      out.forEach(function(r){ if(!r || !r.num) return; var i=cart.findIndex(function(x){ return String(x.num)===String(r.num); });
        if(i===-1) cart.push({ num:r.num, oe:r.oe, qty:r.qty });
        else cart[i].qty = (cart[i].qty||1) + r.qty;
      });
      writeCart(cart); alert((document.documentElement.lang==='en'?'Upload Needs (CSV)':'上传需求 (CSV)')+' OK'); updateTotal(); renderCart();
    }catch(e){} }; fr.readAsText(f, 'utf-8');
    try{ input.value=''; }catch(_){}
  }

  // 订单弹窗/注册弹窗的渲染与导出（与之前一致，保持）
  function openOrders(){ renderOrders(); document.getElementById('orders-mask')?.setAttribute('style','position:fixed;inset:0;background:rgba(0,0,0,.35);display:block;z-index:50'); document.getElementById('orders-modal')?.setAttribute('style','position:fixed;left:50%;top:8vh;transform:translateX(-50%);width:min(860px,92vw);background:#fff;border:1px solid #e5e7eb;border-radius:12px;display:flex;z-index:51;max-height:84vh;flex-direction:column'); }
  function closeOrders(){ document.getElementById('orders-mask')?.setAttribute('style','position:fixed;inset:0;background:rgba(0,0,0,.35);display:none;z-index:50'); document.getElementById('orders-modal')?.setAttribute('style','position:fixed;left:50%;top:8vh;transform:translateX(-50%);width:min(860px,92vw);background:#fff;border:1px solid #e5e7eb;border-radius:12px;display:none;zIndex:51;max-height:84vh;flex-direction:column'); }
  function renderOrders(){
    var el=document.getElementById('orders-list'); if(!el) return; var list=readOrders();
    if(!list.length){ el.innerHTML='<div style="color:#6b7280">'+(document.documentElement.lang==='en'?'Cart is empty':'购物车为空')+'</div>'; return; }
    var html='<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr>'+
      '<th style="text-align:left;padding:6px;border-bottom:1px solid #e5e7eb">'+(document.documentElement.lang==='en'?'Created At':'创建时间')+'</th>'+
      '<th style="text-align:right;padding:6px;border-bottom:1px solid #e5e7eb">'+(document.documentElement.lang==='en'?'Item':'商品')+'</th>'+
      '<th style="text-align:right;padding:6px;border-bottom:1px solid #e5e7eb)">'+(document.documentElement.lang==='en'?'Total':'合计')+'</th></tr></thead><tbody>';
    list.forEach(function(o){
      var count=(o.items||[]).reduce(function(a,b){ return a+(Number(b.qty)||1); },0);
      html+='<tr><td style="padding:6px;border-bottom:1px solid #f3f4f6">'+(o.createdAt||'')+'</td>'+
            '<td style="padding:6px;text-align:right;border-bottom:1px solid #f3f4f6)">'+count+'</td>'+
            '<td style="padding:6px;text-align:right;border-bottom:1px solid #f3f4f6)">'+(o.contact&&o.contact.totalText||'')+'</td></tr>';
    });
    html+='</tbody></table>'; el.innerHTML=html;
  }
  function readOrders(){ try{ var raw=localStorage.getItem('orders'); return raw? JSON.parse(raw): []; }catch(e){ return []; } }
  function exportOrdersCsv(){
    var list=readOrders(); var lines=['createdAt,num,oe,qty,price,currency,totalText'];
    list.forEach(function(o){
      var cur=(o.contact&&o.contact.currency)||'';
      var tot=(o.contact&&o.contact.totalText)||'';
      (o.items||[]).forEach(function(it){
        lines.push([o.createdAt, it.num||'', it.oe||'', it.qty||1, it.price||'', cur, tot].join(','));
      });
    });
    var csv=lines.join('\\n'); var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='ImgParts_Orders.csv'; a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 500);
  }
  function downloadTemplate(){
    var csv='num,oe,qty\\n# example: 721012,69820-06160,2\\n';
    var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='ImgParts_Demand_Template.csv'; a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 500);
  }
  function isLogin(){ try{ return !!localStorage.getItem('user'); }catch(e){ return false; } }
  function openReg(){ document.getElementById('reg-mask')!.style.display='block'; document.getElementById('reg-modal')!.style.display='flex'; }
  function closeReg(){ document.getElementById('reg-mask')!.style.display='none'; document.getElementById('reg-modal')!.style.display='none'; }
  function uploadNeeds(){
    if(!isLogin()){ alert(document.documentElement.lang==='en'?'Please register/login first.':'请先完成注册/登录。'); openReg(); return; }
    (document.getElementById('needs-file') as HTMLInputElement)?.click();
  }

  // 初始
  updateTotal();
})();
      `}</Script>
    </>
  );
}
