// 详情页：两栏布局 + 缩略图轮播（5s自动）+ 预加载
// 更新：提交订单表单“所有字段必填”（含邮箱/电话格式校验），错误高亮与提示；货币+合计保持
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
        company: "Company",                     // 必填
        country: "Country", address: "Address", mode: "Mode", note: "Notes",
        currency: "Currency", total: "Total",
        b2c: "B2C", b2b: "B2B",
        submittedTip: "Submitted (Demo): saved to local orders",
        requiredAll: "Please complete all required fields.",
        invalidEmail: "Invalid email format.",
        invalidPhone: "Invalid phone number.",
        item: "Item", qty: "Qty",
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
        company: "公司",                           // 必填
        country: "国家 / Country", address: "地址 / Address", mode: "交易模式", note: "备注 / Notes",
        currency: "货币 / Currency", total: "合计",
        b2c: "B2C", b2b: "B2B",
        submittedTip: "提交成功（演示）：已保存到本地订单列表",
        requiredAll: "请完整填写所有必填字段。",
        invalidEmail: "邮箱格式不正确。",
        invalidPhone: "电话格式不正确。",
        item: "商品", qty: "数量",
      };
}

// —— 中文配件名到英文（兜底） ——
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

// —— 顶部语言条 ——
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

export async function generateMetadata({ params }: { params: { num: string } }) {
  return { title: `Item ${params.num}` };
}

