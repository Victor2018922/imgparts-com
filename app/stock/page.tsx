// 列表页：极速搜索 + 排序 + “配件名称”展示（含动态兜底与英文兜底翻译） + 本地购物车 + 结算弹窗
// 修复：1) “去结算”打开后按钮不可见——弹窗可滚动，底部按钮固定
//      2) 统一事件（直接绑定 + 委托）稳定可点
import Link from "next/link";
import { cookies } from "next/headers";

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
  productCn?: string; productEn?: string;
  productNameCn?: string; productNameEn?: string;
  partNameCn?: string; partNameEn?: string;
  stdNameCn?: string; stdNameEn?: string;
  summary?: string; description?: string; desc?: string; remark?: string;
  [k: string]: any;
};
type Row = Item & { _page?: number };

const API_BASE = "https://niuniuparts.com:6001/scm-product/v1/stock2";
const SIZE = 20;
const SEARCH_SIZE = 200;
const MAX_SCAN_PAGES = 12;
const BATCH = 6;
const REQ_TIMEOUT = 2500;
const EARLY_STOP = 48;

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
        contactName: "Name", phone: "Phone", email: "Email", company: "Company (optional)",
        country: "Country", address: "Address", mode: "Mode", note: "Notes",
        b2c: "B2C", b2b: "B2B",
        emptyCart: "Cart is empty", item: "Item", qty: "Qty",
        submittedTip: "Submitted (Demo): saved to local orders",
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
        contactName: "姓名 / Name", phone: "电话 / Phone", email: "邮箱 / Email", company: "公司（可选）",
        country: "国家 / Country", address: "地址 / Address", mode: "交易模式", note: "备注 / Notes",
        b2c: "B2C", b2b: "B2B",
        emptyCart: "购物车为空", item: "商品", qty: "数量",
        submittedTip: "提交成功（演示）：已保存到本地订单列表",
      };
}

// —— 中文配件名到英文翻译兜底（与详情一致） ——
function cnPartToEn(cn: string): string {
  if (!cn) return "";
  let s = cn.replace(/\s+/g, "");
  const has = (re: RegExp) => re.test(s);
  const take = (re: RegExp) => (has(re) ? (s = s.replace(re, ""), true) : false);

  const dir: string[] = [];
  if (take(/前/)) dir.push("Front");
  if (take(/后/)) dir.push("Rear");
  if (take(/左|L\b/i)) dir.push("Left");
  if (take(/右|R\b/i)) dir.push("Right");
  if (take(/上/)) dir.push("Upper");
  if (take(/下/)) dir.push("Lower");

  const map: [RegExp, string][] = [
    [/悬挂|底盘|悬架|摆臂|控制臂/, "Suspension"],
    [/控制臂|摆臂|下摆臂|上摆臂/, "Control Arm"],
    [/球头|万向节/, "Ball Joint"],
    [/拉杆|横拉杆|转向拉杆/, "Tie Rod"],
    [/减震器|避震器/, "Shock Absorber"],
    [/水箱|散热器/, "Radiator"],
    [/风扇|电子扇/, "Cooling Fan"],
    [/保险杠/, "Bumper"],
    [/挡泥板|翼子板/, "Fender"],
    [/刹车片|制动片/, "Brake Pads"],
    [/刹车盘|制动盘/, "Brake Disc"],
    [/前大灯|大灯|车灯/, "Headlamp"],
    [/后视镜|反光镜/, "Door Mirror"],
  ];
  let noun = "Part";
  for (const [re, en] of map) { if (has(re)) { noun = en; break; } }
  const order = ["Front", "Rear", "Left", "Right", "Upper", "Lower"];
  const dirs = order.filter(d => dir.includes(d));
  return (dirs.concat([noun])).join(" ");
}

function toInt(v: unknown, def: number) { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : def; }

// ✅ 返回类型修正为 Promise<Item[]>
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
  } catch { return []; } finally { clearTimeout(t); }
}
async function fetchPageStable(page: number, size: number): Promise<Item[]> {
  for (let i = 0; i < 2; i++) { const rows = await fetchPageOnce(page, size, REQ_TIMEOUT); if (rows.length) return rows; }
  return [];
}

