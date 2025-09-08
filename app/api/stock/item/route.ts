import { NextResponse } from "next/server";

/**
 * 从外部接口取列表（第一页 20 条），再用 num 匹配出单条返回。
 * 目前与 /stock 列表页的取数口径一致（page=0&size=20）。
 * 如需扩大范围，将 size 调大即可。
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const num = searchParams.get("num");

    if (!num) {
      return NextResponse.json({ error: "Missing num" }, { status: 400 });
    }

    // 拉取外部列表数据
    const res = await fetch(
      "https://niuniuparts.com:6001/scm-product/v1/stock2?size=20&page=0",
      { cache: "no-store" }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch from niuniuparts" },
        { status: res.status }
      );
    }

    const json = await res.json();

    // 尝试从多种常见字段里拿列表
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

    // 在列表中按 num / code / sku / id 匹配
    const item =
      list.find((it: any) => {
        const candidate =
          it?.num ?? it?.code ?? it?.sku ?? it?.id ?? "";
        return String(candidate) === String(num);
      }) ?? null;

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