export default async function Page({ params, searchParams }:{ params:{ num:string }, searchParams?:{[k:string]:string|string[]|undefined} }) {
  const num = params.num;
  const p = toInt((searchParams?.p as string) ?? "0", 0);
  const size = toInt((searchParams?.s as string) ?? "20", 20);

  const item = await fetchItemNear(num, p, size);
  const langCookie = cookies().get("lang")?.value === "en" ? "en" : "zh";
  const tr = tFactory(langCookie);

  if (!item) {
    return (
      <div style={{ padding: 32 }}>
        <LangBar lang={langCookie} />
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

/* 弹窗 */
.modal-mask{ position:fixed; inset:0; background:rgba(0,0,0,.35); display:none; z-index:50; }
.modal{ position:fixed; left:50%; top:8vh; transform:translateX(-50%); width:min(720px,92vw); background:#fff; border:1px solid #e5e7eb; border-radius:12px; display:none; zIndex:51; max-height:84vh; flex-direction:column; }
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
      <LangBar lang={langCookie} />

      {/* 预取返回列表 + 预加载首图 */}
      <link rel="prefetch" href={backHref} />
      {images.slice(0, preloadCount).map((src, i) => (<link key={`preload-${i}`} rel="preload" as="image" href={src} />))}

      <div className="detail-wrap">
        {/* 左：大图 + 缩略图 */}
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

        {/* 右：信息与操作 */}
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

          {/* 货币 + 合计 */}
          <div className="row" style={{ alignItems: "center" }}>
            <div>
              <label>{tr.currency} <span style={{color:"#dc2626"}}>*</span></label>
              <select id="o-currency">
                <option value="CNY">人民币 CNY</option>
                <option value="USD" defaultValue="selected">美元 USD</option>
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
            <div><label>{tr.company} <span style={{color:"#dc2626"}}>*</span></label><input id="o-company" /></div>
          </div>
          <div className="row">
            <div><label>{tr.country} <span style={{color:"#dc2626"}}>*</span></label><input id="o-country" /></div>
            <div><label>{tr.mode} <span style={{color:"#dc2626"}}>*</span></label>
              <select id="o-mode"><option value="B2C">{tr.b2c}</option><option value="B2B">{tr.b2b}</option></select>
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

      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* 事件脚本 */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function(){
  var TR = ${JSON.stringify(tr)};

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

  // 轮播：5s 自动
  (function(){
    var name='${gal}';
    var radios=[].slice.call(document.querySelectorAll('input[name="'+name+'"]'));
    if(!radios.length) return; var idx=radios.findIndex(function(r){return r.checked;}); if(idx<0) idx=0;
    function tick(){ idx=(idx+1)%radios.length; radios[idx].checked=true; }
    var timer=setInterval(tick,5000);
    radios.forEach(function(r,i){ r.addEventListener('change',function(){ idx=i; clearInterval(timer); timer=setInterval(tick,5000); }); });
  })();

  function readCart(){ try{ var raw=localStorage.getItem('cart'); return raw? JSON.parse(raw): []; }catch(e){ return []; } }
  function writeCart(c){ try{ localStorage.setItem('cart', JSON.stringify(c)); }catch(e){} }

  // 渲染购物车表
  function renderCart(tableId){
    var el=document.getElementById(tableId); var cart=readCart(); if(!el) return;
    if(!cart.length){ el.innerHTML='<div>'+(${JSON.stringify(langCookie==='en'?'Cart is empty':'购物车为空')})+'</div>'; return; }
    var html='<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr>'+
             '<th style="text-align:left;padding:6px;border-bottom:1px solid #e5e7eb">'+TR.item+'</th>'+
             '<th style="text-align:right;padding:6px;border-bottom:1px solid #e5e7eb)">'+TR.qty+'</th>'+
             '<th style="text-align:right;padding:6px;border-bottom:1px solid #e5e7eb)">'+TR.price+'</th></tr></thead><tbody>';
    cart.forEach(function(it){
      html+='<tr><td style="padding:6px;border-bottom:1px solid #f3f4f6)">'+[it.brand,it.product,it.oe,it.num].filter(Boolean).join(' | ')+'</td>'+
            '<td style="padding:6px;text-align:right;border-bottom:1px solid #f3f4f6)">'+(it.qty||1)+'</td>'+
            '<td style="padding:6px;text-align:right;border-bottom:1px solid #f3f4f6)">'+(it.price||'')+'</td></tr>';
    });
    html+='</tbody></table>'; el.innerHTML=html;
  }

  // —— 合计 & 货币 ——
  var RATES = { USD:1, CNY:7.2, EUR:0.92 };
  function computeTotal(currency){
    var cart=readCart();
    var sum=cart.reduce(function(acc,it){ var p=Number(it.price)||0; var q=Number(it.qty)||1; return acc + p*q; },0);
    var rate=RATES[currency]||1;
    var val=sum*rate;
    var sym=currency==='CNY'?'¥':(currency==='EUR'?'€':'$');
    return sym+' '+(Math.round(val*100)/100).toFixed(2);
  }
  function updateTotal(){
    var curEl=document.getElementById('o-currency'); var cur = (curEl && curEl.value) || 'USD';
    var el=document.getElementById('o-total'); if(el) el.textContent = computeTotal(cur);
  }

  // 把当前详情加入购物车（用于去结算前）
  function addCurrentToCart(){
    var cart=readCart();
    var item={ num:${JSON.stringify(item.num ?? "")}, price:${JSON.stringify(item.price ?? "")}, brand:${JSON.stringify(item.brand ?? "")}, product:${JSON.stringify(item.product ?? "")}, oe:${JSON.stringify(item.oe ?? "")} };
    var i=cart.findIndex(function(x){ return String(x.num)===String(item.num); });
    if(i===-1){ cart.push({ num:item.num, qty:1, price:item.price, brand:item.brand, product:item.product, oe:item.oe }); }
    else{ cart[i].qty=(cart[i].qty||1)+1; }
    writeCart(cart);
  }

  var mask=document.getElementById('modal-mask');
  var modal=document.getElementById('checkout-modal');
  function openModal(){ addCurrentToCart(); renderCart('cart-items'); updateTotal(); if(mask) mask.style.display='block'; if(modal) modal.style.display='flex'; }
  function closeModal(){ if(mask) mask.style.display='none'; if(modal) modal.style.display='none'; }
  function gv(id){ var el=document.getElementById(id); return el && typeof el.value!=='undefined' ? el.value.trim() : ''; }
  function markInvalid(id){ var el=document.getElementById(id); if(el){ el.style.borderColor='#dc2626'; el.focus(); } }
  function clearInvalid(id){ var el=document.getElementById(id); if(el){ el.style.borderColor='#e5e7eb'; } }
  function clearTip(){ var tip=document.getElementById('o-tip'); if(tip){ tip.style.color='#111827'; tip.textContent=''; } }

  function validateAll(){
    clearTip();
    ['o-name','o-phone','o-email','o-company','o-country','o-address','o-notes'].forEach(clearInvalid);
    var need=['o-name','o-phone','o-email','o-company','o-country','o-address','o-notes'];
    for(var i=0;i<need.length;i++){ var id=need[i]; if(!gv(id)){ markInvalid(id); var tip=document.getElementById('o-tip'); if(tip){ tip.style.color='#dc2626'; tip.textContent=TR.requiredAll; } return false; } }
    var email=gv('o-email'); var phone=gv('o-phone').replace(/\\D/g,'');
    if(!/^([^@\\s]+)@([^@\\s]+)\\.[^@\\s]+$/.test(email)){ markInvalid('o-email'); var tip1=document.getElementById('o-tip'); if(tip1){ tip1.style.color='#dc2626'; tip1.textContent=TR.invalidEmail; } return false; }
    if(phone.length<5){ markInvalid('o-phone'); var tip2=document.getElementById('o-tip'); if(tip2){ tip2.style.color='#dc2626'; tip2.textContent=TR.invalidPhone; } return false; }
    return true;
  }

  // —— 直接绑定 —— 
  var addBtn=document.getElementById('add-cart');
  if(addBtn){ addBtn.addEventListener('click', function(){ addCurrentToCart(); updateTotal(); var txt=addBtn.innerText; addBtn.innerText=addBtn.getAttribute('data-added')||'已加入'; setTimeout(function(){ addBtn.innerText=txt; },1200); }); }
  var checkoutBtn=document.getElementById('go-checkout');
  if(checkoutBtn){ checkoutBtn.addEventListener('click', function(){ openModal(); }); }

  // —— 委托 —— 
  document.addEventListener('click', function(ev){
    var t = ev.target;
    if (t && (t.id==='add-cart' || (t.closest && t.closest('#add-cart')))) { if(addBtn) addBtn.click(); return; }
    if (t && (t.id==='go-checkout' || (t.closest && t.closest('#go-checkout')))) { if(checkoutBtn) checkoutBtn.click(); return; }
    if (t && (t.id==='o-cancel' || (t===mask))) { closeModal(); return; }
    if (t && (t.id==='o-submit' || (t.closest && t.closest('#o-submit')))) {
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
        var tip=document.getElementById('o-tip'); if(tip){ tip.style.color='#059669'; tip.textContent=${JSON.stringify(tr.submittedTip)}; }
      }catch(e){}
      return;
    }
  });

  document.addEventListener('input', function(ev){
    var t=ev.target && ev.target.id; if(t){ var el=document.getElementById(t); if(el){ el.style.borderColor='#e5e7eb'; } var tip=document.getElementById('o-tip'); if(tip) tip.textContent=''; }
  });
  document.addEventListener('change', function(ev){
    var t=ev.target;
    if (t && (t.id==='o-currency')) { updateTotal(); }
  });
})();`,
        }}
      />
    </>
  );
}

