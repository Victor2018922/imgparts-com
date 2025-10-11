import Link from "next/link";
import { cookies } from "next/headers";
import Script from "next/script";

type Item = {
  num?: string;
  brand?: string;
  product?: string;
  oe?: string;
  price?: number | string;
  stock?: number | string;
  image?: string;
  images?: string[];
  pics?: string[];
  gallery?: string[];
  [k: string]: any;
};

const API_BASE = "https://niuniuparts.com:6001/scm-product/v1/stock2";
const PAGE_SIZE = 20;
const REQ_TIMEOUT = 6000;

function tFactory(lang: "zh" | "en") {
  return lang === "en"
    ? {
        stockPreview: "Stock Preview",
        searchPH: "Type OE / Product / Brand / Model",
        addToCart: "Add to Cart",
        added: "Added",
        checkout: "Proceed to Checkout",
        viewDetail: "View Details",
        prev: "Prev",
        next: "Next",
        page: "Page",
        partName: "Part Name",
        oe: "OE",
        price: "Price",
        stock: "Stock",
        downloadTpl: "Download Template",
        uploadNeeds: "Upload Needs (CSV)",
        register: "Register/Login",
        noData: "No data or failed to load, refresh and try again",
        noMatch: "No results, try other keywords",
      }
    : {
        stockPreview: "库存预览",
        searchPH: "输入 OE / 品名 / 品牌 / 车型 进行搜索",
        addToCart: "加入购物车",
        added: "已加入",
        checkout: "去结算",
        viewDetail: "查看详情",
        prev: "上一页",
        next: "下一页",
        page: "页",
        partName: "配件名称",
        oe: "OE",
        price: "价格",
        stock: "库存",
        downloadTpl: "下载模板",
        uploadNeeds: "上传需求 (CSV)",
        register: "注册/登录",
        noData: "暂无数据或加载失败，请刷新重试",
        noMatch: "未找到匹配结果，请更换关键词",
      };
}

