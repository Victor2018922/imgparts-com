export default function Test({ params }: { params: { num: string } }) {
  return (
    <div style={{ padding: 20 }}>
      <a href="/stock">← 返回列表</a>
      <h1>详情页测试</h1>
      <p>你访问的编号是：{params.num}</p>
    </div>
  );
}
