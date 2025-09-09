import { NextResponse } from "next/server";

const BASE = "https://niuniuparts.com:6001/scm-product/v1/stock2";

// http -> https（带查询参数也保留）
function toHttps(u: string): string {
  const t = u?.trim?.() ?? "";
  if (!t) return t;
  if (t.startsWith("https://")) return t;
  if (t.startsWith("http://")) return "https://" + t.slice(7);
  if (t.startsWith("//")) return "https:" + t;
  return t;
}

// 从一条记录上拿首图
function pickImage(item: any): string | null {
  if (Array.isArray(item?.pics) && item.pics.length > 0) {
    const first = item.pics[0];
    if (typeof first === "string") return toHttps(first);
  }
  return null;
}

/**
 * 详情接口策略：
 * - 读取 ?num=xxx
 * - 依次抓取多页列表（最多 5 页，每页 200 条），直到匹配到为止
 * - 匹配字段：num / code / sku / id（全等比较）
 * - 命中后，附加 image 字段（来自 pics[0]，自动升级为 https）
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const num = (searchParams.get("num") || "").trim();
    if (!num) {
      return NextResponse.json({ error: "Missing num" }, { status: 400 });
    }

    const MAX_PAGES = 5;
    const SIZE = 200;

    let found: any = null;

    for (let page = 0; page < MAX_PAGES; page++) {
      const url = `${BASE}?size=${SIZE}&page=${page}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        // 外部异常直接返回对应状态码
        return NextResponse.json(
          { error: "Failed to fetch external list" },
          { status: res.status }
        );
      }

      const json = await res.json();

      // 兼容外部返回结构
      const list: any[] = Array.isArray(json)
        ? json
        : Array.isArray((json as any)?.content)
        ? (json as any).content
        : Array.isArray((json as any)?.data)
        ? (json as any).data
        : Array.isArray((json as any)?.items)
        ? (json as any).items
        : Array.isArray((json as any)?.list)
        ? (json as any).list
        : [];

      const needle = num;
      found =
        list.find((it: any) => String(it?.num ?? "").trim() === needle) ??
        list.find((it: any) => String(it?.code ?? "").trim() === needle) ??
        list.find((it: any) => String(it?.sku ?? "").trim() === needle) ??
        list.find((it: any) => String(it?.id ?? "").trim() === needle) ??
        null;

      if (found) break;

      // 如果这一页已经没有数据，提前结束
      if (!Array.isArray(list) || list.length < SIZE) break;
    }

    if (!found) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // 附加 image 字段（首图）
    const image = pickImage(found);
    const result = image ? { ...found, image } : found;

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
