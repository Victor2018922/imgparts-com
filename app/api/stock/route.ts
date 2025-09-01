// app/api/stock/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // 优先用站点当前域名；本地/线上都适配
    const base =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      req.nextUrl.origin;

    // 指向 public/stock/stock_20_0.xlsx
    const fileUrl = `${base}/stock/stock_20_0.xlsx`;

    const r = await fetch(fileUrl, { cache: "no-store" });
    if (!r.ok) {
      return NextResponse.json(
        { error: `Fetch public excel failed: ${r.status}` },
        { status: 502 }
      );
    }

    const buf = await r.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="stock_20_0.xlsx"',
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
