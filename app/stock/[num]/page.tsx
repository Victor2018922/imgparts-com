// 详情页：秒开；两栏布局 + 缩略图轮播（5s自动）+ 预加载
// 修复：点击无反应——改为健壮的事件委托（支持从文本节点点击）；“加入购物车/去结算”稳定可点
// 文案：将“标准术语”改为“配件名称”；支持全站中/英切换（顶部语言条 + cookie 持久化）
// 结算：内置弹窗（B2B/B2C），localStorage 闭环
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

const API_BASE = "https://niuniuparts.com:6001/scm-product/v1/stock2";

export async function generateMetadata({ params }: { params: { num: string } }) {
  return { title: `Item ${params.num}` };
}

function tFactory(lang: "zh" | "en") {
  return lang === "en"
    ? {
        stockPreview: "Stock Preview",
        backToList: "Back to list",
        partName: "Part Name",
        summary: "Summary",
        description: "Description",
        brand: "Brand",
        product: "Product",
        oe: "OE",
        price: "Price",
        stock: "Stock",
        addToCart: "Add to Cart",
        checkout: "Proceed to Checkout",
        submitOrder: "Submit Order",
        cancel: "Cancel",
        contactName: "Name",
        phone: "Phone",
        email: "Email",
        company: "Company (optional)",
        country: "Country",
        address: "Address",
        mode: "Mode",
        note: "Notes",
        b2c: "B2C",
        b2b: "B2B",
        submittedTip: "Submitted (Demo): saved to local orders",
        added: "Added",
        langZh: "中文",
        langEn: "EN",
      }
    : {
        stockPreview: "库存预览",
        backToList: "返回列表",
        partName: "配件名称",
        summary: "Summary",
        description: "Description",
        brand: "品牌",
        product: "品名",
        oe: "OE",
        price: "价格",
        stock: "库存",
        addToCart: "加入购物车",
        checkout: "去结算",
        submitOrder: "提交订单",
        cancel: "取消",
        contactName: "姓名 / Name",
        phone: "电话 / Phone",
        email: "邮箱 / Email",
        company: "公司（可选）",
        country: "国家 / Country",
        address: "地址 / Address",
        mode: "交易模式",
        note: "备注 / Notes",
        b2c: "B2C",
        b2b: "B2B",
        submittedTip: "提交成功（演示）：已保存到本地订单列表",
        added: "已加入",
        langZh: "中文",
        langEn: "EN",
      };
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
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
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

// —— “配件名称”抽取（含动态兜底） ——
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
  const summary = it.summary || "";
  const description = it.description || it.desc || it.remark || "";
  return { cn, en, summary, description };
}

