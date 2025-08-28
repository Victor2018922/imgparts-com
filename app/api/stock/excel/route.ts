// app/api/stock/excel/route.ts
import { NextRequest } from "next/server";

const UPSTREAM_BASE = "https://niuniuparts.com:6001/scm-product/v1/stock2/excel";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const size = searchParams.get("size") ?? "20";
  const page = searchParams.get("page") ?? "0";

  const upstream = `${UPSTREAM_BASE}?size=${encodeURIComponent(size)}&page=${encodeURIComponent(page)}`;

  const r = await fetch(upstream, {
    // Excel 是二进制流
    cache: "no-store",
  });

  if (!r.ok) {
    return new Response(
      JSON.stringify({ error: true, message: "Upstream error", status: r.status }),
      {
        status: r.status,
        headers: { "content-type": "application/json; charset=utf-8" },
      }
    );
  }

  const buf = await r.arrayBuffer();

  return new Response(buf, {
    status: 200,
    headers: {
      // 常见的 Excel MIME
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      // 让浏览器提示下载
      "content-disposition": `attachment; filename="stock_${size}_${page}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
