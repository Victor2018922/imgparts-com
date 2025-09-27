// 注意：本文件为「服务端组件」，没有 'use client'。
// 这样 generateMetadata 能在服务端正确运行，标题按 UTF-8 正常输出（避免乱码）。
// 同时使用纯 CSS（radio + label）实现可点击缩略图切换主图，无需客户端 JS。

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

async function fetchItem(num: string): Promise<Item | null> {
  try {
    const resp = await fetch(
      'https://niuniuparts.com:6001/scm-product/v1/stock2?size=200&page=0',
      { cache: 'no-store' }
    );
    if (resp.ok) {
      const data = await resp.json();
      const rows: Item[] = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.content)
        ? (data as any).content
        : [];
      const found = rows.find((x) => String(x?.num ?? '') === String(num));
      if (found) return found;
    }
  } catch {}
  return null;
}

export async function generateMetadata({ params }: { params: { num: string } }) {
  // 仅拼接，不做任何 decode，避免中文被错误处理
  const item = await fetchItem(params.num);
  const parts = [item?.brand, item?.product, item?.oe, params.num].filter(Boolean);
  return { title: parts.join(' | ') || `Item ${params.num}` };
}

export default async function Page({ params }: { params: { num: string } }) {
  const num = params.num;
  const item = await fetchItem(num);

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

  // 纯 CSS 轮播：用 radio 控制显示的主图
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
  const safeTitle = titleParts.join(' | ');

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 24,
        padding: '24px 0',
      }}
    >
      {/* 左侧：图片画廊（纯 CSS 可点击缩略图切换） */}
      <div className="gallery">
        {/* Radio 开关（第一张默认选中） */}
        {images.map((_, i) => (
          <input key={`r-${i}`} type="radio" name="gallery" id={`g-${i}`} defaultChecked={i === 0} />
        ))}

        {/* 主图区域 */}
        <div className="main">
          {images.map((src, i) => (
            <img key={`main-${i}`} data-idx={i} src={src} alt="product" />
          ))}
        </div>

        {/* 缩略图区域（≥18） */}
        <div className="thumbs">
          {images.map((src, i) => (
            <label key={`thumb-${i}`} htmlFor={`g-${i}`} title={`第 ${i + 1} 张`}>
              <img src={src} alt={`thumb-${i + 1}`} />
            </label>
          ))}
        </div>

        {/* 动态样式 */}
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </div>

      {/* 右侧：商品信息 */}
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