async function fetchPageOnce(page: number, size = PAGE_SIZE, timeoutMs = REQ_TIMEOUT): Promise<Item[]> {
  const url = `${API_BASE}?size=${size}&page=${page}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) return [];
    const json = await res.json();
    if (Array.isArray(json)) return json as Item[];
    if (Array.isArray((json as any)?.content)) return (json as any).content as Item[];
    if (Array.isArray((json as any)?.data)) return (json as any).data as Item[];
    return [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPageStable(page: number): Promise<Item[]> {
  for (let i = 0; i < 2; i++) {
    const r = await fetchPageOnce(page);
    if (r && r.length) return r;
  }
  return [];
}

function primaryImage(it: Item): string {
  const raw = it.images || it.pics || it.gallery || (it.image ? [it.image] : []) || [];
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const s of raw) {
    if (!s) continue;
    const u = String(s).trim();
    if (!u) continue;
    const k = u.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      uniq.push(u);
    }
  }
  return uniq[0] || "/placeholder.png";
}

export default async function StockPage({
  searchParams,
}: {
  searchParams?: { [k: string]: string | string[] | undefined };
}) {
  const p = Number((searchParams?.p as string) ?? "0") || 0;
  const q = String((searchParams?.q as string) || "").trim();
  const langCookie = cookies().get("lang")?.value === "en" ? "en" : "zh";
  const modeCookie = cookies().get("mode")?.value === "B2B" ? "B2B" : "B2C";
  const tr = tFactory(langCookie);

  let rows: Item[] = [];
  try {
    if (!q) {
      rows = await fetchPageStable(p);
    } else {
      const list = await fetchPageStable(p);
      const k = q.toLowerCase();
      rows = list.filter((it) => {
        return (
          String(it.num ?? "").toLowerCase().includes(k) ||
          String(it.oe ?? "").toLowerCase().includes(k) ||
          String(it.brand ?? "").toLowerCase().includes(k) ||
          String(it.product ?? "").toLowerCase().includes(k) ||
          String(it.model ?? "").toLowerCase().includes(k)
        );
      });
    }
  } catch {
    rows = [];
  }
  const hasNext = rows.length === PAGE_SIZE;

  const mkHref = (np: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("p", String(np));
    return `/stock?${params.toString()}`;
  };

  const prevHref = p > 0 ? mkHref(p - 1) : "#";
  const nextHref = hasNext ? mkHref(p + 1) : "#";

  // 预加载前几张图以提升首屏体验
  const preloads = rows.slice(0, 6).map(primaryImage);

  return (
    <>
      {preloads.map((src, i) => (
        <link key={"pl" + i} rel="preload" as="image" href={src} />
      ))}

      <header style={{ padding: 12, borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>ImgParts 预览站</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button id="lang-zh" disabled={langCookie === "zh"}>中文</button>
          <button id="lang-en" disabled={langCookie === "en"}>EN</button>
          <span style={{ marginLeft: 12 }}>交易模式：</span>
          <button id="mode-b2c" disabled={modeCookie === "B2C"}>B2C</button>
          <button id="mode-b2b" disabled={modeCookie === "B2B"}>B2B</button>
          <button id="download-template" style={{ marginLeft: 12 }}>{tr.downloadTpl}</button>
          <button id="upload-needs">{tr.uploadNeeds}</button>
          <button id="btn-register" style={{ marginLeft: 8 }}>{tr.register}</button>
        </div>
      </header>

      <main style={{ padding: 20 }}>
        <h1 style={{ fontSize: 20, marginBottom: 12 }}>{tr.stockPreview}</h1>

        <form method="GET" action="/stock" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input name="q" defaultValue={q} placeholder={tr.searchPH} style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid #e5e7eb" }} />
          <button type="submit" style={{ padding: "8px 12px" }}>{langCookie === "en" ? "Search" : "搜索"}</button>
        </form>

        <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <Link href={prevHref} style={{ pointerEvents: prevHref === "#" ? "none" : "auto", opacity: prevHref === "#" ? 0.5 : 1 }}>{tr.prev}</Link>
          <Link href={nextHref} style={{ pointerEvents: nextHref === "#" ? "none" : "auto", opacity: nextHref === "#" ? 0.5 : 1 }}>{tr.next}</Link>
          <div style={{ marginLeft: "auto", color: "#666" }}>{`${tr.page} ${p + 1}`}</div>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: 24, color: "#666" }}>{q ? tr.noMatch : tr.noData}</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {rows.map((it) => {
              const pageNum = p;
              const href = `/stock/${encodeURIComponent(String(it.num ?? ""))}?p=${pageNum}`;
              const img = primaryImage(it);
              const title = [it.brand, it.product, it.oe, it.num].filter(Boolean).join(" | ");
              const payload = JSON.stringify({ num: it.num ?? "", price: it.price ?? "", brand: it.brand ?? "", product: it.product ?? "", oe: it.oe ?? "" }).replace(/"/g, "&quot;");
              return (
                <div key={String(it.num ?? Math.random())} style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <Link href={href}>
                    <div style={{ width: "100%", aspectRatio: "1/1", overflow: "hidden", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <img src={img} alt={String(it.product ?? "")} loading="eager" fetchPriority="high" decoding="sync" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                    </div>
                  </Link>
                  <Link href={href} style={{ textDecoration: "none", color: "#111", fontWeight: 700 }}>{title}</Link>
                  <div style={{ color: "#444", fontSize: 13 }}>
                    {it.oe && <div>{tr.oe}：{it.oe}</div>}
                    {typeof it.price !== "undefined" && <div>{tr.price}：{String(it.price)}</div>}
                    {typeof it.stock !== "undefined" && <div>{tr.stock}：{String(it.stock)}</div>}
                  </div>
                  <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
                    <button className="btn-add" data-payload={payload} style={{ flex: 1, padding: "8px 10px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>{tr.addToCart}</button>
                    <button className="btn-checkout" style={{ flex: 1, padding: "8px 10px", background: "#10b981", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>{tr.checkout}</button>
                    <Link href={href} style={{ padding: "8px 10px", border: "1px solid #eee", borderRadius: 6, textDecoration: "none", color: "#111", alignSelf: "center" }}>{tr.viewDetail}</Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 结算弹窗 */}
      <div id="list-mask" style={{ display: "none", position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 90 }} />
      <div id="list-modal" style={{ display: "none", position: "fixed", left: "50%", top: "8vh", transform: "translateX(-50%)", width: "min(820px, 96vw)", background: "#fff", zIndex: 91, borderRadius: 8, border: "1px solid #e5e7eb", maxHeight: "84vh", boxSizing: "border-box" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #eee", fontWeight: 700 }}>提交订单</div>
        <div id="list-modal-body" style={{ padding: 12, overflow: "auto", maxHeight: "64vh", boxSizing: "border-box" }}>
          <div id="list-cart-items" style={{ marginBottom: 12 }}></div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ minWidth: 80 }}>货币：</label>
            <select id="l-currency" defaultValue="USD" style={{ padding: "6px 8px", borderRadius: 6 }}>
              <option value="CNY">人民币 CNY</option>
              <option value="USD">美元 USD</option>
              <option value="EUR">欧元 EUR</option>
            </select>
            <div style={{ marginLeft: "auto", fontWeight: 700 }} id="l-total">合计：--</div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, color: "#444" }}>
              <div>请填写联系信息（演示：本地保存）</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <input id="l-name" placeholder="姓名 / Name" style={{ padding: "8px", borderRadius: 6, border: "1px solid #e5e7eb" }} />
              <input id="l-phone" placeholder="电话 / Phone" style={{ padding: "8px", borderRadius: 6, border: "1px solid #e5e7eb" }} />
              <input id="l-email" placeholder="邮箱 / Email" style={{ padding: "8px", borderRadius: 6, border: "1px solid #e5e7eb" }} />
              <input id="l-company" placeholder="公司（B2B 必填）" style={{ padding: "8px", borderRadius: 6, border: "1px solid #e5e7eb" }} />
              <input id="l-country" placeholder="国家 / Country" style={{ padding: "8px", borderRadius: 6, border: "1px solid #e5e7eb" }} />
              <select id="l-mode" defaultValue={modeCookie} style={{ padding: "8px", borderRadius: 6, border: "1px solid #e5e7eb" }}>
                <option value="B2C">B2C</option>
                <option value="B2B">B2B</option>
              </select>
              <input id="l-address" placeholder="地址 / Address" style={{ gridColumn: "1 / -1", padding: "8px", borderRadius: 6, border: "1px solid #e5e7eb" }} />
              <textarea id="l-notes" placeholder="备注 / Notes" rows={3} style={{ gridColumn: "1 / -1", padding: "8px", borderRadius: 6, border: "1px solid #e5e7eb" }} />
              <div id="l-tip" style={{ gridColumn: "1 / -1", color: "#dc2626" }}></div>
            </div>
          </div>
        </div>

        <div style={{ padding: "12px", borderTop: "1px solid #eee", display: "flex", justifyContent: "flex-end", gap: 8, position: "sticky", bottom: 0, background: "#fff" }}>
          <button id="l-cancel" style={{ padding: "8px 12px" }}>取消</button>
          <button id="l-submit" style={{ padding: "8px 12px", background: "#111827", color: "#fff", border: "none", borderRadius: 6 }}>提交订单</button>
        </div>
      </div>

      <Script id="stock-page-script" strategy="afterInteractive">{`
(function(){
  function $(s){ return document.querySelector(s); }
  function $all(s){ return Array.from(document.querySelectorAll(s)); }
  function readCart(){ try{ return JSON.parse(localStorage.getItem('cart')||'[]'); }catch(e){ return []; } }
  function writeCart(c){ try{ localStorage.setItem('cart', JSON.stringify(c)); }catch(e){} }
  function computeSum(currency){
    var cart=readCart(); var sum=cart.reduce(function(acc,it){ return acc + (Number(it.price)||0)*(Number(it.qty)||1); },0);
    var rates = { USD:1, CNY:7.2, EUR:0.92 };
    var val = sum * (rates[currency]||1);
    var sym = currency==='CNY'?'¥':(currency==='EUR'?'€':'$');
    return sym + ' ' + (Math.round(val*100)/100).toFixed(2);
  }

  // 渲染弹窗购物车（列出每行、数量、价格，并显示合计）
  function renderCartList(){
    var el = document.getElementById('list-cart-items');
    if(!el) return;
    var cart = readCart();
    if(!cart.length){ el.innerHTML = '<div style="color:#6b7280">购物车为空</div>'; document.getElementById('l-total').textContent = '合计：--'; return; }
    var html = '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th style="text-align:left;padding:6px;border-bottom:1px solid #f3f4f6">商品</th><th style="text-align:right;padding:6px;border-bottom:1px solid #f3f4f6">数量</th><th style="text-align:right;padding:6px;border-bottom:1px solid #f3f4f6">价格</th></tr></thead><tbody>';
    cart.forEach(function(it, idx){
      html += '<tr data-idx="'+idx+'"><td style="padding:8px;border-bottom:1px solid #f3f4f6">'+(it.brand||'')+' '+(it.product||'')+'</td>';
      html += '<td style="padding:8px;text-align:right;border-bottom:1px solid #f3f4f6">'+(it.qty||1)+'</td>';
      html += '<td style="padding:8px;text-align:right;border-bottom:1px solid #f3f4f6">'+(it.price||'')+'</td></tr>';
    });
    html += '</tbody></table>';
    el.innerHTML = html;
    var cur = (document.getElementById('l-currency')||{}).value || 'USD';
    var total = computeSum(cur);
    document.getElementById('l-total').textContent = '合计：' + total;
  }

  // 验证必填（B2B 公司必填）
  function validateAll(){
    var mode = (document.getElementById('l-mode')||{}).value || 'B2C';
    var needCompany = mode==='B2B';
    var required = ['l-name','l-phone','l-email','l-country','l-address'];
    if(needCompany) required.push('l-company');
    var ok=true;
    required.forEach(function(id){
      var el = document.getElementById(id) as HTMLInputElement|null;
      if(!el || !el.value || String(el.value).trim()===''){ ok=false; if(el) el.style.borderColor='#dc2626'; }
      else if(el) el.style.borderColor = '#e5e7eb';
    });
    var email = (document.getElementById('l-email') as HTMLInputElement|null);
    if(email && !/^([^@\\s]+)@([^@\\s]+)\\.[^@\\s]+$/.test(email.value)){ ok=false; email.style.borderColor='#dc2626'; }
    if(!ok){ var tip=document.getElementById('l-tip'); if(tip) tip.textContent='请完整填写所有必填字段。'; }
    return ok;
  }

  // 主事件委托（先判断是否需要放行原生链接）
  document.addEventListener('click', function(e){
    var t = e.target as HTMLElement;
    if(!t) return;

    // 先判断是否点中了一个 <a href>（或者其内部），如果是且并非点在“按钮行为”上，则放行（不阻断原生导航）
    var anc = t.closest ? t.closest('a[href]') : null;
    // 判断是否点中了需要脚本处理的“按钮区域”
    var inAdd = t.closest && !!t.closest('.btn-add');
    var inCheckout = t.closest && !!t.closest('.btn-checkout');
    var inDownload = t.id === 'download-template' || (!!t.closest && !!t.closest('#download-template'));
    var inUpload = t.id === 'upload-needs' || (!!t.closest && !!t.closest('#upload-needs'));
    var inRegister = t.id === 'btn-register' || (!!t.closest && !!t.closest('#btn-register'));
    // 如果命中链接并且没有命中上面这些按钮区域，则直接放行（让浏览器处理导航）
    if(anc && !inAdd && !inCheckout && !inDownload && !inUpload && !inRegister){
      return; // allow link navigation
    }

    // 处理翻页顶部语言/模式/模板/上传/注册等按钮
    if(t.id === 'lang-zh'){ document.cookie='lang=zh; path=/; max-age='+(3600*24*365); location.reload(); return; }
    if(t.id === 'lang-en'){ document.cookie='lang=en; path=/; max-age='+(3600*24*365); location.reload(); return; }
    if(t.id === 'mode-b2c'){ document.cookie='mode=B2C; path=/; max-age='+(3600*24*365); location.reload(); return; }
    if(t.id === 'mode-b2b'){ document.cookie='mode=B2B; path=/; max-age='+(3600*24*365); location.reload(); return; }
    if(t.id === 'download-template'){ var csv='num,oe,qty\\n#example:721012,69820-06160,2\\n'; var b=new Blob([csv],{type:'text/csv'}); var a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='ImgParts_Template.csv'; a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); },500); return; }
    if(t.id === 'upload-needs'){ if(!localStorage.getItem('user')){ alert('请先注册/登录（演示）'); return; } alert('打开文件选择（演示）'); return; }
    if(t.id === 'btn-register'){ alert('注册 / 登录（演示）'); return; }

    // 列表加入购物车按钮
    var addBtn = t.closest && t.closest('.btn-add');
    if(addBtn){
      var payload = (addBtn as HTMLElement).getAttribute('data-payload') || '';
      try{
        var it = payload ? JSON.parse(payload.replace(/&quot;/g,'"')) : null;
        if(it){
          var cart = readCart();
          var idx = cart.findIndex(function(x){ return String(x.num) === String(it.num); });
          if(idx === -1) cart.push({ num: it.num, price: it.price, qty: 1, brand: it.brand, product: it.product, oe: it.oe });
          else cart[idx].qty = (cart[idx].qty||1) + 1;
          writeCart(cart);
        }
      }catch(e){}
      var oldText = (addBtn as HTMLElement).innerText;
      try{ (addBtn as HTMLElement).innerText = '已加入'; }catch(_){} 
      setTimeout(function(){ try{ (addBtn as HTMLElement).innerText = oldText; }catch(_){} }, 1100);
      return;
    }

    // 列表去结算
    var ck = t.closest && t.closest('.btn-checkout');
    if(ck){
      $('#list-mask').style.display = 'block';
      $('#list-modal').style.display = 'block';
      renderCartList();
      return;
    }

    // 弹窗取消或遮罩
    if(t.id === 'l-cancel' || t.id === 'list-mask'){ $('#list-mask').style.display='none'; $('#list-modal').style.display='none'; return; }

    // 弹窗货币更换（由 change 事件处理也可）
    if(t.id === 'l-submit'){
      if(!validateAll()) return;
      var orders = localStorage.getItem('orders') || '[]';
      try{
        var arr = JSON.parse(orders);
        arr.push({ items: readCart(), createdAt: new Date().toISOString(), totalText: document.getElementById('l-total')?.textContent || '' });
        localStorage.setItem('orders', JSON.stringify(arr));
        localStorage.removeItem('cart');
        alert('订单已保存（本地模拟）');
        $('#list-mask').style.display='none'; $('#list-modal').style.display='none';
      }catch(e){ alert('保存失败'); }
      return;
    }
  });

  // 变更事件（货币切换、模式切换等）
  document.addEventListener('change', function(e){
    var t = e.target as HTMLElement;
    if(!t) return;
    if((t as HTMLElement).id === 'l-currency'){ renderCartList(); }
    if((t as HTMLElement).id === 'l-mode'){ /* 可根据 B2B/B2C 调整公司必填提示 */ }
  });

  // 初始：如果弹窗开启则渲染
  renderCartList();
})();
`}</Script>
    </>
  );
}
