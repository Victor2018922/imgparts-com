// pages/404.tsx
export default function NotFoundPage() {
  return (
    <main style={{maxWidth: 720, margin: '40px auto', padding: '0 16px', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'}}>
      <h1 style={{fontSize: 28, fontWeight: 700, marginBottom: 12}}>404 – Page Not Found</h1>
      <p style={{color: '#555', lineHeight: 1.7}}>
        找不到你请求的页面。
      </p>
      <p>
        <a href="/" style={{color: '#2563eb', textDecoration: 'underline'}}>← 返回首页</a>
      </p>
      <p style={{marginTop: 24, fontSize: 12, color: '#888'}}>本页是构建阶段的兜底 404。</p>
    </main>
  );
}