function buildImages(item: Item) {
  const placeholder =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAQAAABx0wduAAAAAklEQVR42u3BMQEAAADCoPVPbQ0PoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8JwC0QABG4zJSwAAAABJRU5ErkJggg==";
  const raw: string[] =
    item.images || item.pics || item.gallery || item.imageUrls || (item.image ? [item.image] : []) || [];
  const seen = new Set<string>();
  const cleaned = raw
    .filter(Boolean)
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter((s) => s.length > 0)
    .filter((u) => { const k = u.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  const MIN = 18;
  const base = cleaned.length > 0 ? cleaned : [placeholder];
  const images: string[] = [];
  while (images.length < Math.max(MIN, base.length)) images.push(base[images.length % base.length]);
  return images;
}

export default async function Page({
  params,
  searchParams,
}: {
  params: { num: string };
  searchParams?: { [k: string]: string | string[] | undefined };
}) {
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

  const css =
    `
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
.modal{ position:fixed; inset:auto; left:50%; top:10vh; transform:translateX(-50%); width:min(720px, 92vw); background:#fff; border:1px solid #e5e7eb; border-radius:12px; display:none; z-index:51; }
.modal header{ padding:12px 16px; font-weight:700; border-bottom:1px solid #e5e7eb; }
.modal .body{ padding:16px; display:grid; gap:12px; }
.modal .row{ display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.modal footer{ padding:12px 16px; border-top:1px solid #e5e7eb; display:flex; gap:8px; justify-content:flex-end; }
input,textarea,select{ border:1px solid #e5e7eb; border-radius:8px; padding:10px 12px; }
`.trim() +
    "\n" +
    images
      .map(
        (_s, i) =>
          `#${gal}-${i}:checked ~ .main img[data-idx="${i}"]{display:block}
#${gal}-${i}:checked ~ .thumbs label[for="${gal}-${i}"]{border:2px solid #2563eb}`
      )
      .join("\n");

  return (
    <>
      {/* 顶部语言切换条（全站中英切换） */}
      <LangBar lang={langCookie} />

      {/* 预取返回列表 + 预加载首图 */}
      <link rel="prefetch" href={backHref} />
      {images.slice(0, preloadCount).map((src, i) => (
        <link key={`preload-${i}`} rel="preload" as="image" href={src} />
      ))}

      <div className="detail-wrap">
        {/* 左：大图 + 缩略图（轮播） */}
        <div className="gallery">
          {images.map((_, i) => (
            <input key={`r-${i}`} type="radio" name={gal} id={`${gal}-${i}`} defaultChecked={i === 0} />
          ))}

          <div className="main">
            {images.map((src, i) => (
              <img key={`main-${i}`} data-idx={i} src={src} alt="product"
                   loading={i === 0 ? "eager" : "lazy"} fetchPriority={i === 0 ? "high" : "auto"} decoding={i === 0 ? "sync" : "async"} />
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

          {(stdCn || stdEn) && (
            <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5 }}>
              {stdCn && <div><strong>{tr.partName}：</strong>{stdCn}</div>}
              {stdEn && <div><strong>Part Name:</strong> {stdEn}</div>}
            </div>
          )}
          {(summary || description) && (
            <div style={{ marginTop: 8, fontSize: 13, color: "#4b5563" }}>
              {summary && <div><strong>{tr.summary}：</strong>{summary}</div>}
              {description && <div><strong>{tr.description}：</strong>{description}</div>}
            </div>
          )}

          <dl
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              fontSize: 14,
            }}
          >
            {item.brand && (<div><dt style={{ color: "#6b7280" }}>{tr.brand}</dt><dd style={{ fontWeight: 600 }}>{item.brand}</dd></div>)}
            {item.product && (<div><dt style={{ color: "#6b7280" }}>{tr.product}</dt><dd style={{ fontWeight: 600 }}>{item.product}</dd></div>)}
            {item.oe && (<div><dt style={{ color: "#6b7280" }}>{tr.oe}</dt><dd style={{ fontWeight: 600 }}>{item.oe}</dd></div>)}
            {typeof item.price !== "undefined" && (<div><dt style={{ color: "#6b7280" }}>{tr.price}</dt><dd style={{ fontWeight: 600 }}>{String(item.price)}</dd></div>)}
            {typeof item.stock !== "undefined" && (<div><dt style={{ color: "#6b7280" }}>{tr.stock}</dt><dd style={{ fontWeight: 600 }}>{String(item.stock)}</dd></div>)}
          </dl>

          <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button id="add-cart"
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

      {/* 结算弹窗（不新建页面） */}
      <div id="modal-mask" className="modal-mask"></div>
      <div id="checkout-modal" className="modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
        <header id="checkout-title">{tr.submitOrder}</header>
        <div className="body">
          <div id="cart-items" style={{ fontSize: 13, color: "#374151" }}></div>
          <div className="row">
            <div><label>{tr.contactName}</label><input id="o-name" placeholder="" /></div>
            <div><label>{tr.phone}</label><input id="o-phone" placeholder="" /></div>
          </div>
          <div className="row">
            <div><label>{tr.email}</label><input id="o-email" placeholder="" /></div>
            <div><label>{tr.company}</label><input id="o-company" placeholder="" /></div>
          </div>
          <div className="row">
            <div><label>{tr.country}</label><input id="o-country" placeholder="" /></div>
            <div><label>{tr.mode}</label>
              <select id="o-mode">
                <option value="B2C">{tr.b2c}</option>
                <option value="B2B">{tr.b2b}</option>
              </select>
            </div>
          </div>
          <div><label>{tr.address}</label><input id="o-address" placeholder="" /></div>
          <div><label>{tr.note}</label><textarea id="o-notes" placeholder="" rows={3}></textarea></div>
          <div id="o-tip" style={{ fontSize: 12, color: "#059669" }}></div>
        </div>
        <footer>
          <button id="o-cancel" style={{ padding: "8px 14px", borderRadius: 8, background: "#fff", border: "1px solid #e5e7eb", cursor: "pointer" }}>{tr.cancel}</button>
          <button id="o-submit" style={{ padding: "8px 14px", borderRadius: 8, background: "#111827", color: "#fff", border: "1px solid #111827", cursor: "pointer" }}>{tr.submitOrder}</button>
        </footer>
      </div>

      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* 统一事件脚本（纯JS，无TS语法） */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function(){
  // 兼容文本节点点击的 closest
  function closestSel(node, sel){
    var el = node && node.nodeType===1 ? node : (node && node.parentElement);
    while(el){
      if (el.matches && el.matches(sel)) return el;
      el = el.parentElement;
    }
    return null;
  }

  // 顶部语言切换（cookie 持久化，全站生效）
  document.addEventListener('click', function(e){
    var t = e.target;
    if (closestSel(t, '#lang-zh')) {
      document.cookie = 'lang=zh; path=/; max-age=' + (3600*24*365);
      location.reload();
      return;
    }
    if (closestSel(t, '#lang-en')) {
      document.cookie = 'lang=en; path=/; max-age=' + (3600*24*365);
      location.reload();
      return;
    }
  });

  // 轮播：5s 自动
  (function(){
    var name='${gal}';
    var radios=[].slice.call(document.querySelectorAll('input[name="'+name+'"]'));
    if(!radios.length) return;
    var idx=radios.findIndex(function(r){return r.checked;}); if(idx<0) idx=0;
    function tick(){ idx=(idx+1)%radios.length; radios[idx].checked=true; }
    var timer=setInterval(tick,5000);
    radios.forEach(function(r,i){
      r.addEventListener('change',function(){ idx=i; clearInterval(timer); timer=setInterval(tick,5000); });
    });
  })();

  function readCart(){ try{ var raw=localStorage.getItem('cart'); return raw? JSON.parse(raw): []; }catch(e){ return []; } }
  function writeCart(c){ try{ localStorage.setItem('cart', JSON.stringify(c)); }catch(e){} }
  function renderCart(tableId){
    var el=document.getElementById(tableId);
    var cart=readCart();
    if(!el) return;
    if(!cart.length){ el.innerHTML='<div>购物车为空</div>'; return; }
    var html='<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th style="text-align:left;padding:6px;border-bottom:1px solid #e5e7eb">商品</th><th style="text-align:right;padding:6px;border-bottom:1px solid #e5e7eb">数量</th><th style="text-align:right;padding:6px;border-bottom:1px solid #e5e7eb">价格</th></tr></thead><tbody>';
    cart.forEach(function(it){
      html+='<tr><td style="padding:6px;border-bottom:1px solid #f3f4f6">'+[it.brand,it.product,it.oe,it.num].filter(Boolean).join(' | ')+'</td>'+
            '<td style="padding:6px;text-align:right;border-bottom:1px solid #f3f4f6">'+(it.qty||1)+'</td>'+
            '<td style="padding:6px;text-align:right;border-bottom:1px solid #f3f4f6">'+(it.price||'')+'</td></tr>';
    });
    html+='</tbody></table>';
    el.innerHTML=html;
  }
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
  function openModal(){ addCurrentToCart(); renderCart('cart-items'); if(mask) mask.style.display='block'; if(modal) modal.style.display='block'; }
  function closeModal(){ if(mask) mask.style.display='none'; if(modal) modal.style.display='none'; }

  function gv(id){ var el=document.getElementById(id); return el && typeof el.value!=='undefined' ? el.value : ''; }

  // 统一事件委托：按钮稳定可点
  document.addEventListener('click', function(ev){
    var t = ev.target;

    if (closestSel(t, '#add-cart')) {
      addCurrentToCart();
      var btn=closestSel(t, '#add-cart');
      if(btn){ var txt=btn.innerText; btn.innerText=${JSON.stringify(tFactory(cookies().get("lang")?.value==="en"?"en":"zh").added)}; setTimeout(function(){ btn.innerText=txt; }, 1200); }
      return;
    }

    if (closestSel(t, '#go-checkout')) { openModal(); return; }

    if (closestSel(t, '#o-cancel') || (mask && t===mask)) { closeModal(); return; }

    if (closestSel(t, '#o-submit')) {
      var order={
        items: readCart(),
        contact: {
          name: gv('o-name'), phone: gv('o-phone'), email: gv('o-email'),
          company: gv('o-company'), country: gv('o-country'),
          address: gv('o-address'), mode: gv('o-mode')||'B2C', notes: gv('o-notes')
        },
        createdAt: new Date().toISOString()
      };
      try{
        var raw=localStorage.getItem('orders'); var arr=raw? JSON.parse(raw): [];
        arr.push(order); localStorage.setItem('orders', JSON.stringify(arr));
        localStorage.setItem('lastOrder', JSON.stringify(order));
        var tip=document.getElementById('o-tip'); if(tip) tip.textContent=${JSON.stringify(tFactory(cookies().get("lang")?.value==="en"?"en":"zh").submittedTip)};
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

// —— 顶部语言条（仅在本文件内定义，无需新增文件） ——
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

