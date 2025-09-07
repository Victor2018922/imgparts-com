import { NextResponse } from "next/server";

type StockItem = {
  num: string;
  product: string;
  oe: string;
  brand: string; // 这里映射为“车厂/车系”，来自 raw.car（如 TOYOTA/HONDA）
  model: string; // 映射为 raw.carCode（如 年款/平台代码）
  year: string;  // 外部暂无明确年份，这里留空字符串
  image?: string; // 图片 URL（取 pics[0]）
};

// ——本地兜底数据（外部挂了时不白屏）——
const FALLBACK: StockItem[] = [
  { num: "JS0260", product: "Oil Filter",  oe: "90915-YZZE1", brand: "Toyota",     model: "Corolla",  year: "", image: "" },
  { num: "VW1234", product: "Air Filter",  oe: "06C133843",   brand: "Volkswagen", model: "Passat",   year: "", image: "" },
  { num: "BMW5678",product: "Brake Pad",   oe: "34116761252", brand: "BMW",        model: "X5",       year: "", image: "" },
];

// 忽略大小写的等值比较
function ciEqual(a?: string, b?: string) {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

// 映射外部一条记录到统一结构
function mapItem(raw: any): StockItem {
  const pics: string[] = Array.isArray(raw?.pics) ? raw.pics : [];
  return {
    num: String(raw?.num ?? raw?.id ?? raw?.sku ?? ""),
    product: String(raw?.name ?? raw?.product ?? raw?.title ?? ""),
    oe: String(raw?.oe ?? raw?.oeCode ?? raw?.oe_code ?? ""),
    // 品牌：用“车厂 car”对齐你的筛选（如 TOYOTA/HONDA），不是供应商品牌（raw.brand）
    brand: String(raw?.car ?? ""),
    // 车型：用 carCode（如 “FB2/3/6” 或 “雷凌,1408-1706,...”）
    model: String(raw?.carCode ?? raw?.model ?? ""),
    // 外部没有明确年款字段，这里先留空，后续若提供 year 再补
    year: "",
    image: pics.length > 0 ? String(pics[0]) : "",
  };
}

// 兼容外部返回结构：可能是数组，也可能是 {content:[]}，也可能是 {data:{data:[]}}
function pickList(json: any): any[] {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.content)) return json.content;
  if (Array.isArray(json?.data?.content)) return json.data.content;
  if (Array.isArray(json?.data?.data)) return json.data.data;
  return [];
}

async function fetchExternal(apiBase: string, qsIn: URLSearchParams, apiKey?: string) {
  // 只透传分页参数；brand/model/year/num 在本地再过滤，防止外部不支持
  const size = Number(qsIn.get("size") || "") || 200;
  const page = qsIn.get("page");
  const MAX_PAGES = 5;

  const buildUrl = (p: number) => {
    const q = new URLSearchParams();
    q.set("size", String(size));
    q.set("page", String(p));
    return `${apiBase}?${q.toString()}`;
  };

  const headers = apiKey ? { Authorization: apiKey } : undefined;

  const results: any[] = [];
  if (page !== null) {
    const res = await fetch(buildUrl(Number(page)), { headers, cache: "no-store" });
    if (!res.ok) throw new Error(`External API error ${res.status}`);
    const json = await res.json();
    results.push(...pickList(json));
  } else {
    // 未指定 page：连抓多页，便于前端下拉/搜索
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
  const apiBase = process.env.SOURCE_API_URL || ""; // https://niuniuparts.com:6001/scm-product/v1/stock2
  const apiKey  = process.env.SOURCE_API_KEY || "";

  const brand = searchParams.get("brand") || "";
  const model = searchParams.get("model") || "";
  const year  = searchParams.get("year")  || ""; // 暂无外部年款字段，先本地过滤空值不会生效
  const num   = searchParams.get("num")   || "";

  if (apiBase) {
    try {
      const rawList = await fetchExternal(apiBase, searchParams, apiKey);
      const mapped = rawList.map(mapItem).filter(x => x.num && x.product);

      // 本地补充过滤（外部不一定支持）
      let result = mapped;
      if (brand) result = result.filter(i => ciEqual(i.brand, brand));
      if (model) result = result.filter(i => ciEqual(i.model, model));
      if (year)  result = result.filter(i => ciEqual(i.year, year));
      if (num)   result = result.filter(i => ciEqual(i.num, num));

      return NextResponse.json(result);
    } catch (e) {
      console.error("External fetch failed:", e);
      // fallthrough to fallback
    }
  }

  // 兜底
  let result = FALLBACK;
  if (brand) result = result.filter(i => ciEqual(i.brand, brand));
  if (model) result = result.filter(i => ciEqual(i.model, model));
  if (year)  result = result.filter(i => ciEqual(i.year, year));
  if (num)   result = result.filter(i => ciEqual(i.num, num));

  return NextResponse.json(result);
}
