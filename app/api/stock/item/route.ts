import { NextResponse } from "next/server";

type StockItem = {
  num: string;
  product: string;
  oe: string;
  brand: string; // 使用外部 car 字段（如 TOYOTA/HONDA）
  model: string; // 使用外部 carCode
  year: string;  // 外部暂无明确年份字段，先留空
  image?: string; // pics[0]
};

// ——本地兜底（外网不可达时不白屏）——
const FALLBACK: StockItem[] = [
  { num: "JS0260", product: "Oil Filter",  oe: "90915-YZZE1", brand: "Toyota",     model: "Corolla",  year: "", image: "" },
  { num: "VW1234", product: "Air Filter",  oe: "06C133843",   brand: "Volkswagen", model: "Passat",   year: "", image: "" },
  { num: "BMW5678",product: "Brake Pad",   oe: "34116761252", brand: "BMW",        model: "X5",       year: "", image: "" },
];

// 忽略大小写相等
function ciEqual(a?: string, b?: string) {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

// 映射一条外部记录
function mapItem(raw: any): StockItem {
  const pics: string[] = Array.isArray(raw?.pics) ? raw.pics : [];
  return {
    num: String(raw?.num ?? raw?.id ?? raw?.sku ?? ""),
    product: String(raw?.name ?? raw?.product ?? raw?.title ?? ""),
    oe: String(raw?.oe ?? raw?.oeCode ?? raw?.oe_code ?? ""),
    brand: String(raw?.car ?? ""),       // 用车厂做“品牌”筛选
    model: String(raw?.carCode ?? ""),   // 用车型/年款段
    year: "",                            // 暂无
    image: pics.length > 0 ? String(pics[0]) : "",
  };
}

// 兼容返回结构：[], {content:[]}, {data:{data:[]}}
function pickList(json: any): any[] {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.content)) return json.content;
  if (Array.isArray(json?.data?.content)) return json.data.content;
  if (Array.isArray(json?.data?.data)) return json.data.data;
  return [];
}

async function fetchExternal(apiBase: string, qsIn: URLSearchParams, apiKey?: string) {
  // 只透传分页，其他筛选本地做二次过滤
  const size = Number(qsIn.get("size") || "") || 200;
  const page = qsIn.get("page");
  const MAX_PAGES = 5;

  const headers = apiKey ? { Authorization: apiKey } : undefined;
  const buildUrl = (p: number) => {
    const q = new URLSearchParams();
    q.set("size", String(size));
    q.set("page", String(p));
    return `${apiBase}?${q.toString()}`;
    // 你的 API： https://niuniuparts.com:6001/scm-product/v1/stock2?size=...&page=...
  };

  const results: any[] = [];
  if (page !== null) {
    const res = await fetch(buildUrl(Number(page)), { headers, cache: "no-store" });
    if (!res.ok) throw new Error(`External API error ${res.status}`);
    const json = await res.json();
    results.push(...pickList(json));
  } else {
    for (let p = 0; p < MAX_PAGES; p++) {
      const res = await fetch(buildUrl(p), { headers, cache: "no-store" });
      if (!res.ok) break;
      const json = await res.json();
      const list = pickList(json);
      results.push(...list);
      if (!list || list.length < size) break;
    }
  }
  return results;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // ✅ 关键：即使 .env 没配好，也默认用你的 API 地址
  const DEFAULT_API = "https://niuniuparts.com:6001/scm-product/v1/stock2";
  const apiBase = process.env.SOURCE_API_URL || DEFAULT_API;
  const apiKey  = process.env.SOURCE_API_KEY || "";

  const brand = searchParams.get("brand") || "";
  const model = searchParams.get("model") || "";
  const year  = searchParams.get("year")  || "";
  const num   = searchParams.get("num")   || "";

  try {
    const rawList = await fetchExternal(apiBase, searchParams, apiKey);
    const mapped = rawList.map(mapItem).filter(x => x.num && x.product);

    // 本地补充过滤
    let result = mapped;
    if (brand) result = result.filter(i => ciEqual(i.brand, brand));
    if (model) result = result.filter(i => ciEqual(i.model, model));
    if (year)  result = result.filter(i => ciEqual(i.year, year));
    if (num)   result = result.filter(i => ciEqual(i.num, num));

    return NextResponse.json(result);
  } catch (e) {
    console.error("External fetch failed:", e);
  }

  // 兜底
  let result = FALLBACK;
  if (brand) result = result.filter(i => ciEqual(i.brand, brand));
  if (model) result = result.filter(i => ciEqual(i.model, model));
  if (year)  result = result.filter(i => ciEqual(i.year, year));
  if (num)   result = result.filter(i => ciEqual(i.num, num));

  return NextResponse.json(result);
}
