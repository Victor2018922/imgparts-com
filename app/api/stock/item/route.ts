// app/api/stock/item/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // 关闭缓存，实时拉取

// 从请求里推导本站域名（避免直接打外部 6001 端口）
function getOrigin(req: Request) {
  const url = new URL(req.url);
  // 部署后 X-Forwarded-Host/X-Forwarded-Proto 更可靠
  const host =
    (req.headers.get('x-forwarded-host') || req.headers.get('host') || url.host).trim();
  const proto = (req.headers.get('x-forwarded-proto') || url.protocol.replace(':', '')).trim();
  return `${proto}://${host}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const num = searchParams.get('num');

  if (!num) {
    return NextResponse.json({ error: 'missing num' }, { status: 400 });
  }

  try {
    const origin = getOrigin(req);
    // 复用站内已工作的列表接口，避免直连外部端口导致 500
    const listApi = `${origin}/api/stock/list?size=2000&page=0`;

    // 带超时与明确的 JSON 头
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(listApi, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(t);

    if (!res.ok) {
      // 把上游状态透出，便于排查
      return NextResponse.json(
        { error: `list api ${res.status}` },
        { status: 502 }
      );
    }

    const json = await res.json();

    // 兼容两种返回结构：{data:[...]} 或 直接是数组
    const list: any[] = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json)
      ? json
      : [];

    // 精确匹配 num（大小写不敏感、去空格）
    const key = String(num).trim().toLowerCase();
    const target =
      list.find((it) => String(it?.num ?? '').trim().toLowerCase() === key) || null;

    if (!target) {
      return NextResponse.json({ status: 'not_found' }, { status: 404 });
    }

    // 规范化图片，仅保留 http(s)
    const pics = Array.isArray(target.pics)
      ? target.pics.filter((p: any) => typeof p === 'string' && /^https?:\/\//i.test(p))
      : [];

    const item = { ...target, pics };

    // 为前端兼容保留两个字段
    return NextResponse.json({ status: 'ok', item, data: item });
  } catch (e: any) {
    // 明确抛出 500，并附加错误信息便于定位
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
