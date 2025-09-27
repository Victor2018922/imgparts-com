// 详情页：两栏布局（左大图+下方缩略图轮播，右侧信息）
// 无点击时每 5 秒自动切图；预加载图片以减少延迟；并行跨页检索加速命中 num
// 保持服务端渲染，保证页面与图片“同步出现”（配合预加载与高优先级）

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
  [k: string]: any;
};

const API_BASE = 'https://niuniuparts.com:6001/scm-product/v1/stock2';
const PAGE_SIZE = 200;
const MAX_PAGES = 40;
const BATCH = 8; // 并发批量数

async function fetchPage(page: number): Promise<Item[]> {
  const url = `${API_BASE}?size=${PAGE_SIZE}&page=${page}`;
  const resp = await fetch(url, { cache: 'no-store' });
  if (!resp.ok) return [];
  const data = await resp.json();
  if (Array.isArray(data)) return data as Item[];
  if (Array.isArray((data as any)?.content)) return (data as any).content as Item[];
  if (Array.isArray((data as any)?.data)) return (data as any).data as Item[];
  return [];
}

async function fetchItemAcrossPages(num: string): Promise<Item | null> {
  for (let start = 0; start < MAX_PAGES; start += BATCH) {
    const pages = Array.from({ length: Math.min(BATCH, MAX_PAGES - start) }, (_, i) => start + i);
    const results = await Promise.all(pages.map((p) => fetchPage(p)));
    let lastReached = false;

    for (let i = 0; i < results.length; i++) {
      const rows = results[i];
      const found = rows.find((x) => String(x?.num ?? '') === String(num));
      if (found) return found;
      if (rows.length < PAGE_SIZE) lastReached = true;
    }
    if (lastReached) break;
  }
  return null;
}

export async function generateMetadata({ params }: { params: { num: string } }) {
  // 稳定标题（避免乱码）：不做 decode，仅拼接
  const item = await fetchItemAcrossPages(params.num).catch(() => null);
  const parts = [item?.brand, item?.product, item?.oe, params.num].filter(Boolean);
  return { title: parts.join(' | ') || `Item ${params.num}` };
}

export default async function Page({ params }: { params: { num: string } }) {
  const num = params.num;
  const item = await fetchItemAcrossPages(num);

  if (!item) {
    return (
      <div style={{ padding: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>未找到商品：{num}</h1>
        <a
          href="/stock"
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

  // 组装图片：≥18，去空/去重，无图用透明占位
  const placeholder =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAQAAABx0wduAAAAAklEQVR42u3BMQEAAADCoPVPbQ0PoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8JwC0QABG4zJSwAAAABJRU5ErkJggg==';

  const raw: string[] =
    item.images ||
    item.pics ||
    item.gallery ||
    item.imageUrls ||
    (item.image ? [item.image] : []) ||
    [];

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

  // 预加载前 8 张，保证图片与页面无明显时间差
  const preloadCount = Math.min(8, images.length);

  const titleParts = [item.brand, item.product, item.oe, num].filter(Boolean);
  const safeTitle = titleParts.join(' | ');

  // 唯一画廊名（防止多画廊冲突）
  const galleryName = `gal-${num}`;

  // 样式：两栏布局 + 轮播缩略图 + 自适应
  const css = `
.detail-wrap{
  display:grid; gap:24px; padding:24px 0;
  grid-template-columns:1fr; align-items:start;
}
@media (min-width: 960px){
  .detail-wrap{ grid-template-columns: minmax(0,1fr) 1fr; }
}
.gallery{ width:100%; }
.gallery .main{
  width:100%; aspect-ratio:1/1; overflow:hidden;
  border-radius:16px; background:#fff; border:1px solid #eee; position:relative;
}
.gallery .main img{
  position:absolute; inset:0; width:100%; height:100%; object-fit:contain; display:none;
}
.thumbs{
  margin-top:12px; display:grid; gap:8px; grid-template-columns: repeat(9, 1fr);
}
.thumbs label{
  display:block; aspect-ratio:1/1; overflow:hidden; border-radius:8px;
  border:1px solid #e5e7eb; background:#fff; cursor:pointer;
}
.thumbs img{ width:100%; height:100%; object-fit:cover; }
.gallery input[type="radio"]{ display:none; }
`.trim() + '\n' +
    images.map(
      (_s, i) =>
        `#${galleryName}-${i}:checked ~ .main img[data-idx="${i}"]{display:block}
#${galleryName}-${i}:checked ~ .thumbs label[for="${galleryName}-${i}"]{border:2px solid #2563eb}`
    ).join('\n');

  // 自动轮播脚本（无点击时每 5 秒切换；点击后重置计时）
  const script = `
(function(){
  var name = ${JSON.stringify(galleryName)};
  var radios = Array.prototype.slice.call(document.querySelectorAll('input[name="'+name+'"]'));
  if (!radios.length) return;
  var idx = radios.findIndex(function(r){return r.checked;});
  if (idx < 0) idx = 0;
  function tick(){ idx = (idx + 1) % radios.length; radios[idx].checked = true; }
  var timer = setInterval(tick, 5000);
  radios.forEach(function(r, i){
    r.addEventListener('change', function(){
      idx = i;
      clearInterval(timer);
      timer = setInterval(tick, 5000);
    });
  });
})();`.trim();

  return (
    <>
      {/* 预加载若干图片，提升首屏同步度 */}
      {images.slice(0, preloadCount).map((src, i) => (
        <link key={`preload-${i}`} rel="preload" as="image" href={src} />
      ))}

      <div className="detail-wrap">
        {/* 左侧：大图 + 缩略图（轮播） */}
        <div className="gallery">
          {/* Radio（第一张选中） */}
          {images.map((_, i) => (
            <input key={`r-${i}`} type="radio" name={galleryName} id={`${galleryName}-${i}`} defaultChecked={i === 0} />
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
              <label key={`thumb-${i}`} htmlFor={`${galleryName}-${i}`} title={`第 ${i + 1} 张`}>
                <img src={src} alt={`thumb-${i + 1}`} loading="eager" decoding="sync" />
              </label>
            ))}
          </div>

          <style dangerouslySetInnerHTML={{ __html: css }} />
          <script dangerouslySetInnerHTML={{ __html: script }} />
        </div>

        {/* 右侧：产品信息 */}
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>{safeTitle}</h1>

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
            {item.model && (
              <div>
                <dt style={{ color: '#6b7280' }}>车型</dt>
                <dd style={{ fontWeight: 600 }}>{item.model}</dd>
              </div>
            )}
            {item.year && (
              <div>
                <dt style={{ color: '#6b7280' }}>年份</dt>
                <dd style={{ fontWeight: 600 }}>{item.year}</dd>
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

          <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
            <button
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              加入购物车
            </button>
            <a
              href="/stock"
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                background: '#fff',
                color: '#111827',
                border: '1px solid #e5e7eb',
                textDecoration: 'none',
                textAlign: 'center',
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
