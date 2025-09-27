// 详情页：只查 p 页（±1 兜底），两栏布局 + 缩略图轮播，5s 自动切换，图片预加载
type Item = {
  num?: string;
  brand?: string;
  product?: string;
  oe?: string;
  price?: string | number;
  stock?: string | number;
  image?: string;
  images?: string[];
  pics?: string[];
  gallery?: string[];
  imageUrls?: string[];
  [k: string]: any;
};

const API_BASE = 'https://niuniuparts.com:6001/scm-product/v1/stock2';

export async function generateMetadata({ params }: { params: { num: string } }) {
  return { title: `Item ${params.num}` };
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
    const resp = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
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
  return rows.find((x) => String(x?.num ?? '') === String(num)) || null;
}

async function fetchItemNear(num: string, p: number, size: number): Promise<Item | null> {
  // 先查 p，再并发查 p-1 与 p+1（最多 3 页）
  const cur = await findInPage(num, p, size);
  if (cur) return cur;
  const [a, b] = await Promise.all([
    p > 0 ? findInPage(num, p - 1, size) : Promise.resolve(null),
    findInPage(num, p + 1, size),
  ]);
  return a || b || null;
}

export default async function Page({
  params,
  searchParams,
}: {
  params: { num: string };
  searchParams?: { [k: string]: string | string[] | undefined };
}) {
  const num = params.num;
  const p = toInt((searchParams?.p as string) ?? '0', 0);
  const size = toInt((searchParams?.s as string) ?? '20', 20);

  const item = await fetchItemNear(num, p, size);

  if (!item) {
    return (
      <div style={{ padding: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>未找到商品：{num}</h1>
        <a
          href={`/stock?p=${p}`}
          style={{
            display: 'inline-block',
            marginTop: 16,
            padding: '8px 16px',
            background: '#111827',
            color: '#fff',
            borderRadius: 8,
            textDecoration: 'none',
          }}
        >
          返回列表
        </a>
      </div>
    );
  }

  // 图片准备：≥18，去空/去重，无图占位
  const placeholder =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAQAAABx0wduAAAAAklEQVR42u3BMQEAAADCoPVPbQ0PoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8JwC0QABG4zJSwAAAABJRU5ErkJggg==';

  const raw: string[] =
    item.images || item.pics || item.gallery || item.imageUrls || (item.image ? [item.image] : []) || [];
  const seen = new Set<string>();
  const cleaned = raw
    .filter(Boolean)
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s) => s.length > 0)
    .filter((u) => {
      const key = u.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const MIN = 18;
  const base = cleaned.length > 0 ? cleaned : [placeholder];
  const images: string[] = [];
  while (images.length < Math.max(MIN, base.length)) {
    images.push(base[images.length % base.length]);
  }

  const preloadCount = Math.min(8, images.length);
  const title = [item.brand, item.product, item.oe, num].filter(Boolean).join(' | ');
  const gal = `gal-${num}`;

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
`.trim() +
    '\n' +
    images
      .map(
        (_s, i) =>
          `#${gal}-${i}:checked ~ .main img[data-idx="${i}"]{display:block}
#${gal}-${i}:checked ~ .thumbs label[for="${gal}-${i}"]{border:2px solid #2563eb}`
      )
      .join('\n');

  // 无点击时 5 秒自动切换；点击后重置计时
  const script = `
(function(){
  var name = ${JSON.stringify(gal)};
  var radios = Array.prototype.slice.call(document.querySelectorAll('input[name="'+name+'"]'));
  if (!radios.length) return;
  var idx = radios.findIndex(function(r){return r.checked;});
  if (idx < 0) idx = 0;
  function tick(){ idx = (idx + 1) % radios.length; radios[idx].checked = true; }
  var timer = setInterval(tick, 5000);
  radios.forEach(function(r, i){
    r.addEventListener('change', function(){ idx = i; clearInterval(timer); timer = setInterval(tick, 5000); });
  });
})();`.trim();

  return (
    <>
      {/* 预加载首屏图，保证与页面同步出现 */}
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
              <img
                key={`main-${i}`}
                data-idx={i}
                src={src}
                alt="product"
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : 'auto'}
                decoding={i === 0 ? 'sync' : 'async'}
              />
            ))}
          </div>

          <div className="thumbs">
            {images.map((src, i) => (
              <label key={`thumb-${i}`} htmlFor={`${gal}-${i}`} title={`第 ${i + 1} 张`}>
                <img src={src} alt={`thumb-${i + 1}`} loading="eager" decoding="sync" />
              </label>
            ))}
          </div>

          <style dangerouslySetInnerHTML={{ __html: css }} />
          <script dangerouslySetInnerHTML={{ __html: script }} />
        </div>

        {/* 右：信息 */}
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>{title}</h1>

          <dl
            style={{
              marginTop: 16,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              fontSize: 14,
            }}
          >
            {item.brand && (
              <div>
                <dt style={{ color: '#6b7280' }}>品牌</dt>
                <dd style={{ fontWeight: 600 }}>{item.brand}</dd>
              </div>
            )}
            {item.product && (
              <div>
                <dt style={{ color: '#6b7280' }}>品名</dt>
                <dd style={{ fontWeight: 600 }}>{item.product}</dd>
              </div>
            )}
            {item.oe && (
              <div>
                <dt style={{ color: '#6b7280' }}>OE</dt>
                <dd style={{ fontWeight: 600 }}>{item.oe}</dd>
              </div>
            )}
            {item.price !== undefined && (
              <div>
                <dt style={{ color: '#6b7280' }}>价格</dt>
                <dd style={{ fontWeight: 600 }}>{String(item.price)}</dd>
              </div>
            )}
            {item.stock !== undefined && (
              <div>
                <dt style={{ color: '#6b7280' }}>库存</dt>
                <dd style={{ fontWeight: 600 }}>{String(item.stock)}</dd>
              </div>
            )}
          </dl>

          <div style={{ marginTop: 24 }}>
            <a
              href={`/stock?p=${p}`}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                background: '#fff',
                color: '#111827',
                border: '1px solid #e5e7eb',
                textDecoration: 'none',
              }}
            >
              返回列表
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
