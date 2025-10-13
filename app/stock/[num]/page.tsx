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

/* ------------ Const ------------ */
const API_BASE = "https://niuniuparts.com:6001/scm-product/v1/stock2";
const SEARCH_SCAN_SIZE = 200;
const MAX_SCAN_PAGES = 10;
const REQ_TIMEOUT = 7000;

/* ------------ i18n ------------ */
function tFactory(lang: "zh" | "en") {
  return lang === "en"
    ? {
        back: "Back to List",
        brand: "Brand",
        oe: "OE",
        price: "Price",
        partName: "Part Name",
        addToCart: "Add to Cart",
        added: "Added",
        checkout: "Proceed to Checkout",
        submitOrder: "Submit Order",
        cancel: "Cancel",
        contactName: "Name", phone: "Phone", email: "Email",
        company: "Company", country: "Country", address: "Address", mode: "Mode", note: "Notes",
        currency: "Currency", total: "Total", b2c: "B2C", b2b: "B2B",
        emptyCart: "Cart is empty", qty: "Qty", item: "Item",
        submittedTip: "Submitted (Demo): saved to local orders",
        requiredAll: "Please complete all required fields.",
        invalidEmail: "Invalid email format.",
        invalidPhone: "Invalid phone number.",
        notFound: (n: string) => `Not found: ${n}`,
        datasource: "Data: niuniuparts.com (preview)",
        prevItem: "Previous",
        nextItem: "Next",
      }
    : {
        back: "返回列表",
        brand: "品牌",
        oe: "OE",
        price: "价格",
        partName: "配件名称",
        addToCart: "加入购物车",
        added: "已加入",
        checkout: "去结算",
        submitOrder: "提交订单",
        cancel: "取消",
        contactName: "姓名 / Name", phone: "电话 / Phone", email: "邮箱 / Email",
        company: "公司", country: "国家 / Country", address: "地址 / Address", mode: "交易模式", note: "备注 / Notes",
        currency: "货币 / Currency", total: "合计", b2c: "B2C", b2b: "B2B",
        emptyCart: "购物车为空", qty: "数量", item: "商品",
        submittedTip: "提交成功（演示）：已保存到本地订单列表",
        requiredAll: "请完整填写所有必填字段。",
        invalidEmail: "邮箱格式不正确。",
        invalidPhone: "电话格式不正确。",
        notFound: (n: string) => `未找到商品：${n}`,
        datasource: "数据源：niuniuparts.com（测试预览用途）",
        prevItem: "上一条",
        nextItem: "下一条",
      };
}

/* ------------ Helpers ------------ */
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
function norm(s: any) { return String(s ?? "").toLowerCase(); }
function matchNum(it: Item, num: string) {
  if (!num) return false;
  const n = num.toLowerCase();
  return norm(it.num) === n || norm(it.product) === n || norm(it.oe) === n;
}

