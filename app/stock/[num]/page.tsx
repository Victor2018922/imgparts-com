// 服务端组件：防止标题乱码；并实现跨页检索指定 num 的商品
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

const API_BASE =
  'https://niuniuparts.com:6001/scm-product/v1/stock2';
const PAGE_SIZE = 200;
const MAX_PAGES = 40; // 最多检查 40 页（可按需要调整）

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
  // 逐页拉取，命中即返回；遇到空页或不足一整页则提前停止
  for (let p = 0; p < MAX_PAGES; p++) {
    const rows = await fetchPage(p);
    if (!rows || rows.length === 0) break;
    const found = rows.find((x) => String(x?.num ?? '') === String(num));
    if (found) return found;
    if (rows.length < PAGE_SIZE) break; // 最后一页
  }
  return null;
}

export async function generateMetadata({ params }: { params: { num: string } }) {
  // 为了稳定性，这里先用简易标题；页面内会显示完整标题（不乱码）
  return { title: `Item ${params.num}` };
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

  // 组装图片列表；保持缩略图数量 ≥ 18；无图则用透明占位
  const placeholder =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAQAAABx0wduAAAAAklEQVR42u3BMQEAAADCoPVPbQ0PoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8JwC0QABG4zJSwAAAABJRU5ErkJggg==';

  const raw: string[] =
    item.images ||
    item.pics ||
    item.gallery ||
    item.imageUrls ||
    (item.image ? [item.image] : []) ||
    [];

  // 去空/去重
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

  // 纯 CSS 轮播（radio + label）
  const css =
    `
.gallery { width: 100%; }
.gallery .main {
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 16px;
  background: #fff;
  border: 1px solid #eee;
  position: relative;
}
.gallery .main img {
  position: absolute;
  inset: 0;
  width: 100%; height: 100%;
  object-fit: contain;
  display: none;
}
.gallery .thumbs {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 8px;
}
.gallery .thumbs label {
  display: block;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #fff;
  cursor: pointer;
}
.gallery .thumbs img {
  width: 100%; height: 100%; object-fit: cover;
}
.gallery input[type="radio"] { display: none; }
`.trim() +
    '\n' +
    images
      .map(
        (_s, i) =>
          `#g-${i}:checked ~ .main img[data-idx="${i}"]{display:block}
#g-${i}:checked ~ .thumbs label[for="g-${i}"]{border:2px solid #2563eb}`
      )
      .join('\n');

  const titleParts = [item.brand, item.product, item.oe, num].filter(Boolean);
  const safeTitle = titleParts.join(' | '); // 页面可见主标题（避免乱码：不做任何 decode）

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 24,
        padding: '24px 0',
      }}
    >
      {/* 左侧：图片画廊 */}
      <div className="gallery">
        {/* 单选开关（第1张默认选中） */}
        {images.map((_, i) => (
          <input key={`r-${i}`} type="radio" name="gallery" id={`g-${i}`} defaultChecked={i === 0} />
        ))}

        <div className="main">
          {images.map((src, i) => (
            <img key={`main-${i}`} data-idx={i} src={src} alt="product" />
          ))}
        </div>

        <div className="thumbs">
          {images.map((src, i) => (
            <label key={`thumb-${i}`} htmlFor={`g-${i}`} title={`第 ${i + 1} 张`}>
              <img src={src} alt={`thumb-${i + 1}`} />
            </label>
          ))}
        </div>

        <style dangerouslySetInnerHTML={{ __html: css }} />
      </div>

      {/* 右侧：信息 */}
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
          <button
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              background: '#fff',
              color: '#111827',
              border: '1px solid #e5e7eb',
              cursor: 'pointer',
            }}
          >
            立即购买
          </button>
        </div>
      </div>
    </div>
  );
}
