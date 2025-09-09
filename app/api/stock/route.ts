import { NextResponse } from "next/server";

/**
 * 代理外部库存列表。
 * - 透传 ?size= 与 ?page= 到外部接口
 * - 默认 size=20, page=0
 * - 不改动返回结构（保持与外部一致）
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // 读取并规范化分页参数
    const sizeParam = searchParams.get("size");
    const pageParam = searchParams.get("page");

    const size = Number.isFinite(Number(sizeParam)) ? Math.max(1, Math.min(200, Number(sizeParam))) : 20;
    const page = Number.isFinite(Number(pageParam)) ? Math.max(0, Number(pageParam)) : 0;

    const externalUrl = `https://niuniuparts.com:6001/scm-product/v1/stock2?size=${size}&page=${page}`;

    const res = await fetch(externalUrl, { cache: "no-store" });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch from niuniuparts" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
