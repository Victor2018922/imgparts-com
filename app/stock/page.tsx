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
  // 尝试两次以提高稳定性
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

  // 拉页面数据（简单实现：如果有 q 则只请求第一页并过滤；避免长时间扫描）
  let rows: Item[] = [];
  try {
    if (!q) {
      rows = await fetchPageStable(p);
    } else {
      // 若有搜索词，先快速拿当前页，再本地过滤
      const list = await fetchPageStable(p);
      rows = list.filter((it) => {
        const k = q.toLowerCase();
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

  return (
    <>
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
                  <Link href={href} prefetch>
                    <div style={{ width: "100%", aspectRatio: "1/1", overflow: "hidden", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <img src={img} alt={String(it.product ?? "")} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                    </div>
                  </Link>
                  <Link href={href} prefetch style={{ textDecoration: "none", color: "#111", fontWeight: 700 }}>{title}</Link>
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

      {/* 简单结算弹窗（DOM 用于 Script 控制显示/隐藏） */}
      <div id="list-mask" style={{ display: "none", position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 90 }} />
      <div id="list-modal" style={{ display: "none", position: "fixed", left: "50%", top: "10vh", transform: "translateX(-50%)", width: "min(720px, 92vw)", background: "#fff", zIndex: 91, borderRadius: 8, border: "1px solid #e5e7eb" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #eee", fontWeight: 700 }}>提交订单</div>
        <div style={{ padding: 12 }}>
          <div id="list-cart-items" style={{ marginBottom: 12 }}></div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button id="l-cancel" style={{ padding: "8px 12px" }}>取消</button>
            <button id="l-submit" style={{ padding: "8px 12px", background: "#111", color: "#fff" }}>提交订单</button>
          </div>
        </div>
      </div>

      {/* 交互脚本：统一事件委托，afterInteractive */}
      <Script id="stock-page-script" strategy="afterInteractive">{`
(function(){
  // 小工具
  function $(s){ return document.querySelector(s); }
  function $all(s){ return Array.from(document.querySelectorAll(s)); }
  function readCart(){ try{ return JSON.parse(localStorage.getItem('cart')||'[]'); }catch(e){ return []; } }
  function writeCart(c){ try{ localStorage.setItem('cart', JSON.stringify(c)); }catch(e){} }
  function computeTotal(){ var c=readCart(); var sum = c.reduce(function(a,b){ return a + (Number(b.price)||0)*(Number(b.qty)||1); },0); return sum; }

  // 事件委托：页面范围内点击统一处理
  document.addEventListener('click', function(e){
    var t = e.target;

    // 列表加入购物车（按钮或其内部元素）
    var addBtn = t.closest ? t.closest('.btn-add') : null;
    if(addBtn){
      var payload = addBtn.getAttribute('data-payload') || '';
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
      // 视觉反馈
      var old = addBtn.innerText;
      try{ addBtn.innerText = '已加入'; }catch(e){}
      setTimeout(function(){ try{ addBtn.innerText = old; }catch(e){} }, 1000);
      return;
    }

    // 列表去结算
    var ck = t.closest ? t.closest('.btn-checkout') : null;
    if(ck){
      $('#list-mask').style.display = 'block';
      $('#list-modal').style.display = 'block';
      renderCartList();
      return;
    }

    // 结算弹窗取消或遮罩
    if(t.id === 'l-cancel' || t.id === 'list-mask'){ $('#list-mask').style.display='none'; $('#list-modal').style.display='none'; return; }

    // 结算提交
    if(t.id === 'l-submit'){
      // 简单示范：保存订单到 localStorage.orders
      var ordersRaw = localStorage.getItem('orders') || '[]';
      try{
        var arr = JSON.parse(ordersRaw);
        arr.push({ items: readCart(), createdAt: new Date().toISOString(), total: computeTotal() });
        localStorage.setItem('orders', JSON.stringify(arr));
        // 清空购物车
        localStorage.removeItem('cart');
        alert('订单已保存（本地模拟）');
        $('#list-mask').style.display='none'; $('#list-modal').style.display='none';
      }catch(e){ alert('保存失败'); }
      return;
    }

    // 语言与模式按钮（会写 cookie 并刷新）
    if(t.id === 'lang-zh'){ document.cookie = 'lang=zh; path=/; max-age=' + (3600*24*365); location.reload(); return; }
    if(t.id === 'lang-en'){ document.cookie = 'lang=en; path=/; max-age=' + (3600*24*365); location.reload(); return; }
    if(t.id === 'mode-b2c'){ document.cookie = 'mode=B2C; path=/; max-age=' + (3600*24*365); location.reload(); return; }
    if(t.id === 'mode-b2b'){ document.cookie = 'mode=B2B; path=/; max-age=' + (3600*24*365); location.reload(); return; }

    // 模板下载
    if(t.id === 'download-template'){ var csv='num,oe,qty\\n#example:721012,69820-06160,2\\n'; var b=new Blob([csv],{type:'text/csv'}); var a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='ImgParts_Template.csv'; a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); },500); return; }
    // 上传需求 (触发隐藏 file input)
    if(t.id === 'upload-needs'){ alert('请先登录（demo）'); return; }
    // 注册按钮
    if(t.id === 'btn-register'){ alert('注册/登录（示例）'); return; }
  });

  function renderCartList(){
    var el = document.getElementById('list-cart-items');
    if(!el) return;
    var cart = readCart();
    if(!cart.length){ el.innerHTML = '<div>购物车为空</div>'; return; }
    var html = '<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">商品</th><th style="text-align:right">数量</th><th style="text-align:right">价格</th></tr></thead><tbody>';
    cart.forEach(function(it, idx){
      html += '<tr><td style="padding:6px;border-bottom:1px solid #f3f4f6">' + (it.brand||'') + ' ' + (it.product||'') + '</td><td style="text-align:right;padding:6px;border-bottom:1px solid #f3f4f6">' + (it.qty||1) + '</td><td style="text-align:right;padding:6px;border-bottom:1px solid #f3f4f6">' + (it.price||'') + '</td></tr>';
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  }
})();
`}</Script>
    </>
  );
}
