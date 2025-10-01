import Link from "next/link";
import { cookies } from "next/headers";

type Item = {
  num?: string; brand?: string; product?: string; oe?: string; model?: string;
  year?: string | number; price?: string | number; stock?: string | number;
  image?: string; images?: string[]; pics?: string[]; gallery?: string[]; imageUrls?: string[];
  productCn?: string; productEn?: string; productNameCn?: string; productNameEn?: string;
  partNameCn?: string; partNameEn?: string; stdNameCn?: string; stdNameEn?: string;
  summary?: string; description?: string; desc?: string; remark?: string;
  [k: string]: any;
};

const API_BASE = "https://niuniuparts.com:6001/scm-product/v1/stock2";

function tFactory(lang: "zh" | "en") {
  return lang === "en"
    ? {
        backToList: "Back to list",
        partName: "Part Name",
        summary: "Summary",
        description: "Description",
        brand: "Brand", product: "Product", oe: "OE", price: "Price", stock: "Stock",
        addToCart: "Add to Cart", added: "Added", checkout: "Proceed to Checkout",
        submitOrder: "Submit Order", cancel: "Cancel",
        contactName: "Name", phone: "Phone", email: "Email",
        company: "Company",
        country: "Country", address: "Address", mode: "Mode", note: "Notes",
        currency: "Currency", total: "Total",
        b2c: "B2C", b2b: "B2B",
        submittedTip: "Submitted (Demo): saved to local orders",
        requiredAll: "Please complete all required fields.",
        invalidEmail: "Invalid email format.",
        invalidPhone: "Invalid phone number.",
        item: "Item", qty: "Qty",
        downloadTpl: "Download Template", uploadNeeds: "Upload Needs (CSV)", register: "Register", hi: "Hi",
        needLogin: "Please register/login first.",
        uploadOk: "Uploaded: items have been added to cart.",
      }
    : {
        backToList: "返回列表",
        partName: "配件名称",
        summary: "Summary",
        description: "Description",
        brand: "品牌", product: "品名", oe: "OE", price: "价格", stock: "库存",
        addToCart: "加入购物车", added: "已加入", checkout: "去结算",
        submitOrder: "提交订单", cancel: "取消",
        contactName: "姓名 / Name", phone: "电话 / Phone", email: "邮箱 / Email",
        company: "公司",
        country: "国家 / Country", address: "地址 / Address", mode: "交易模式", note: "备注 / Notes",
        currency: "货币 / Currency", total: "合计",
        b2c: "B2C", b2b: "B2B",
        submittedTip: "提交成功（演示）：已保存到本地订单列表",
        requiredAll: "请完整填写所有必填字段。",
        invalidEmail: "邮箱格式不正确。",
        invalidPhone: "电话格式不正确。",
        item: "商品", qty: "数量",
        downloadTpl: "下载模板", uploadNeeds: "上传需求 (CSV)", register: "注册/登录", hi: "您好",
        needLogin: "请先完成注册/登录。",
        uploadOk: "上传成功：已将清单加入购物车。",
      };
}

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

