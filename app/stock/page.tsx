// 库存页（SSR）：极速搜索 + 排序 + 标准术语展示 + 本地购物车 + 内置结算弹窗
// 维持：列表⇄详情秒开（链接附带 ?p=&s=）；返回列表即时
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
  for (let i = 0; i < 2; i++) {
    const rows = await fetchPageOnce(page, size, REQ_TIMEOUT);
    if (rows.length) return rows;
  }
  return [];
}

function norm(s: any) { return String(s ?? "").toLowerCase(); }
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
  if (sort === "price_asc") cp.sort((a, b) => Number(a.price ?? 0) - Number(b.price ?? 0));
  else if (sort === "price_desc") cp.sort((a, b) => Number(b.price ?? 0) - Number(a.price ?? 0));
  else if (sort === "stock_desc") cp.sort((a, b) => Number(b.stock ?? 0) - Number(a.stock ?? 0));
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
    .filter((u) => { const k = u.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  const placeholder =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAQAAABx0wduAAAAAklEQVR42u3BMQEAAADCoPVPbQ0PoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8JwC0QABG4zJSwAAAABJRU5ErkJggg==";
  return cleaned[0] || placeholder;
}
function titleOf(it: Item) { return [it.brand, it.product, it.oe, it.num].filter(Boolean).join(" | "); }
function stdCn(it: Item) { return it.stdNameCn || it.productCn || it.productNameCn || it.partNameCn || ""; }
function stdEn(it: Item) { return it.stdNameEn || it.productEn || it.productNameEn || it.partNameEn || ""; }

// 居中扫描顺序
function centeredOrder(p: number, max: number) {
  const out: number[] = [];
  let step = 0;
  while (out.length < max) {
    const a = p + step; if (a >= 0 && !out.includes(a)) out.push(a);
    if (out.length >= max) break;
    const b = p - step; if (b >= 0 && !out.includes(b)) out.push(b);
    step++;
  }
  if (!out.includes(0)) out.push(0);
  return out.slice(0, max);
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
    const pageRows = await fetchPageStable(p, SIZE);
    rows = pageRows.map((r) => ({ ...r, _page: p }));
    hasNext = pageRows.length === SIZE;
  } else {
    const order = centeredOrder(p, MAX_SCAN_PAGES);
    let found: Row[] = [];
    let reachedEnd = false;

    for (let i = 0; i < order.length && !reachedEnd && found.length < EARLY_STOP; i += BATCH) {
      const batchPages = order.slice(i, i + BATCH);
      const lists = await Promise.all(batchPages.map((pg) => fetchPageStable(pg, SEARCH_SIZE)));
      for (let j = 0; j < lists.length; j++) {
        const pg = batchPages[j];
        const list = lists[j];
        const filtered = list.filter((it) => matchQuery(it, q)).map((it) => ({ ...it, _page: pg }));
        found.push(...filtered);
        if (list.length < SEARCH_SIZE) reachedEnd = true;
      }
    }
    rows = found;
    hasNext = false;
  }

  rows = sortRows(rows, sort);
  const preloadImgs = rows.slice(0, 8).map(primaryImage);

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
      {preloadImgs.map((src, i) => (<link key={'preload-'+i} rel="preload" as="image" href={src} />))}

      <main style={{ padding: "24px 0" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>库存预览</h1>

        {/* 搜索 + 排序 */}
        <form method="GET" action="/stock" style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, marginBottom: 12 }}>
          <input name="q" defaultValue={q} placeholder="输入 OE / 品名 / 品牌 / 车型 进行搜索" aria-label="搜索"
                 style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb" }} />
          <select name="sort" defaultValue={sort} aria-label="排序"
                  style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff" }}>
            <option value="">默认排序</option>
            <option value="price_asc">价格从低到高</option>
            <option value="price_desc">价格从高到低</option>
            <option value="stock_desc">库存从高到低</option>
          </select>
          <button type="submit" style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #111827", background: "#111827", color: "#fff", cursor: "pointer" }}>
            搜索
          </button>
        </form>

        {/* 浏览模式分页条 */}
        {!q && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, fontSize: 14 }}>
            <Link href={prevHref} aria-disabled={p === 0}
                  style={{ pointerEvents: p === 0 ? "none" : "auto", padding: "6px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: p === 0 ? "#f3f4f6" : "#fff", color: "#111827", textDecoration: "none" }}>
              上一页
            </Link>
            <Link href={nextHref} aria-disabled={!hasNext}
                  style={{ pointerEvents: !hasNext ? "none" : "auto", padding: "6px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: !hasNext ? "#f3f4f6" : "#fff", color: "#111827", textDecoration: "none" }}>
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
              const sParam = q ? SEARCH_SIZE : SIZE;
              const href = `/stock/${encodeURIComponent(String(it.num ?? ""))}?p=${srcPage}&s=${sParam}`;
              const img = primaryImage(it);
              const title = titleOf(it);
              const scn = stdCn(it);
              const sen = stdEn(it);
              const dataPayload = JSON.stringify({
                num: it.num ?? "", price: it.price ?? "", brand: it.brand ?? "",
                product: it.product ?? "", oe: it.oe ?? ""
              }).replace(/"/g, "&quot;");
              return (
                <div key={String(it.num)}
                     style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <Link href={href} title="查看详情" prefetch>
                    <div style={{ width: "100%", aspectRatio: "1 / 1", overflow: "hidden", borderRadius: 10, background: "#fff", border: "1px solid #f3f4f6" }}>
                      <img src={img} alt={String(it.product ?? "product")} loading="eager" fetchPriority="high" decoding="sync"
                           style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    </div>
                  </Link>

                  <Link href={href} title={title} prefetch
                        style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.35, textDecoration: "none", color: "#111827" }}>
                    {title}
                  </Link>

                  {(scn || sen) && (
                    <div style={{ fontSize: 12, color: "#374151" }}>
                      {scn && <div>标准术语：{scn}</div>}
                      {sen && <div>Standard: {sen}</div>}
                    </div>
                  )}

                  <div style={{ fontSize: 12, color: "#4b5563", display: "grid", gap: 4 }}>
                    {it.oe && <div>OE：{it.oe}</div>}
                    {typeof it.price !== "undefined" && <div>价格：{String(it.price)}</div>}
                    {typeof it.stock !== "undefined" && <div>库存：{String(it.stock)}</div>}
                  </div>

                  <div style={{ marginTop: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn-add" data-payload={dataPayload}
                            style={{ flex: 1, padding: "8px 12px", borderRadius: 8, background: "#2563eb", color: "#fff", border: "none", cursor: "pointer" }}>
                      加入购物车
                    </button>
                    <button className="btn-checkout"
                            style={{ flex: 1, padding: "8px 12px", borderRadius: 8, background: "#10b981", color: "#fff", border: "none", cursor: "pointer" }}>
                      去结算
                    </button>
                    <Link href={href} prefetch aria-label="查看详情" title="查看详情"
                          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, background: "#fff", color: "#111827", border: "1px solid #e5e7eb", textAlign: "center", textDecoration: "none" }}>
                      查看详情
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 浏览模式底部分页 */}
        {!q && (
          <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
            <Link href={prevHref} aria-disabled={p === 0}
                  style={{ pointerEvents: p === 0 ? "none" : "auto", padding: "8px 16px", borderRadius: 8, border: "1px solid #e5e7eb", background: p === 0 ? "#f3f4f6" : "#fff", color: "#111827", textDecoration: "none" }}>
              上一页
            </Link>
            <Link href={nextHref} aria-disabled={!hasNext}
                  style={{ pointerEvents: !hasNext ? "none" : "auto", padding: "8px 16px", borderRadius: 8, border: "1px solid #e5e7eb", background: !hasNext ? "#f3f4f6" : "#fff", color: "#111827", textDecoration: "none" }}>
              下一页
            </Link>
            <span style={{ alignSelf: "center", color: "#6b7280" }}>第 {p + 1} 页</span>
          </div>
        )}
      </main>

      {/* 结算弹窗（列表页内置，React 风格 style 对象，避免字符串 style 报错） */}
      <div
        id="list-mask"
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, left: 0,
          background: "rgba(0,0,0,.35)", display: "none", zIndex: 50
        }}
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
          display: "none",
          zIndex: 51,
        }}
      >
        <div id="list-title" style={{ padding: "12px 16px", fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>
          提交订单
        </div>
        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          <div id="list-cart-items" style={{ fontSize: 13, color: "#374151" }}></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label>姓名 / Name</label><input id="l-name" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
            <div><label>电话 / Phone</label><input id="l-phone" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label>邮箱 / Email</label><input id="l-email" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
            <div><label>公司（可选）</label><input id="l-company" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label>国家 / Country</label><input id="l-country" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
            <div><label>交易模式</label>
              <select id="l-mode" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }}>
                <option value="B2C">B2C</option>
                <option value="B2B">B2B</option>
              </select>
            </div>
          </div>
          <div><label>地址 / Address</label><input id="l-address" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
          <div><label>备注 / Notes</label><textarea id="l-notes" rows={3} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
          <div id="l-tip" style={{ fontSize: 12, color: "#059669" }}></div>
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button id="l-cancel" style={{ padding: "8px 14px", borderRadius: 8, background: "#fff", border: "1px solid #e5e7eb", cursor: "pointer" }}>取消</button>
          <button id="l-submit" style={{ padding: "8px 14px", borderRadius: 8, background: "#111827", color: "#fff", border: "1px solid #111827", cursor: "pointer" }}>提交订单</button>
        </div>
      </div>

      {/* 列表页行为脚本（纯JS）：加入购物车即时“已加入” + 去结算弹窗 + 提交订单 */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function(){
  function readCart(){ try{ var raw=localStorage.getItem('cart'); return raw? JSON.parse(raw): []; }catch(e){ return []; } }
  function writeCart(c){ try{ localStorage.setItem('cart', JSON.stringify(c)); }catch(e){} }
  function gv(id){ var el=document.getElementById(id); return el && typeof el.value!=='undefined' ? el.value : ''; }

  // 绑定“加入购物车”（即时显示已加入）
  [].slice.call(document.querySelectorAll('.btn-add')).forEach(function(btn){
    btn.addEventListener('click', function(){
      try{
        var payload = btn.getAttribute('data-payload');
        var it = payload? JSON.parse(payload.replace(/&quot;/g,'"')) : null;
        var cart = readCart();
        if(it){
          var idx = cart.findIndex(function(x){ return String(x.num)===String(it.num); });
          if(idx===-1){ cart.push({ num:it.num, qty:1, price:it.price, brand:it.brand, product:it.product, oe:it.oe }); }
          else { cart[idx].qty = (cart[idx].qty||1)+1; }
          writeCart(cart);
          var t = btn.innerText; btn.innerText='已加入'; setTimeout(function(){ btn.innerText=t; }, 1200);
        }
      }catch(e){}
    });
  });

  // 结算弹窗
  var mask=document.getElementById('list-mask');
  var modal=document.getElementById('list-modal');
  function openModal(){
    // 渲染购物车
    var el=document.getElementById('list-cart-items');
    var cart=readCart();
    if(!cart.length){ el.innerHTML='<div>购物车为空</div>'; }
    else{
      var html='<table style="width:100%;border-collapse:collapse;font-size:13px">'+
               '<thead><tr><th style="text-align:left;padding:6px;border-bottom:1px solid #e5e7eb">商品</th>'+
               '<th style="text-align:right;padding:6px;border-bottom:1px solid #e5e7eb">数量</th>'+
               '<th style="text-align:right;padding:6px;border-bottom:1px solid #e5e7eb">价格</th></tr></thead><tbody>';
      cart.forEach(function(it){
        html+='<tr><td style="padding:6px;border-bottom:1px solid #f3f4f6">'+
              [it.brand,it.product,it.oe,it.num].filter(Boolean).join(' | ')+
              '</td><td style="padding:6px;text-align:right;border-bottom:1px solid #f3f4f6">'+(it.qty||1)+'</td>'+
              '<td style="padding:6px;text-align:right;border-bottom:1px solid #f3f4f6">'+(it.price||'')+'</td></tr>';
      });
      html+='</tbody></table>';
      el.innerHTML=html;
    }
    if(mask) mask.style.display='block';
    if(modal) modal.style.display='block';
  }
  function closeModal(){ if(mask) mask.style.display='none'; if(modal) modal.style.display='none'; }

  [].slice.call(document.querySelectorAll('.btn-checkout')).forEach(function(btn){
    btn.addEventListener('click', openModal);
  });
  var cancel=document.getElementById('l-cancel'); if(cancel) cancel.addEventListener('click', closeModal);
  if(mask) mask.addEventListener('click', closeModal);

  var submit=document.getElementById('l-submit');
  if(submit){
    submit.addEventListener('click', function(){
      var order={
        items: readCart(),
        contact:{
          name: gv('l-name'),
          phone: gv('l-phone'),
          email: gv('l-email'),
          company: gv('l-company'),
          country: gv('l-country'),
          address: gv('l-address'),
          mode: gv('l-mode') || 'B2C',
          notes: gv('l-notes')
        },
        createdAt:new Date().toISOString()
      };
      try{
        var raw=localStorage.getItem('orders'); var arr=raw? JSON.parse(raw): [];
        arr.push(order); localStorage.setItem('orders', JSON.stringify(arr));
        localStorage.setItem('lastOrder', JSON.stringify(order));
        var tip=document.getElementById('l-tip'); if(tip) tip.textContent='提交成功（演示）：已保存到本地订单列表';
      }catch(e){}
    });
  }
})();`,
        }}
      />
    </>
  );
}


