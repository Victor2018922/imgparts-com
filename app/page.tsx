'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const [mode, setMode] = useState<'B2C' | 'B2B'>('B2C');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('preferredTradeMode');
      if (saved === 'B2B' || saved === 'B2C') setMode(saved);
    } catch {}
  }, []);

  const choose = (m: 'B2C' | 'B2B') => {
    setMode(m);
    try {
      localStorage.setItem('preferredTradeMode', m);
    } catch {}
  };

  return (
    <main className="container mx-auto p-6">
      <h1 className="text-2xl font-semibold">ImgParts 预览站</h1>
      <p className="text-gray-600 mt-2">请选择交易模式并开始浏览商品（参考 AUTODOC 的引导方式）。</p>

      <div className="mt-6 flex items-center gap-3">
        <span className="text-gray-700">交易模式：</span>
        <button
          onClick={() => choose('B2C')}
          className={`rounded-md border px-3 py-1 ${mode === 'B2C' ? 'bg-gray-100' : ''}`}
        >
          B2C（个人）
        </button>
        <button
          onClick={() => choose('B2B')}
          className={`rounded-md border px-3 py-1 ${mode === 'B2B' ? 'bg-gray-100' : ''}`}
        >
          B2B（公司）
        </button>
      </div>

      <div className="mt-8">
        <Link
          href="/stock"
          className="inline-block rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
        >
          进入库存预览
        </Link>
      </div>

      <div className="mt-10 text-sm text-gray-500">
        当前模式：<b>{mode}</b>。该设置将应用于结算流程（可随时切换）。
      </div>
    </main>
  );
}
