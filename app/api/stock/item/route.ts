// app/api/stock/item/route.ts
import { NextResponse } from "next/server";

/**
 * 简单的“按编号取详情”的后端代理。
 * 先一次性取较多条（size=200），然后在服务端过滤出 num 对应的那一条。
 * 后续若上游提供单条查询接口，再把这里改成直连即可。
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const num = searchParams.get("num");

  if (!num) {
    return NextResponse.json(
      { error: "Missing query parameter: num" },
      { status: 400 }
    );
  }

  try {
    // 取一页较多数据，演示用。若 size 限制较小可适当调整并做多页循环。
    const upstream = await fetch(
      "https://niuniuparts.com:6001/scm-product/v1/stock2?size=200&page=0",
      { cache: "no-store" }
    );
    if (!upstream.ok) {
      return NextResponse.json(
        { error: "Upstream request failed" },
        { status: upstream.status }
      );
    }
    const json = await upstream.json();

    const list: any[] = json?.data || [];
    const item = list.find((x) => String(x?.num) === String(num));

    if (!item) {
      return NextResponse.json(
        { error: "Item not found", num },
        { status: 404 }
      );
    }

    return NextResponse.json({ item });
  } catch (e: any) {
    console.error("Fetch single item failed:", e);
    return NextResponse.json(
      { error: "Server error", message: e?.message || String(e) },
      { status: 500 }
    );
  }
}
