'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type AnyItem = Record<string, any>;

export default function StockPage() {
  const [items, setItems] = useState<AnyItem[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/stock', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        // 兼容不同返回结构：优先数组，否则尝试常见字段
        const list =
          Array.isArray(json)
            ? json
            : Array.isArray(json?.content)
            ? json.content
            : Array.isArray(json?.data)
            ? json.data
            : Array.isArray(json?.items)
            ? json.items
            : [];

        setItems(list);
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    })();
  }, []);

  if (err) {
    return (
      <div style={{ padding: 20 }}>
        <h1>库存预览</h1>
        <p style={{ color: 'red' }}>加载失败：{err}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>库存预览</h1>
      <p>共 {items.length} 条</p>

      {items.length === 0 ? (
        <p>暂无数据</p>
      ) : (
        <ul>
          {items.map((it: AnyItem, idx: number) => {
            const num =
              it.num ?? it.code ?? it.sku ?? it.id ?? String(idx);
            const name =
              it.product ?? it.name ?? it.title ?? it.oe ?? '—';
            return (
              <li key={num + '_' + idx} style={{ marginBottom: 8 }}>
                <Link href={`/stock/${encodeURIComponent(num)}`}>
                  {num} — {name}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
