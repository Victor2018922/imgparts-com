// app/api/stock/item/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // 禁用缓存，确保每次实时拉取

const STOCK_EXCEL_API =
  'https://niuniuparts.com:6001/scm-product/v1/stock2/excel?size=2000&page=0';

// 统一返回：{ status: 'ok', item: {...} }
// 未找到：HTTP 404 + { status: 'not_found' }
// 异常：HTTP 500 + { error: '...' }
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const num = searchParams.get('num');

  if (!num) {
    return NextResponse.json({ error: 'missing num' }, { status: 400 });
  }

  try {
    // 直接使用 excel 接口一次性拿全量，然后按 num 精确匹配
    const res = await fetch(STOCK_EXCEL_API, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json(
        { error: `upstream ${res.status}` },
        { status: 502 }
      );
    }

    const json = await res.json();
    const list: any[] = Array.isArray(json?.data) ? json.data : [];

    const target = list.find(
      (it) =>
        String(it?.num ?? '').trim().toLowerCase() ===
        String(num).trim().toLowerCase()
    );

    if (!target) {
      return NextResponse.json({ status: 'not_found' }, { status: 404 });
    }

    // 规范化图片字段（只保留 http/https）
    const pics = Array.isArray(target.pics)
      ? target.pics.filter(
          (p: any) => typeof p === 'string' && /^https?:\/\//i.test(p)
        )
      : [];

    const item = { ...target, pics };

    // 兼容前端老代码（item / data 双字段都带上）
    return NextResponse.json({ status: 'ok', item, data: item });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