async function fetchPage(page: number, size: number, timeoutMs = REQ_TIMEOUT): Promise<Item[]> {
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

/* ------------ Page ------------ */
export default async function DetailPage({
  params, searchParams,
}: {
  params: { num: string },
  searchParams?: { [k: string]: string | string[] | undefined }
}) {
  const langCookie: "zh" | "en" = cookies().get("lang")?.value === "en" ? "en" : "zh";
  const modeCookie: "B2C" | "B2B" = cookies().get("mode")?.value === "B2B" ? "B2B" : "B2C";
  const tr = tFactory(langCookie);

  const p = Number((searchParams?.p as string) ?? "0") || 0;
  const size = Number((searchParams?.s as string) ?? String(SEARCH_SCAN_SIZE)) || SEARCH_SCAN_SIZE;

  // 按中心页扫描并保存命中页的数据，用于上一条/下一条
  let item: Item | null = null; let foundPage = p; let pageList: Item[] = [];
  const centerOrder = (function centered(pp: number, max: number) {
    const out: number[] = []; let step = 0;
    while (out.length < max) {
      const a = pp + step; if (a >= 0 && !out.includes(a)) out.push(a);
      const b = pp - step; if (b >= 0 && !out.includes(b)) out.push(b);
      step++;
    }
    if (!out.includes(0)) out.push(0);
    return out.slice(0, max);
  })(p, MAX_SCAN_PAGES);

  for (const pg of centerOrder) {
    const list = await fetchPage(pg, size);
    const hit = list.find((it) => matchNum(it, params.num));
    if (hit) { item = hit; foundPage = pg; pageList = list; break; }
  }

  if (!item) {
    return (
      <main style={{ padding: "24px 0" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>ImgParts 预览站</h1>
        <div style={{ fontSize: 16, marginBottom: 16 }}>{tr.notFound(params.num)}</div>
        <Link href="/stock" style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #e5e7eb", textDecoration: "none", color: "#111827" }}>
          {tr.back}
        </Link>
        <div style={{ marginTop: 24, color: "#6b7280" }}>{tr.datasource}</div>
      </main>
    );
  }

  // 上一条/下一条
  const idxInPage = pageList.findIndex((x) => matchNum(x, String(item!.num)));
  const prevItem = idxInPage > 0 ? pageList[idxInPage - 1] : null;
  const nextItem = idxInPage >= 0 && idxInPage < pageList.length - 1 ? pageList[idxInPage + 1] : null;
  const mkHref = (it: Item | null) => it ? `/stock/${encodeURIComponent(String(it.num ?? ""))}?p=${foundPage}&s=${size}` : "#";

  // 图片集合：去重并补足 ≥18
  const raw: string[] = item.images || item.pics || item.gallery || item.imageUrls || (item.image ? [item.image] : []) || [];
  const seen = new Set<string>();
  const cleaned = raw.filter(Boolean).map((s) => (typeof s === "string" ? s.trim() : "")).filter((s) => s.length > 0)
    .filter((u) => { const k = u.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  let gallery = cleaned.length ? [...cleaned] : [
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAQAAABx0wduAAAAAklEQVR42u3BMQEAAADCoPVPbQ0PoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8JwC0QABG4zJSwAAAABJRU5ErkJggg==",
  ];
  for (let i = 0; gallery.length < 18 && i < 36; i++) gallery.push(gallery[i % gallery.length]);

  const scn = stdCn(item);
  const sen = stdEn(item);
  const partEn = sen || (langCookie === "en" ? cnPartToEn(scn) : "");
  const backHref = `/stock?p=${foundPage}&s=${size}`;
  const title = [item.brand, item.product, item.oe, item.num].filter(Boolean).join(" | ");
  const payload = JSON.stringify({
    num: item.num ?? "", price: item.price ?? "", brand: item.brand ?? "", product: item.product ?? "", oe: item.oe ?? "",
  }).replace(/"/g, "&quot;");

  return (
    <>
      {gallery.slice(0,8).map((src, i) => (<link key={'preload-'+i} rel="preload" as="image" href={src} />))}

      <main style={{ padding: "24px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{title}</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href={mkHref(prevItem)} aria-disabled={!prevItem}
              style={{ pointerEvents: prevItem ? "auto" : "none", padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: prevItem ? "#fff" : "#f3f4f6", textDecoration: "none", color: "#111827" }}>
              {tr.prevItem}
            </Link>
            <Link href={mkHref(nextItem)} aria-disabled={!nextItem}
              style={{ pointerEvents: nextItem ? "auto" : "none", padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: nextItem ? "#fff" : "#f3f4f6", textDecoration: "none", color: "#111827" }}>
              {tr.nextItem}
            </Link>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 720px) 1fr", gap: 24, alignItems: "start" }}>
          {/* 左：大图 + 缩略图 */}
          <section>
            <div id="main-img-wrap" style={{
              width: "100%", aspectRatio: "1 / 1", border: "1px solid #f3f4f6", borderRadius: 12,
              display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#fff"
            }}>
              <img id="main-img" src={gallery[0]} alt="product" loading="eager" fetchPriority="high" decoding="sync"
                   style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>

            {/* 缩略图横向轮播 */}
            <div id="thumbs" style={{ marginTop: 12, display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
              {gallery.map((src, idx) => (
                <button key={idx} className="thumb" data-idx={idx}
                        style={{ flex: "0 0 auto", width: 86, height: 86, borderRadius: 10, overflow: "hidden",
                                 border: idx === 0 ? "2px solid #2563eb" : "1px solid #e5e7eb", cursor: "pointer", background: "#fff" }}>
                  <img src={src} alt={"thumb-"+idx} loading={idx < 6 ? "eager" : "lazy"}
                       style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </button>
              ))}
            </div>
          </section>

          {/* 右：信息与按钮 */}
          <section>
            <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
              {item.brand && <div><strong>{tr.brand}</strong>：{item.brand}</div>}
              {item.oe && <div><strong>{tr.oe}</strong>：{item.oe}</div>}
              {typeof item.price !== "undefined" && <div><strong>{tr.price}</strong>：{String(item.price)}</div>}
            </div>

            {(scn || partEn) && (
              <div style={{ marginTop: 12, fontSize: 14, color: "#374151" }}>
                {scn && <div>{tr.partName}：{scn}</div>}
                {partEn && <div>Part Name: {partEn}</div>}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
              <button id="d-add" data-payload={payload} data-added={tr.added}
                      style={{ padding: "10px 16px", borderRadius: 8, background: "#2563eb", color: "#fff", border: "none", cursor: "pointer" }}>
                {tr.addToCart}
              </button>
              <button id="d-checkout"
                      style={{ padding: "10px 16px", borderRadius: 8, background: "#10b981", color: "#fff", border: "none", cursor: "pointer" }}>
                {tr.checkout}
              </button>
              <Link id="btn-back" href={backHref}
                    style={{ padding: "10px 16px", borderRadius: 8, background: "#fff", color: "#111827", border: "1px solid #e5e7eb", textDecoration: "none" }}>
                {tr.back}
              </Link>
            </div>
          </section>
        </div>

        <div style={{ marginTop: 24, color: "#6b7280" }}>{tr.datasource}</div>
      </main>

      {/* 结算弹窗（与列表页一致） */}
      <div id="mask" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "none", zIndex: 50 }} />
      <div id="modal" role="dialog" aria-modal="true" aria-labelledby="d-title"
           style={{ position: "fixed", left: "50%", top: "8vh", transform: "translateX(-50%)", width: "min(720px, 92vw)", background: "#fff",
                    border: "1px solid #e5e7eb", borderRadius: 12, display: "none", zIndex: 51, maxHeight: "84vh", flexDirection: "column" }}>
        <div id="d-title" style={{ padding: "12px 16px", fontWeight: 700, borderBottom: "1px solid #e5e7eb" }}>{tr.submitOrder}</div>
        <div style={{ padding: 16, display: "grid", gap: 12, overflow: "auto", flex: 1 }}>
          <div id="cart-items" style={{ fontSize: 13, color: "#374151" }}></div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center", gap: 8 }}>
            <div>
              <label>{tr.currency} <span style={{color:"#dc2626"}}>*</span></label>
              <select id="d-currency" defaultValue="USD">
                <option value="CNY">人民币 CNY</option>
                <option value="USD">美元 USD</option>
                <option value="EUR">欧元 EUR</option>
              </select>
            </div>
            <div id="d-total" style={{ textAlign: "right", fontWeight: 700 }}>{tr.total}：--</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label>{tr.contactName} <span style={{color:"#dc2626"}}>*</span></label><input id="d-name" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
            <div><label>{tr.phone} <span style={{color:"#dc2626"}}>*</span></label><input id="d-phone" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label>{tr.email} <span style={{color:"#dc2626"}}>*</span></label><input id="d-email" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
            <div><label id="d-company-label">{tr.company} <span id="d-company-star" style={{color:"#dc2626",display: modeCookie==='B2B'?'inline':'none'}}>*</span></label><input id="d-company" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div><label>{tr.country} <span style={{color:"#dc2626"}}>*</span></label><input id="d-country" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
            <div><label>{tr.mode} <span style={{color:"#dc2626"}}>*</span></label>
              <select id="d-mode" defaultValue={modeCookie} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }}>
                <option value="B2C">{tr.b2c}</option><option value="B2B">{tr.b2b}</option>
              </select>
            </div>
          </div>
          <div><label>{tr.address} <span style={{color:"#dc2626"}}>*</span></label><input id="d-address" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
          <div><label>{tr.note} <span style={{color:"#dc2626"}}>*</span></label><textarea id="d-notes" rows={3} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px" }} /></div>
          <div id="d-tip" style={{ fontSize: 12 }}></div>
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 8, justifyContent: "flex-end", position: "sticky", bottom: 0, background: "#fff" }}>
          <button id="d-cancel" style={{ padding: "8px 14px", borderRadius: 8, background: "#fff", border: "1px solid #e5e7eb", cursor: "pointer" }}>{tr.cancel}</button>
          <button id="d-submit" style={{ padding: "8px 14px", borderRadius: 8, background: "#111827", color: "#fff", border: "1px solid #111827", cursor: "pointer" }}>{tr.submitOrder}</button>
        </div>
      </div>

      {/* 交互脚本：事件委托 + 轮播定时器，afterInteractive 确保执行 */}
      <Script id="detail-page-js" strategy="afterInteractive">{`
(function(){
  var GALLERY = ${JSON.stringify(gallery)};
  var idx=0, timer;

  function $(sel){ return document.querySelector(sel); }
  function $all(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function show(i){
    idx=(i+GALLERY.length)%GALLERY.length;
    var main=$('#main-img'); if(main){ (main as HTMLImageElement).src=GALLERY[idx]; }
    $all('#thumbs .thumb').forEach(function(b,j){
      (b as HTMLElement).style.border = j===idx ? '2px solid #2563eb' : '1px solid #e5e7eb';
      if(j===idx){ try{ b.scrollIntoView({inline:'center', block:'nearest', behavior:'smooth'}); }catch(e){} }
    });
  }
  function start(){ stop(); timer=setInterval(function(){ show(idx+1); }, 5000); }
  function stop(){ if(timer) clearInterval(timer); }

  // 初始展示 + 定时轮播
  show(0); start();

  // === 事件委托：所有点击统一在 document 上 ===
  document.addEventListener('click', function(e){
    var t=e.target as HTMLElement;

    // 缩略图点击 → 切换大图 + 重启轮播
    if(t && (t.closest && t.closest('.thumb'))){
      var btn=t.closest('.thumb') as HTMLElement; var i=Number(btn.getAttribute('data-idx')||'0'); show(i); start(); return;
    }

    // 加入购物车
    if(t && (t.id==='d-add' || t.closest('#d-add'))){
      var btn=document.getElementById('d-add') as HTMLElement;
      var payload = btn.getAttribute('data-payload') || '';
      try{
        var it = payload? JSON.parse(payload.replace(/&quot;/g,'"')) : null; if(!it) return;
        var cart = readCart(); var pos = cart.findIndex(function(x){ return String(x.num)===String(it.num); });
        if(pos===-1){ cart.push({ num:it.num, qty:1, price:it.price, brand:it.brand, product:it.product, oe:it.oe }); }
        else { cart[pos].qty = (cart[pos].qty||1)+1; }
        writeCart(cart);
      }catch(e){}
      var txt = btn.innerText; btn.innerText = btn.getAttribute('data-added') || (document.documentElement.lang==='en'?'Added':'已加入');
      setTimeout(function(){ btn.innerText = txt; }, 1200);
      return;
    }

    // 去结算
    if(t && (t.id==='d-checkout' || t.closest('#d-checkout'))){ openModal(); return; }

    // 弹窗内按钮
    if(t && (t.id==='d-cancel' || t===document.getElementById('mask'))){ closeModal(); return; }
    if(t && (t.classList && (t.classList.contains('q-inc') || t.classList.contains('q-dec') || t.classList.contains('q-del')))){
      var trEl = t.closest('tr'); if(!trEl) return; var i = Number(trEl.getAttribute('data-idx')||'-1'); if(i<0) return;
      var cart=readCart(); if(i>=cart.length) return;
      if(t.classList.contains('q-inc')) cart[i].qty = (cart[i].qty||1)+1;
      else if(t.classList.contains('q-dec')) cart[i].qty = Math.max(1,(cart[i].qty||1)-1);
      else if(t.classList.contains('q-del')) cart.splice(i,1);
      writeCart(cart); renderCart(); updateTotal();
      return;
    }
    if(t && t.id==='d-submit'){
      if(!validateAll()) return;
      var order={
        items: readCart(),
        contact:{ name: gv('d-name'), phone: gv('d-phone'), email: gv('d-email'),
          company: gv('d-company'), country: gv('d-country'),
          address: gv('d-address'), mode: gv('d-mode') || 'B2C', notes: gv('d-notes'),
          currency: (document.getElementById('d-currency')||{}).value || 'USD',
          totalText: (document.getElementById('d-total')||{}).textContent || ''
        },
        createdAt: new Date().toISOString()
      };
      try{
        var raw=localStorage.getItem('orders'); var arr=raw? JSON.parse(raw): [];
        arr.push(order); localStorage.setItem('orders', JSON.stringify(arr));
        localStorage.setItem('lastOrder', JSON.stringify(order));
        var tip=document.getElementById('d-tip'); if(tip){ (tip as HTMLElement).style.color='#059669'; tip.textContent=(document.documentElement.lang==='en'?'Submitted (Demo): saved to local orders':'提交成功（演示）：已保存到本地订单列表'); }
      }catch(e){}
      return;
    }
  });

  // 变更事件
  document.addEventListener('change', function(e){
    var t=e.target as HTMLElement;
    if(t && t.id==='d-currency') updateTotal();
    if(t && t.id==='d-mode'){ var star=document.getElementById('d-company-star'); if(star){ (star as HTMLElement).style.display = ((document.getElementById('d-mode') as HTMLSelectElement).value==='B2B')?'inline':'none'; } }
  });

  // —— 工具函数 —— 
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
    var cur=(document.getElementById('d-currency')||{}).value || 'USD';
    var el=document.getElementById('d-total'); if(el) el.textContent = (document.documentElement.lang==='en'?'Total':'合计')+'：'+computeTotal(cur);
  }
  function gv(id){ var el=document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null; return el && typeof el.value!=='undefined' ? el.value.trim() : ''; }
  function markInvalid(id){ var el=document.getElementById(id); if(el){ (el as HTMLElement).style.borderColor='#dc2626'; (el as HTMLElement).focus(); } }
  function clearInvalid(id){ var el=document.getElementById(id); if(el){ (el as HTMLElement).style.borderColor='#e5e7eb'; } }
  function clearTip(){ var tip=document.getElementById('d-tip'); if(tip){ tip.textContent=''; (tip as HTMLElement).style.color='#111827'; } }
  function needCompany(){ var m=(document.getElementById('d-mode') as HTMLSelectElement | null)?.value || 'B2C'; return m==='B2B'; }
  function validateAll(){
    clearTip();
    ['d-name','d-phone','d-email','d-country','d-address','d-notes','d-company'].forEach(clearInvalid);
    var req=['d-name','d-phone','d-email','d-country','d-address','d-notes']; if(needCompany()) req.push('d-company');
    for(var i=0;i<req.length;i++){ var id=req[i]; if(!gv(id)){ markInvalid(id); var tip=document.getElementById('d-tip'); if(tip){ (tip as HTMLElement).style.color='#dc2626'; tip.textContent=(document.documentElement.lang==='en'?'Please complete all required fields.':'请完整填写所有必填字段。'); } return false; } }
    var email=gv('d-email'); var phone=gv('d-phone').replace(/\\D/g,'');
    if(!/^([^@\\s]+)@([^@\\s]+)\\.[^@\\s]+$/.test(email)){ markInvalid('d-email'); var t1=document.getElementById('d-tip'); if(t1){ (t1 as HTMLElement).style.color='#dc2626'; t1.textContent=(document.documentElement.lang==='en'?'Invalid email format.':'邮箱格式不正确。'); } return false; }
    if(phone.length<5){ markInvalid('d-phone'); var t2=document.getElementById('d-tip'); if(t2){ (t2 as HTMLElement).style.color='#dc2626'; t2.textContent=(document.documentElement.lang==='en'?'Invalid phone number.':'电话格式不正确。'); } return false; }
    return true;
  }
  var mask=document.getElementById('mask'), modal=document.getElementById('modal');
  function openModal(){ renderCart(); updateTotal(); if(mask) (mask as HTMLElement).style.display='block'; if(modal) (modal as HTMLElement).style.display='flex'; syncCompanyStar(); }
  function closeModal(){ if(mask) (mask as HTMLElement).style.display='none'; if(modal) (modal as HTMLElement).style.display='none'; }
  function syncCompanyStar(){ var star=document.getElementById('d-company-star'); if(star){ (star as HTMLElement).style.display = needCompany() ? 'inline' : 'none'; } }
  function rowTitle(it:any){ return [it.brand,it.product,it.oe,it.num].filter(Boolean).join(' | '); }
  function renderCart(){
    var el=document.getElementById('cart-items'); if(!el) return;
    var cart=readCart(); if(!cart.length){ el.innerHTML='<div>'+(document.documentElement.lang==='en'?'Cart is empty':'购物车为空')+'</div>'; return; }
    var html='<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr>'+
             '<th style="text-align:left;padding:6px;border-bottom:1px solid #e5e7eb)">'+(document.documentElement.lang==='en'?'Item':'商品')+'</th>'+
             '<th style="text-align:right;padding:6px;border-bottom:1px solid #e5e7eb)">'+(document.documentElement.lang==='en'?'Qty':'数量')+'</th>'+
             '<th style="text-align:right;padding:6px;border-bottom:1px solid #e5e7eb)">'+(document.documentElement.lang==='en'?'Price':'价格')+'</th></tr></thead><tbody>';
    cart.forEach(function(it,idx){
      html+='<tr data-idx="'+idx+'"><td style="padding:6px;border-bottom:1px solid #f3f4f6)">'+rowTitle(it)+'</td>'+
            '<td style="padding:6px;text-align:right;border-bottom:1px solid #f3f4f6)">'+
              '<button class="q-dec" style="margin-right:6px">-</button>'+
              '<span class="q-num">'+(it.qty||1)+'</span>'+
              '<button class="q-inc" style="margin-left:6px">+</button>'+
              '<button class="q-del" style="margin-left:12px">✕</button>'+
            '</td>'+
            '<td style="padding:6px;text-align:right;border-bottom:1px solid #f3f4f6)">'+(it.price||'')+'</td></tr>';
    });
    html+='</tbody></table>'; (el as HTMLElement).innerHTML=html;
  }

  // 初始合计
  updateTotal();
})();
      `}</Script>
    </>
  );
}