function toInt(v: unknown, def: number) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : def;
}
async function fetchPageOnce(page: number, size: number, timeoutMs = 5000): Promise<Item[]> {
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
async function findInPage(num: string, page: number, size: number): Promise<Item | null> {
  const rows = await fetchPageOnce(page, size, 5000);
  return rows.find((x) => String(x?.num ?? "") === String(num)) || null;
}
async function fetchItemNear(num: string, p: number, size: number): Promise<Item | null> {
  const cur = await findInPage(num, p, size);
  if (cur) return cur;
  const [a, b] = await Promise.all([
    p > 0 ? findInPage(num, p - 1, size) : Promise.resolve(null),
    findInPage(num, p + 1, size),
  ]);
  return a || b || null;
}

function hasZh(s: string) { return /[\u4e00-\u9fff]/.test(s); }
function getStdNames(it: Item) {
  const candidatesCn = [it.stdNameCn, it.productCn, it.productNameCn, it.partNameCn].filter(Boolean) as string[];
  const candidatesEn = [it.stdNameEn, it.productEn, it.productNameEn, it.partNameEn].filter(Boolean) as string[];
  let cn = candidatesCn.find((x) => String(x).trim().length > 0) || "";
  let en = candidatesEn.find((x) => String(x).trim().length > 0) || "";
  if (!cn) {
    for (const [k, v] of Object.entries(it)) {
      if (typeof v === "string" && v && hasZh(v) && /(std|standard|name|product|part|desc)/.test(k.toLowerCase())) { cn = v; break; }
    }
  }
  if (!en) {
    for (const [k, v] of Object.entries(it)) {
      if (typeof v === "string" && v && !hasZh(v) && /(std|standard|name|product|part|desc|en)/.test(k.toLowerCase())) { en = v; break; }
    }
  }
  return { cn, en, summary: it.summary || "", description: it.description || it.desc || it.remark || "" };
}

function buildImages(item: Item) {
  const placeholder =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAQAAABx0wduAAAAAklEQVR42u3BMQEAAADCoPVPbQ0PoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8JwC0QABG4zJSwAAAABJRU5ErkJggg==";
  const raw: string[] =
    item.images || item.pics || item.gallery || item.imageUrls || (item.image ? [item.image] : []) || [];
  const seen = new Set<string>();
  const cleaned = raw
    .filter(Boolean).map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter((s) => s.length > 0)
    .filter((u) => { const k = u.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  const MIN = 18;
  const base = cleaned.length > 0 ? cleaned : [placeholder];
  const images: string[] = [];
  while (images.length < Math.max(MIN, base.length)) images.push(base[images.length % base.length]);
  return images;
}

/** 顶部语言 + 交易模式 + 模板/上传 + 注册条 */
function TopBar({ lang, mode }: { lang: "zh" | "en", mode: "B2C" | "B2B" }) {
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
        <button id="download-template" style={{ cursor: "pointer", background: "#fff", border: "1px solid #e5e7eb", padding: "4px 10px", borderRadius: 6 }}>
          {tFactory(lang).downloadTpl}
        </button>
        <button id="upload-needs" style={{ cursor: "pointer", background: "#fff", border: "1px solid #e5e7eb", padding: "4px 10px", borderRadius: 6 }}>
          {tFactory(lang).uploadNeeds}
        </button>
        <button id="btn-register" style={{ cursor: "pointer", background: "#111827", color: "#fff", border: "1px solid #111827", padding: "4px 10px", borderRadius: 6 }}>
          {tFactory(lang).register}
        </button>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: { num: string } }) {
  return { title: `Item ${params.num}` };
}

export default async function Page({ params, searchParams }:{ params:{ num:string }, searchParams?:{[k:string]:string|string[]|undefined} }) {
  const num = params.num;
  const p = toInt((searchParams?.p as string) ?? "0", 0);
  const size = toInt((searchParams?.s as string) ?? "20", 20);

  const item = await fetchItemNear(num, p, size);
  const langCookie = cookies().get("lang")?.value === "en" ? "en" : "zh";
  const modeCookie = cookies().get("mode")?.value === "B2B" ? "B2B" : "B2C";
  const tr = tFactory(langCookie);

  if (!item) {
    return (
      <div style={{ padding: 32 }}>
        <TopBar lang={langCookie} mode={modeCookie} />
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>未找到商品：{num}</h1>
        <Link href={`/stock?p=${p}`} prefetch style={{ display: "inline-block", marginTop: 16, padding: "8px 16px", background: "#111827", color: "#fff", borderRadius: 8, textDecoration: "none" }}>
          {tr.backToList}
        </Link>
      </div>
    );
  }

  const images = buildImages(item);
  const preloadCount = Math.min(8, images.length);
  const title = [item.brand, item.product, item.oe, num].filter(Boolean).join(" | ");
  const gal = `gal-${num}`;
  const backHref = `/stock?p=${p}`;
  const { cn: stdCn, en: stdEn, summary, description } = getStdNames(item);
  const shownPartNameEn = stdEn || (langCookie === "en" ? cnPartToEn(stdCn) : "");

  const css = `
.detail-wrap{ display:grid; gap:24px; padding:24px 0; grid-template-columns:1fr; align-items:start; }
@media (min-width: 960px){ .detail-wrap{ grid-template-columns:minmax(0,1fr) 1fr; } }
.gallery{ width:100%; }
.gallery .main{ width:100%; aspect-ratio:1/1; overflow:hidden; border-radius:16px; background:#fff; border:1px solid #eee; position:relative; }
.gallery .main img{ position:absolute; inset:0; width:100%; height:100%; object-fit:contain; display:none; }
.thumbs{ margin-top:12px; display:grid; gap:8px; grid-template-columns: repeat(9, 1fr); }
.thumbs label{ display:block; aspect-ratio:1/1; overflow:hidden; border-radius:8px; border:1px solid #e5e7eb; background:#fff; cursor:pointer; }
.thumbs img{ width:100%; height:100%; object-fit:cover; }
.gallery input[type="radio"]{ display:none; }

.modal-mask{ position:fixed; inset:0; background:rgba(0,0,0,.35); display:none; z-index:50; }
.modal{ position:fixed; left:50%; top:8vh; transform:translateX(-50%); width:min(720px,92vw); background:#fff; border:1px solid #e5e7eb; border-radius:12px; display:none; z-index:51; max-height:84vh; flex-direction:column; }
.modal header{ padding:12px 16px; font-weight:700; border-bottom:1px solid #e5e7eb; }
.modal .body{ padding:16px; display:grid; gap:12px; overflow:auto; flex:1; }
.modal .row{ display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.modal footer{ padding:12px 16px; border-top:1px solid #e5e7eb; display:flex; gap:8px; justify-content:flex-end; position:sticky; bottom:0; background:#fff; }
input,textarea,select{ border:1px solid #e5e7eb; border-radius:8px; padding:10px 12px; }
` + "\n" +
    images.map((_s, i) => `#${gal}-${i}:checked ~ .main img[data-idx="${i}"]{display:block}
#${gal}-${i}:checked ~ .thumbs label[for="${gal}-${i}"]{border:2px solid #2563eb}`).join("\n");

  return (
    <>
      <TopBar lang={langCookie} mode={modeCookie} />

      <link rel="prefetch" href={backHref} />
      {images.slice(0, preloadCount).map((src, i) => (<link key={`preload-${i}`} rel="preload" as="image" href={src} />))}

      <div className="detail-wrap">
        <div className="gallery">
          {images.map((_, i) => (<input key={`r-${i}`} type="radio" name={gal} id={`${gal}-${i}`} defaultChecked={i === 0} />))}
          <div className="main">
            {images.map((src, i) => (
              <img key={`main-${i}`} data-idx={i} src={src} alt="product" loading={i === 0 ? "eager" : "lazy"} fetchPriority={i === 0 ? "high" : "auto"} decoding={i === 0 ? "sync" : "async"} />
            ))}
          </div>
          <div className="thumbs">
            {images.map((src, i) => (
              <label key={`thumb-${i}`} htmlFor={`${gal}-${i}`} title={`第 ${i + 1} 张`}>
                <img src={src} alt={`thumb-${i + 1}`} loading="eager" decoding="sync" />
              </label>
            ))}
          </div>
        </div>

        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>{title}</h1>

          {(stdCn || shownPartNameEn) && (
            <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5 }}>
              {stdCn && <div><strong>{tr.partName}：</strong>{stdCn}</div>}
              {shownPartNameEn && <div><strong>Part Name:</strong> {shownPartNameEn}</div>}
            </div>
          )}

          {(summary || description) && (
            <div style={{ marginTop: 8, fontSize: 13, color: "#4b5563" }}>
              {summary && <div><strong>{tr.summary}：</strong>{summary}</div>}
              {description && <div><strong>{tr.description}：</strong>{description}</div>}
            </div>
          )}

          <dl style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 14 }}>
            {item.brand && (<div><dt style={{ color: "#6b7280" }}>{tr.brand}</dt><dd style={{ fontWeight: 600 }}>{item.brand}</dd></div>)}
            {item.product && (<div><dt style={{ color: "#6b7280" }}>{tr.product}</dt><dd style={{ fontWeight: 600 }}>{item.product}</dd></div>)}
            {item.oe && (<div><dt style={{ color: "#6b7280" }}>{tr.oe}</dt><dd style={{ fontWeight: 600 }}>{item.oe}</dd></div>)}
            {typeof item.price !== "undefined" && (<div><dt style={{ color: "#6b7280" }}>{tr.price}</dt><dd style={{ fontWeight: 600 }}>{String(item.price)}</dd></div>)}
            {typeof item.stock !== "undefined" && (<div><dt style={{ color: "#6b7280" }}>{tr.stock}</dt><dd style={{ fontWeight: 600 }}>{String(item.stock)}</dd></div>)}
          </dl>

          <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button id="add-cart" data-added={tr.added}
              style={{ padding: "8px 16px", borderRadius: 8, background: "#2563eb", color: "#fff", border: "none", cursor: "pointer" }}>
              {tr.addToCart}
            </button>
            <button id="go-checkout"
              style={{ padding: "8px 16px", borderRadius: 8, background: "#10b981", color: "#fff", border: "none", cursor: "pointer" }}>
              {tr.checkout}
            </button>
            <Link href={backHref} prefetch
              style={{ padding: "8px 16px", borderRadius: 8, background: "#fff", color: "#111827", border: "1px solid #e5e7eb", textDecoration: "none", textAlign: "center" }}>
              {tr.backToList}
            </Link>
          </div>
        </div>
      </div>

      {/* 结算弹窗 */}
      <div id="modal-mask" className="modal-mask"></div>
      <div id="checkout-modal" className="modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
        <header id="checkout-title">{tr.submitOrder}</header>
        <div className="body">
          <div id="cart-items" style={{ fontSize: 13, color: "#374151" }}></div>

          <div className="row" style={{ alignItems: "center" }}>
            <div>
              <label>{tr.currency} <span style={{color:"#dc2626"}}>*</span></label>
              <select id="o-currency" defaultValue="USD">
                <option value="CNY">人民币 CNY</option>
                <option value="USD">美元 USD</option>
                <option value="EUR">欧元 EUR</option>
              </select>
            </div>
            <div style={{ textAlign: "right", fontWeight: 700 }}>
              <span>{tr.total}：</span><span id="o-total">--</span>
            </div>
          </div>

          <div className="row">
            <div><label>{tr.contactName} <span style={{color:"#dc2626"}}>*</span></label><input id="o-name" /></div>
            <div><label>{tr.phone} <span style={{color:"#dc2626"}}>*</span></label><input id="o-phone" /></div>
          </div>
          <div className="row">
            <div><label>{tr.email} <span style={{color:"#dc2626"}}>*</span></label><input id="o-email" /></div>
            <div><label id="o-company-label">{tr.company} <span id="o-company-star" style={{color:"#dc2626",display: modeCookie==='B2B'?'inline':'none'}}>*</span></label><input id="o-company" /></div>
          </div>
          <div className="row">
            <div><label>{tr.country} <span style={{color:"#dc2626"}}>*</span></label><input id="o-country" /></div>
            <div><label>{tr.mode} <span style={{color:"#dc2626"}}>*</span></label>
              <select id="o-mode" defaultValue={modeCookie}><option value="B2C">{tr.b2c}</option><option value="B2B">{tr.b2b}</option></select>
            </div>
          </div>
          <div><label>{tr.address} <span style={{color:"#dc2626"}}>*</span></label><input id="o-address" /></div>
          <div><label>{tr.note} <span style={{color:"#dc2626"}}>*</span></label><textarea id="o-notes" rows={3}></textarea></div>
          <div id="o-tip" style={{ fontSize: 12 }}></div>
        </div>
        <footer>
          <button id="o-cancel" style={{ padding: "8px 14px", borderRadius: 8, background: "#fff", border: "1px solid #e5e7eb", cursor: "pointer" }}>{tr.cancel}</button>
          <button id="o-submit" style={{ padding: "8px 14px", borderRadius: 8, background: "#111827", color: "#fff", border: "1px solid #111827", cursor: "pointer" }}>{tr.submitOrder}</button>
        </footer>
      </div>

      {/* 注册弹窗 + 隐藏文件输入 */}
      <div id="reg-mask" className="modal-mask"></div>
      <div id="reg-modal" className="modal" role="dialog" aria-modal="true" aria-labelledby="reg-title">
        <header id="reg-title">{tr.register}</header>
        <div className="body">
          <div className="row">
            <div><label>{tr.contactName} *</label><input id="r-name" /></div>
            <div><label>{tr.email} *</label><input id="r-email" /></div>
          </div>
          <div id="r-tip" style={{ fontSize: 12, color: "#dc2626" }}></div>
        </div>
        <footer>
          <button id="r-cancel" style={{ padding: "8px 14px", borderRadius: 8, background: "#fff", border: "1px solid #e5e7eb", cursor: "pointer" }}>{tr.cancel}</button>
          <button id="r-submit" style={{ padding: "8px 14px", borderRadius: 8, background: "#111827", color: "#fff", border: "1px solid #111827", cursor: "pointer" }}>{tr.register}</button>
        </footer>
      </div>
      <input id="needs-file" type="file" accept=".csv" style={{ display: "none" }} />

      <style dangerouslySetInnerHTML={{ __html: css }} />

      <script
        dangerouslySetInnerHTML={{
          __html: `
(function(){
  var TR=${JSON.stringify(tr)}, MODE='${modeCookie}';

  function closestSel(node, sel){
    var el = node && node.nodeType===1 ? node : (node && node.parentElement);
    while(el){ if (el.matches && el.matches(sel)) return el; el = el.parentElement; }
    return null;
  }

  function setCookie(k,v){ document.cookie = k+'='+v+'; path=/; max-age='+(3600*24*365); }

  // 语言 & 模式切换（顶栏）
  document.addEventListener('click', function(e){
    var t=e.target;
    if(closestSel(t,'#lang-zh')){ setCookie('lang','zh'); location.reload(); return; }
    if(closestSel(t,'#lang-en')){ setCookie('lang','en'); location.reload(); return; }
    if(closestSel(t,'#mode-b2c')){ setCookie('mode','B2C'); location.reload(); return; }
    if(closestSel(t,'#mode-b2b')){ setCookie('mode','B2B'); location.reload(); return; }
  });

  // 轮播
  (function(){
    var name='${gal}', radios=[].slice.call(document.querySelectorAll('input[name="'+name+'"]')); if(!radios.length) return;
    var idx=radios.findIndex(function(r){return r.checked;}); if(idx<0) idx=0;
    function tick(){ idx=(idx+1)%radios.length; radios[idx].checked=true; }
    var timer=setInterval(tick,5000);
    radios.forEach(function(r,i){ r.addEventListener('change',function(){ idx=i; clearInterval(timer); timer=setInterval(tick,5000); }); });
  })();

  // 购物车
  function readCart(){ try{ var raw=localStorage.getItem('cart'); return raw? JSON.parse(raw): []; }catch(e){ return []; } }
  function writeCart(c){ try{ localStorage.setItem('cart', JSON.stringify(c)); }catch(e){} }
  function addCurrentToCart(){
    var cart=readCart();
    var item={ num:${JSON.stringify(item.num ?? "")}, price:${JSON.stringify(item.price ?? "")}, brand:${JSON.stringify(item.brand ?? "")}, product:${JSON.stringify(item.product ?? "")}, oe:${JSON.stringify(item.oe ?? "")} };
    var i=cart.findIndex(function(x){ return String(x.num)===String(item.num); });
    if(i===-1){ cart.push({ num:item.num, qty:1, price:item.price, brand:item.brand, product:item.product, oe:item.oe }); }
    else{ cart[i].qty=(cart[i].qty||1)+1; }
    writeCart(cart);
  }

  // 合计
  var RATES={ USD:1, CNY:7.2, EUR:0.92 };
  function computeTotal(currency){
    var cart=readCart();
    var sum=cart.reduce(function(acc,it){ var p=Number(it.price)||0; var q=Number(it.qty)||1; return acc + p*q; },0);
    var rate=RATES[currency]||1, val=sum*rate, sym=currency==='CNY'?'¥':(currency==='EUR'?'€':'$');
    return sym+' '+(Math.round(val*100)/100).toFixed(2);
  }
  function updateTotal(){
    var cur=(document.getElementById('o-currency')||{}).value || 'USD';
    var el=document.getElementById('o-total'); if(el) el.textContent = computeTotal(cur);
  }

  // 详情结算弹窗
  var mask=document.getElementById('modal-mask'), modal=document.getElementById('checkout-modal');
  function openModal(){ addCurrentToCart(); renderCart('cart-items'); updateTotal(); if(mask) mask.style.display='block'; if(modal) modal.style.display='flex'; syncCompanyStar(); }
  function closeModal(){ if(mask) mask.style.display='none'; if(modal) modal.style.display='none'; }
  function gv(id){ var el=document.getElementById(id); return el && typeof el.value!=='undefined' ? el.value.trim() : ''; }
  function markInvalid(id){ var el=document.getElementById(id); if(el){ el.style.borderColor='#dc2626'; el.focus(); } }
  function clearInvalid(id){ var el=document.getElementById(id); if(el){ el.style.borderColor='#e5e7eb'; } }
  function clearTip(){ var tip=document.getElementById('o-tip'); if(tip){ tip.style.color='#111827'; tip.textContent=''; } }

  function needCompany(){ var m=(document.getElementById('o-mode')||{}).value || 'B2C'; return m==='B2B'; }
  function syncCompanyStar(){ var star=document.getElementById('o-company-star'); if(star){ star.style.display = needCompany() ? 'inline' : 'none'; } }

  function validateAll(){
    clearTip();
    ['o-name','o-phone','o-email','o-country','o-address','o-notes','o-company'].forEach(clearInvalid);
    var req=['o-name','o-phone','o-email','o-country','o-address','o-notes'];
    if(needCompany()) req.push('o-company');
    for(var i=0;i<req.length;i++){ var id=req[i]; if(!gv(id)){ markInvalid(id); var tip=document.getElementById('o-tip'); if(tip){ tip.style.color='#dc2626'; tip.textContent='${tr.requiredAll}'; } return false; } }
    var email=gv('o-email'); var phone=gv('o-phone').replace(/\\D/g,'');
    if(!/^([^@\\s]+)@([^@\\s]+)\\.[^@\\s]+$/.test(email)){ markInvalid('o-email'); var t1=document.getElementById('o-tip'); if(t1){ t1.style.color='#dc2626'; t1.textContent='${tr.invalidEmail}'; } return false; }
    if(phone.length<5){ markInvalid('o-phone'); var t2=document.getElementById('o-tip'); if(t2){ t2.style.color='#dc2626'; t2.textContent='${tr.invalidPhone}'; } return false; }
    return true;
  }

  // 渲染购物车简表
  function renderCart(id){
    var el=document.getElementById(id); if(!el) return; var cart=readCart();
    if(!cart.length){ el.innerHTML='<div>${cookies().get("lang")?.value==="en"?"Cart is empty":"购物车为空"}</div>'; return; }
    var html='<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr>'+
             '<th style="text-align:left;padding:6px;border-bottom:1px solid #e5e7eb)">'+TR.item+'</th>'+
             '<th style="text-align:right;padding:6px;border-bottom:1px solid #e5e7eb)">'+TR.qty+'</th>'+
             '<th style="text-align:right;padding:6px;border-bottom:1px solid #e5e7eb)">'+TR.price+'</th></tr></thead><tbody>';
    cart.forEach(function(it){
      html+='<tr><td style="padding:6px;border-bottom:1px solid #f3f4f6)">'+[it.brand,it.product,it.oe,it.num].filter(Boolean).join(' | ')+'</td>'+
            '<td style="padding:6px;text-align:right;border-bottom:1px solid #f3f4f6)">'+(it.qty||1)+'</td>'+
            '<td style="padding:6px;text-align:right;border-bottom:1px solid #f3f4f6)">'+(it.price||'')+'</td></tr>';
    });
    html+='</tbody></table>'; el.innerHTML=html;
  }

  // 顶栏：下载模板 / 上传（需注册）
  function isLogin(){ try{ return !!localStorage.getItem('user'); }catch(e){ return false; } }
  function openReg(){ document.getElementById('reg-mask').style.display='block'; document.getElementById('reg-modal').style.display='flex'; }
  function closeReg(){ document.getElementById('reg-mask').style.display='none'; document.getElementById('reg-modal').style.display='none'; }

  function downloadTemplate(){
    var csv = 'num,oe,qty\\n# 例: 721012,69820-06160,2\\n';
    var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='ImgParts_Demand_Template.csv'; a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 500);
  }
  function parseCsv(text){
    var lines=text.split(/\\r?\\n/), out=[];
    lines.forEach(function(l){
      if(!l || /^\\s*#/.test(l)) return;
      var cols=l.split(',').map(function(s){ return s.trim(); });
      if(cols.length>=2){
        var num=cols[0]||'', oe=cols[1]||'', qty=Number(cols[2]||'1'); if(!qty||qty<1) qty=1;
        out.push({ num:num||oe, oe:oe, qty:qty });
      }
    });
    return out;
  }
  function uploadNeeds(){
    if(!isLogin()){ alert('${tr.needLogin}'); openReg(); return; }
    var fi=document.getElementById('needs-file'); if(fi) fi.click();
  }

  // 事件绑定
  document.addEventListener('click', function(e){
    var t=e.target;
    if(closestSel(t,'#download-template')){ downloadTemplate(); return; }
    if(closestSel(t,'#upload-needs')){ uploadNeeds(); return; }
    if(closestSel(t,'#btn-register')){ openReg(); return; }

    if(closestSel(t,'#o-cancel') || t===document.getElementById('modal-mask')){ closeModal(); return; }
    if(closestSel(t,'#o-submit')){
      if(!validateAll()) return;
      var order={
        items: readCart(),
        contact: { name: gv('o-name'), phone: gv('o-phone'), email: gv('o-email'),
          company: gv('o-company'), country: gv('o-country'),
          address: gv('o-address'), mode: gv('o-mode')||'B2C', notes: gv('o-notes'),
          currency: (document.getElementById('o-currency')||{}).value || 'USD',
          totalText: (document.getElementById('o-total')||{}).textContent || ''
        },
        createdAt: new Date().toISOString()
      };
      try{
        var raw=localStorage.getItem('orders'); var arr=raw? JSON.parse(raw): [];
        arr.push(order); localStorage.setItem('orders', JSON.stringify(arr));
        localStorage.setItem('lastOrder', JSON.stringify(order));
        var tip=document.getElementById('o-tip'); if(tip){ tip.style.color='#059669'; tip.textContent='${tr.submittedTip}'; }
      }catch(e){}
      return;
    }

    if(closestSel(t,'#add-cart')){ addCurrentToCart(); updateTotal(); var btn=document.getElementById('add-cart'); var txt=btn.innerText; btn.innerText=btn.getAttribute('data-added')||'已加入'; setTimeout(function(){ btn.innerText=txt; },1200); return; }
    if(closestSel(t,'#go-checkout')){ openModal(); return; }

    // 注册弹窗按钮
    if(closestSel(t,'#r-cancel') || t===document.getElementById('reg-mask')){ closeReg(); return; }
    if(closestSel(t,'#r-submit')){
      var nm=gv('r-name'), em=gv('r-email');
      if(!nm || !/^([^@\\s]+)@([^@\\s]+)\\.[^@\\s]+$/.test(em)){ var tp=document.getElementById('r-tip'); if(tp){ tp.textContent = '${tr.requiredAll}'; } return; }
      try{ localStorage.setItem('user', JSON.stringify({name:nm,email:em,ts:Date.now()})); }catch(e){}
      closeReg();
      return;
    }
  });

  document.addEventListener('change', function(e){
    var t=e.target;
    if(t && t.id==='o-currency') updateTotal();
    if(t && t.id==='o-mode') syncCompanyStar();
    if(t && t.id==='needs-file'){
      var f=t.files && t.files[0]; if(!f) return;
      var fr=new FileReader(); fr.onload=function(){ try{
        var rows=parseCsv(String(fr.result||'')); var cart=readCart();
        rows.forEach(function(r){ if(!r || !r.num) return; var i=cart.findIndex(function(x){ return String(x.num)===String(r.num); });
          if(i===-1) cart.push({ num:r.num, oe:r.oe, qty:r.qty });
          else cart[i].qty = (cart[i].qty||1) + r.qty;
        });
        writeCart(cart); alert('${tr.uploadOk}');
      }catch(e){} }; fr.readAsText(f, 'utf-8');
      (t as any).value='';
    }
  });

  // 打开页面时同步星号
  syncCompanyStar();

  // 详情“加入购物车/去结算”按钮已在上方 click 委托内处理
  // 预加载首图合计
  updateTotal();
})();`,
        }}
      />
    </>
  );
}

