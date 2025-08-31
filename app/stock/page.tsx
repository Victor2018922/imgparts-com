// app/stock/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import React from "react";

export default function StockPage() {
  return (
    <div style={{ padding: 20 }}>
      <h1>库存产品列表</h1>
      <p style={{ marginTop: 8 }}>
        这是临时的最小页面，用于让构建通过。功能会在下一步逐项加回。
      </p>
      <p style={{ marginTop: 12 }}>
        回到首页： <a href="/" style={{ textDecoration: "underline" }}>Home</a>
      </p>
      <p style={{ marginTop: 12 }}>
        测试一个详情示例：{" "}
        <a href="/stock/JS0260" style={{ textDecoration: "underline" }}>
          /stock/JS0260
        </a>
      </p>
    </div>
  );
}
