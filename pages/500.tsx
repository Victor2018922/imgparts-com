// pages/500.tsx
// 说明：为兼容 Vercel 的静态导出预渲染，提供一个简洁的 500 页面。
// 不使用任何 “use client” 或浏览器专属 API，确保可静态预渲染。

import Link from 'next/link';

export default function Custom500() {
  return (
    <main style={{maxWidth: 720, margin: '40px auto', padding: '0 16px', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'}}>
      <h1 style={{fontSize: 28, fontWeight: 700, marginBottom: 12}}>500 – Server Error</h1>
      <p style={{color: '#555', lineHeight: 1.7}}>
        抱歉，服务器出现了一点问题。请稍后重试，或返回站点继续浏览。
      </p>
      <div style={{marginTop: 20}}>
        <Link href="/" style={{color: '#2563eb', textDecoration: 'underline'}}>← 返回首页</Link>
      </div>
      <p style={{marginTop: 24, fontSize: 12, color: '#888'}}>本页用于静态导出/预渲染兼容。</p>
    </main>
  );
}
