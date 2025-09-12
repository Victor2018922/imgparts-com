// app/api/stock/item/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // 每次实时拉取，避免缓存

// 你确认可用的两个外部 API（先用 excel，失败再回退普通）
const API_EXCEL = 'https://niuniuparts.com:6001/scm-product/v1/stock2/excel?size=2000&page=0';
const API_BASIC = 'https://niuniuparts.com:6001/scm-product/v1/stock2?size=2000&page=0';

// 通用抓取（带超时）
async function safeFetchJson(url: string, timeoutMs = 20000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        // 某些网关对 UA 比较敏感，补一个常见 UA
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`upstream ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// 规范图片：仅保留 http/https 字符串
function normalizePics(pics: any): string[] {
  if (!Array.isArray(pics)) return [];
  return pics.filter((p) => typeof p === 'string' && /^https?:\/\//i.test(p));
}

// 在数据集中按 num 精确匹配（大小写不敏感、去空格）
function findByNum(list: any[], num: string) {
  const key = String(num).trim().toLowerCase();
  return list.find(
    (it) => String(it?.num ?? '').trim().toLowerCase() === key
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const num = searchParams.get('num');

  if (!num) {
    return NextResponse.json({ error: 'missing num' }, { status: 400 });
  }

  try {
    // 1) 先从 excel 接口取（字段最全、含图片），失败再回退普通接口
    let data: any = null;
    let list: any[] = [];

    try {
      const json = await safeFetchJson(API_EXCEL);
      list = Array.isArray(json?.data) ? json.data : [];
    } catch {
      const json = await safeFetchJson(API_BASIC);
      list = Array.isArray(json?.data) ? json.data : [];
    }

    const target = findByNum(list, num);
    if (!target) {
      return NextResponse.json({ status: 'not_found' }, { status: 404 });
    }

    const item = { ...target, pics: normalizePics(target.pics) };

    // 前端兼容：同时返回 item 与 data 字段
    return NextResponse.json({ status: 'ok', item, data: item });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