function norm(s: any) { return String(s ?? "").toLowerCase(); }
function matchQuery(it: Item, q: string) {
  if (!q) return true;
  const k = q.toLowerCase();
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
function primaryImage(it: Item): string {
  const raw: string[] = it.images || it.pics || it.gallery || it.imageUrls || (it.image ? [it.image] : []) || [];
  const seen = new Set<string>();
  const cleaned = raw.filter(Boolean).map((s) => (typeof s === "string" ? s.trim() : "")).filter((s) => s.length > 0)
    .filter((u) => { const k = u.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  const placeholder = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAQAAABx0wduAAAAAklEQVR42u3BMQEAAADCoPVPbQ0PoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8JwC0QABG4zJSwAAAABJRU5ErkJggg==";
  return cleaned[0] || placeholder;
}
function titleOf(it: Item) { return [it.brand, it.product, it.oe, it.num].filter(Boolean).join(" | "); }
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

// —— 顶部语言条（组件内定义） ——
function LangBar({ lang }: { lang: "zh" | "en" }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, fontSize: 13 }}>
      <button id="lang-zh" disabled={lang === "zh"} style={{ opacity: lang === "zh" ? 0.6 : 1, cursor: "pointer", background: "transparent", border: "1px solid #e5e7eb", padding: "4px 8px", borderRadius: 6 }}>
        中文
      </button>
      <button id="lang-en" disabled={lang === "en"} style={{ opacity: lang === "en" ? 0.6 : 1, cursor: "pointer", background: "transparent", border: "1px solid #e5e7eb", padding: "4px 8px", borderRadius: 6 }}>
        EN
      </button>
    </div>
  );
}

