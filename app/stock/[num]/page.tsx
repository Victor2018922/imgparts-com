'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type AnyItem = Record<string, any>;

function pickFirst<T = any>(...candidates: T[]) {
  for (const c of candidates) {
    if (c === undefined || c === null) continue;
    if (typeof c === 'string' && c.trim() === '') continue;
    return c as T;
  }
  return undefined as unknown as T;
}

// 递归扫描对象里所有字符串，找到第一条看起来像图片的 URL
function findImageUrlDeep(obj: any): string | null {
  const seen = new Set<any>();
  const exts = /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i;

  function walk(x: any): string | null {
    if (x === null || x === undefined) return null;
    if (typeof x === 'string') {
      const s = x.trim();
      if (
        exts.test(s) ||
        (s.startsWith('http') && (s.includes('/img') || s.includes('/image') || s.includes('/images') || s.includes('/picture')))
      ) {
        return s;
      }
      return null;
    }
    if (typeof x !== 'object') return null;
    if (seen.has(x)) return null;
    seen.add(x);

    if (Array.isArray(x)) {
      for (const it of x) {
        const got = walk(it);
        if (got) return got;
      }
      return null;
    }

    // 优先扫一些可能的字段
    const preferKeys = [
      'image','img','picture','photo','thumbnail','cover',
      'imageUrl','imgUrl','picUrl','photoUrl','thumbnailUrl','coverUrl',
      'mainImage','main_image','url','src','path','file'
    ];
    for (const k of preferKeys) {
      if (k in x) {
        const got = walk(x[k]);
        if (got) return got;
      }
    }

    // 其余字段兜底扫描
    for (const k of Object.keys(x)) {
      if (preferKeys.includes(k)) continue;
      const got = walk(x[k]);
      if (got) return got;
    }
    return null;
  }

  return walk(obj);
}

function pickPrice(item: AnyItem): string | number | null {
  const val = pickFirst(
    item.price,
    item.salePrice,
    item.retailPrice,
    item.unitPrice,
    item.usdPrice,
    item.priceUsd,
    item.cnyPrice,
    item.priceRmb
  );
  return val ?? null;
}

function pickStock(item: AnyItem): string | number | null {
  const val = pickFirst(
    item.stock,
    item.qty,
    item.quantity,
    item.stockQty,
    item.inventory,
    item.balance,
    item.onHand
  );
  return val ?? null;
}

export default function ItemPage({ params }: { params: { num: string } }) {
  const { num } = params;
  const [item, setItem] = useState<AnyItem | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/stock/item?num=${encodeURIComponent(num)}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setItem(data);
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    })();
  }, [num]);

  const view = useMemo(() => {
    if (!item) return null;
    const name = pickFirst(item.product, item.name, item.title, item.oe, '—');
    const brand = pickFirst(item.brand, item.make, '—');
    const model = pickFirst(item.model, item.vehicle, '—');
    const year = pickFirst(item.year, item.years, '—');
    const price = pickPrice(item) ?? 'N/A';
    const stock = pickStock(item) ?? 'N/A';

    // 先尝试常见字段；若取不到，再用深度扫描兜底
    const direct =
      pickFirst(
        item.image,
        item.img,
        item.picture,
        item.photo,
        item.thumbnail,
        item.cover,
        item.imageUrl,
        item.imgUrl,
        item.picUrl,
        item.photoUrl,
        item.thumbnailUrl,
        item.coverUrl,
        item.mainImage,
        item.main_image,
        item.url
      ) ?? null;

    let image: string | null = null;
    if (typeof direct === 'string') {
      image = direct;
    } else {
      // 常见数组字段
      const arrays: any[] = [
        item.images, item.imgs, item.pictures, item.photos, item.thumbnails, item.gallery, item.media
      ].filter(Boolean);

      for (const arr of arrays) {
        if (Array.isArray(arr) && arr.length > 0) {
          const first = arr[0];
          if (typeof first === 'string') { image = first; break; }
          if (first && typeof first === 'object') {
            const nested = pickFirst(first.url, first.src, first.image, first.img, first.thumbnail, first.path);
            if (typeof nested === 'string') { image = nested; break; }
          }
        }
      }

      // 兜底：全量递归扫描
      if (!image) image = findImageUrlDeep(item);
    }

    return { name, brand, model, year, price, stock, image };
  }, [item]);

  if (err) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Product Detail</h1>
        <p style={{ color: 'red' }}>加载失败：{err}</p>
        <p style={{ marginTop: 16 }}>
          <Link href="/stock">← 返回列表</Link>
        </p>
      </div>
    );
  }

  if (!item || !view) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Product Detail</h1>
        <p>加载中…</p>
        <p style={{ marginTop: 16 }}>
          <Link href="/stock">← 返回列表</Link>
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Product Detail</h1>
      <p><strong>Num:</strong> {num}</p>
      <p><strong>Name:</strong> {view.name}</p>
      <p><strong>Brand:</strong> {view.brand}</p>
      <p><strong>Model:</strong> {view.model}</p>
      <p><strong>Year:</strong> {view.year}</p>
      <p><strong>Price:</strong> {view.price}</p>
      <p><strong>Stock:</strong> {view.stock}</p>

      {view.image ? (
        <div style={{ marginTop: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={view.image}
            alt={String(view.name)}
            style={{ maxWidth: 420, width: '100%', height: 'auto', borderRadius: 8, border: '1px solid #eee' }}
          />
        </div>
      ) : (
        <p style={{ marginTop: 12, color: '#666' }}>（暂无可识别的图片链接）</p>
      )}

      <p style={{ marginTop: 20 }}>
        <Link href="/stock">
          <button style={{ padding: '10px 20px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: 6 }}>
            ← 返回列表
          </button>
        </Link>
      </p>

      <div style={{ marginTop: 28, fontSize: 12, color: '#666' }}>
        数据源：niuniuparts.com（测试预览用途）
      </div>
    </div>
  );
}
