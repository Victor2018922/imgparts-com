// app/api/stock/item/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';   // 每次实时拉取
export const runtime = 'nodejs';          // 使用 Node.js 运行时，避免 edge 限制

// 同一个接口同时准备 http / https 两套，优先 http（更兼容），失败再回退 https
const SOURCES = [
  {
    excel: 'http://niuniuparts.com:6001/scm-product/v1/stock2/excel?size=2000&page=0',
    basic: 'http://niuniuparts.com:6001/scm-product/v1/stock2?size=2000&page=0',
  },
  {
    excel: 'https://niuniuparts.com:6001/scm-product/v1/stock2/excel?size=2000&page=0',
    basic: 'https://niuniuparts.com:6001/scm-product/v1/stock2?size=2000&page=0',
  },
];

// —— 工具函数 ——

// 带超时与 UA 的 fetch
async function safeFetchJson(url: string, timeoutMs = 20000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        // 某些网关对 UA 较敏感，补一个通用 UA
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`upstream ${res.status} for ${url}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// 只保留 http/https 的字符串
function normalizePics(pics: any): string[] {
  if (!Array.isArray(pics)) return [];
  return pics.filter((p) => typeof p === 'string' && /^https?:\/\//i.test(p));
}

// 按 num 精确匹配（忽略大小写与空格）
function findByNum(list: any[], num: string) {
  const key = String(num).trim().toLowerCase();
  return list.find((it) => String(it?.num ?? '').trim().toLowerCase() === key);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const num = searchParams.get('num');

  if (!num) {
    return NextResponse.json({ error: 'missing num' }, { status: 400 });
  }

  const errors: string[] = [];

  try {
    // 依次尝试：先 http 源（excel -> basic），失败再 https 源（excel -> basic）
    for (const src of SOURCES) {
      // 1) excel
      try {
        const j = await safeFetchJson(src.excel);
        const list = Array.isArray(j?.data) ? j.data : [];
        const hit = findByNum(list, num);
        if (hit) {
          const item = { ...hit, pics: normalizePics(hit.pics) };
          return NextResponse.json({ status: 'ok', item, data: item });
        }
      } catch (e: any) {
        errors.push(`excel failed: ${src.excel} -> ${e?.message || e}`);
      }

      // 2) basic
      try {
        const j = await safeFetchJson(src.basic);
        const list = Array.isArray(j?.data) ? j.data : [];
        const hit = findByNum(list, num);
        if (hit) {
          const item = { ...hit, pics: normalizePics(hit.pics) };
          return NextResponse.json({ status: 'ok', item, data: item });
        }
      } catch (e: any) {
        errors.push(`basic failed: ${src.basic} -> ${e?.message || e}`);
      }
    }

    // 都没命中
    return NextResponse.json(
      { status: 'not_found', tried: SOURCES, errors },
      { status: 404 }
    );
  } catch (e: any) {
    // 把链路的错误也返回，方便你看到真实原因
    return NextResponse.json(
      { error: String(e?.message || e), errors },
      { status: 500 }
    );
  }
}