export default async function StockPage({ searchParams }: { searchParams?: { [k: string]: string | string[] | undefined } }) {
  const p = toInt((searchParams?.p as string) ?? "0", 0);
  const q = ((searchParams?.q as string) || "").trim();
  const sort = ((searchParams?.sort as string) || "").trim();
  const langCookie = cookies().get("lang")?.value === "en" ? "en" : "zh";
  const tr = tFactory(langCookie);

  let rows: Row[] = [];
  let hasNext = false;

  if (!q) {
    const pageRows = await fetchPageStable(p, SIZE);
    rows = pageRows.map((r) => ({ ...r, _page: p }));
    hasNext = pageRows.length === SIZE;
  } else {
    const order = (function centeredOrder(pp: number, max: number) {
      const out: number[] = []; let step = 0;
      while (out.length < max) { const a = pp + step; if (a >= 0 && !out.includes(a)) out.push(a);
        if (out.length >= max) break; const b = pp - step; if (b >= 0 && !out.includes(b)) out.push(b); step++; }
      if (!out.includes(0)) out.push(0); return out.slice(0, max);
    })(p, MAX_SCAN_PAGES);
    let found: Row[] = []; let reachedEnd = false;
    for (let i = 0; i < order.length && !reachedEnd && found.length < EARLY_STOP; i += BATCH) {
      const batchPages = order.slice(i, i + BATCH);
      const lists = await Promise.all(batchPages.map((pg) => fetchPageStable(pg, SEARCH_SIZE)));
      for (let j = 0; j < lists.length; j++) {
        const pg = batchPages[j], list = lists[j];
        const filtered = list.filter((it) => matchQuery(it, q)).map((it) => ({ ...it, _page: pg }));
        found.push(...filtered);
        if (list.length < SEARCH_SIZE) reachedEnd = true;
      }
    }
    rows = found; hasNext = false;
  }

  rows = sortRows(rows, sort);
  const preloadImgs = rows.slice(0, 8).map(primaryImage);

  const baseQuery = (extra: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams(); if (q) params.set("q", q); if (sort) params.set("sort", sort);
    if (typeof extra.p !== "undefined") params.set("p", String(extra.p));
    return `/stock${params.toString() ? "?" + params.toString() : ""}`;
  };
  const prevHref = !q && p > 0 ? baseQuery({ p: p - 1 }) : "#";
  const nextHref = !q && hasNext ? baseQuery({ p: p + 1 }) : "#";

  return (
    <>
      <LangBar lang={langCookie} />
      {preloadImgs.map((src, i) => (<link key={'preload-'+i} rel="preload" as="image" href={src} />))}

      <main style={{ padding: "24px 0" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{tr.stockPreview}</h1>

        {/* 搜索 + 排序 */}
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

        {/* 分页条（浏览模式） */}
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
              {langCookie === "en" ? `${tr.pageN} ${p + 1}` : `${tr.pageN} ${p + 1} 页`}
            </span>
          </div>
        )}

        {/* 列表 */}
        {rows.length === 0 ? (
          <div style={{ padding: 24 }}>{q ? (langCookie === "en" ? "No results, try other keywords" : "未找到匹配结果，请更换关键词") : (langCookie === "en" ? "No data or failed to load, refresh and try again" : "暂无数据或加载失败，请刷新重试")}</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
            {rows.map((it) => {
              const srcPage = typeof it._page === "number" ? it._page : p;
              const sParam = q ? SEARCH_SIZE : SIZE;
              const href = `/stock/${encodeURIComponent(String(it.num ?? ""))}?p=${srcPage}&s=${sParam}`;
              const img = primaryImage(it);
              const title = titleOf(it);
              const scn = stdCn(it);
              const sen = stdEn(it);
              const partEn = sen || (langCookie === "en" ? cnPartToEn(scn) : "");
              const dataPayload = JSON.stringify({
                num: it.num ?? "", price: it.price ?? "", brand: it.brand ?? "", product: it.product ?? "", oe: it.oe ?? ""
              }).replace(/"/g, "&quot;");
              return (
                <div key={String(it.num)}
                     style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <Link href={href} title={tr.viewDetail} prefetch>
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
                      {scn && <div>{tr.partName}：{scn}</div>}
                      {partEn && <div>Part Name: {partEn}</div>}
                    </div>
                  )}

                  <div style={{ fontSize: 12, color: "#4b5563", display: "grid", gap: 4 }}>
                    {it.oe && <div>{tr.oe}：{it.oe}</div>}
                    {typeof it.price !== "undefined" && <div>{tr.price}：{String(it.price)}</div>}
                    {typeof it.stock !== "undefined" && <div>{tr.stock}：{String(it.stock)}</div>}
                  </div>

                  <div style={{ marginTop: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn-add" data-payload={dataPayload} data-added={tr.added}
                            style={{ flex: 1, padding: "8px 12px", borderRadius: 8, background: "#2563eb", color: "#fff", border: "none", cursor: "pointer" }}>
                      {tr.addToCart}
                    </button>
                    <button className="btn-checkout"
                            style={{ flex: 1, padding: "8px 12px", borderRadius: 8, background: "#10b981", color: "#fff", border: "none", cursor: "pointer" }}>
                      {tr.checkout}
                    </button>
                    <Link href={href} prefetch title={tr.viewDetail}
                          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, background: "#fff", color: "#111827", border: "1px solid #e5e7eb", textAlign: "center", textDecoration: "none" }}>
                      {tr.viewDetail}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 底部分页（浏览模式） */}
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
              {langCookie === "en" ? `${"Page"} ${p + 1}` : `${tr.pageN} ${p + 1} 页`}
            </span>
          </div>
        )}
      </main>

      {/* 结算弹窗（可滚动 + 底部按钮固定） */}
      <div
        id="list-mask"
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "none", zIndex: 50 }}
      />
      <div
        id="list-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="list-title"
        style={{
          position: "fixed",
          left: "50%",
          top: "8vh",
          transform: "translateX(-50%)",
          width: "min(720px, 92vw)",
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          display: "none",       // 初始隐藏；打开时通过 JS 改为 'flex'
          zIndex: 51,
          maxHeight: "84vh",
          flexDirection: "column",
        }}
      >
        <div id="list-title" style={{ padding: "12px 16px", fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>{tr.submitOrder}</div>
        <div style={{ padding: 16, display: "grid", gap: 12, overflow: "auto", flex: 1 }}>
          <div id="list-cart-items" style={{ fontSize: 13, color: "#374151" }}></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label>{tr.contactName}</label><input id="l-name" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
            <div><label>{tr.phone}</label><input id="l-phone" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label>{tr.email}</label><input id="l-email" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
            <div><label>{tr.company}</label><input id="l-company" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label>{tr.country}</label><input id="l-country" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
            <div><label>{tr.mode}</label>
              <select id="l-mode" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }}>
                <option value="B2C">{tr.b2c}</option><option value="B2B">{tr.b2b}</option>
              </select>
            </div>
          </div>
          <div><label>{tr.address}</label><input id="l-address" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
          <div><label>{tr.note}</label><textarea id="l-notes" rows={3} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
          <div id="l-tip" style={{ fontSize: 12, color: "#059669" }}></div>
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 8, justifyContent: "flex-end", position: "sticky", bottom: 0, background: "#fff" }}>
          <button id="l-cancel" style={{ padding: "8px 14px", borderRadius: 8, background: "#fff", border: "1px solid #e5e7eb", cursor: "pointer" }}>{tr.cancel}</button>
          <button id="l-submit" style={{ padding: "8px 14px", borderRadius: 8, background: "#111827", color: "#fff", border: "1px solid #111827", cursor: "pointer" }}>{tr.submitOrder}</button>
        </div>
      </div>

      {/* 事件脚本：直接绑定 + 委托 */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function(){
  function closestSel(node, sel){
    var el = node && node.nodeType===1 ? node : (node && node.parentElement);
    while(el){ if (el.matches && el.matches(sel)) return el; el = el.parentElement; }
    return null;
  }

  // 顶部语言切换
  document.addEventListener('click', function(e){
    var t = e.target;
    if (closestSel(t, '#lang-zh')) { document.cookie = 'lang=zh; path=/; max-age='+(3600*24*365); location.reload(); return; }
    if (closestSel(t, '#lang-en')) { document.cookie = 'lang=en; path=/; max-age='+(3600*24*365); location.reload(); return; }
  });

  function readCart(){ try{ var raw=localStorage.getItem('cart'); return raw? JSON.parse(raw): []; }catch(e){ return []; } }
  function writeCart(c){ try{ localStorage.setItem('cart', JSON.stringify(c)); }catch(e){} }
  function renderCart(){
    var el=document.getElementById('list-cart-items'); if(!el) return;
    var cart=readCart(); if(!cart.length){ el.innerHTML='<div>${tFactory(cookies().get("lang")?.value==="en"?"en":"zh").emptyCart}</div>'; return; }
    var tr=${JSON.stringify(tFactory(cookies().get("lang")?.value==="en"?"en":"zh"))};
    var html='<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr>'+
             '<th style="text-align:left;padding:6px;border-bottom:1px solid #e5e7eb">'+tr.item+'</th>'+
             '<th style="text-align:right;padding:6px;border-bottom:1px solid #e5e7eb)">'+tr.qty+'</th>'+
             '<th style="text-align:right;padding:6px;border-bottom:1px solid #e5e7eb)">'+tr.price+'</th></tr></thead><tbody>';
    cart.forEach(function(it){
      html+='<tr><td style="padding:6px;border-bottom:1px solid #f3f4f6)">'+[it.brand,it.product,it.oe,it.num].filter(Boolean).join(' | ')+'</td>'+
            '<td style="padding:6px;text-align:right;border-bottom:1px solid #f3f4f6)">'+(it.qty||1)+'</td>'+
            '<td style="padding:6px;text-align:right;border-bottom:1px solid #f3f4f6)">'+(it.price||'')+'</td></tr>';
    });
    html+='</tbody></table>'; el.innerHTML=html;
  }
  function addByPayload(payload){
    try{
      var it = payload? JSON.parse(payload.replace(/&quot;/g,'"')) : null; if(!it) return;
      var cart = readCart(); var idx = cart.findIndex(function(x){ return String(x.num)===String(it.num); });
      if(idx===-1){ cart.push({ num:it.num, qty:1, price:it.price, brand:it.brand, product:it.product, oe:it.oe }); }
      else { cart[idx].qty = (cart[idx].qty||1)+1; }
      writeCart(cart);
    }catch(e){}
  }

  var mask=document.getElementById('list-mask');
  var modal=document.getElementById('list-modal');
  function openModal(){ renderCart(); if(mask) mask.style.display='block'; if(modal) modal.style.display='flex'; }
  function closeModal(){ if(mask) mask.style.display='none'; if(modal) modal.style.display='none'; }
  function gv(id){ var el=document.getElementById(id); return el && typeof el.value!=='undefined' ? el.value : ''; }

  // —— 直接绑定 ——（若DOM在首屏已可见）
  document.querySelectorAll('.btn-add').forEach(function(btn){
    btn.addEventListener('click', function(){
      var payload = btn.getAttribute('data-payload') || ''; addByPayload(payload);
      var txt = btn.innerText; btn.innerText = btn.getAttribute('data-added') || '${tFactory(cookies().get("lang")?.value==="en"?"en":"zh").added}';
      setTimeout(function(){ btn.innerText = txt; }, 1200);
    });
  });
  document.querySelectorAll('.btn-checkout').forEach(function(btn){ btn.addEventListener('click', openModal); });

  // —— 委托兜底 ——（兼容文本节点/图标点击）
  document.addEventListener('click', function(ev){
    var t = ev.target;
    var addBtn = closestSel(t, '.btn-add');
    if(addBtn){ addBtn.click(); return; }
    if(closestSel(t, '.btn-checkout')){ openModal(); return; }
    if(closestSel(t, '#l-cancel') || (mask && t===mask)){ closeModal(); return; }
    if(closestSel(t, '#l-submit')){
      var order={
        items: readCart(),
        contact:{ name: gv('l-name'), phone: gv('l-phone'), email: gv('l-email'),
          company: gv('l-company'), country: gv('l-country'),
          address: gv('l-address'), mode: gv('l-mode') || 'B2C', notes: gv('l-notes') },
        createdAt: new Date().toISOString()
      };
      try{
        var raw=localStorage.getItem('orders'); var arr=raw? JSON.parse(raw): [];
        arr.push(order); localStorage.setItem('orders', JSON.stringify(arr));
        localStorage.setItem('lastOrder', JSON.stringify(order));
        var tip=document.getElementById('l-tip'); if(tip) tip.textContent='${tFactory(cookies().get("lang")?.value==="en"?"en":"zh").submittedTip}';
      }catch(e){}
      return;
    }
  });
})();`,
        }}
      />
    </>
  );
}
