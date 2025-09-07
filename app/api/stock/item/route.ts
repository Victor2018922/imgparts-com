import { NextResponse } from "next/server";

type StockItem = {
  num: string;
  product: string;
  oe: string;
  brand: string;
  model: string;
  year: string;
  image?: string; // 图片 URL（来自外部 API）
};

// ——本地兜底数据（当外部 API 不可用时，避免页面报错）——
const FALLBACK: StockItem[] = [
  { num: "JS0260", product: "Oil Filter",  oe: "90915-YZZE1", brand: "Toyota",     model: "Corolla",  year: "2018", image: "" },
  { num: "VW1234", product: "Air Filter",  oe: "06C133843",   brand: "Volkswagen", model: "Passat",   year: "2020", image: "" },
  { num: "BMW5678",product: "Brake Pad",   oe: "34116761252", brand: "BMW",        model: "X5",       year: "2022", image: "" },
];

// ——把外部接口的原始字段“映射”为我们统一结构（做了多字段名兼容）——
function mapItem(raw: any): StockItem {
  return {
    num: String(raw?.num ?? raw?.sku ?? raw?.id ?? raw?.productNo ?? raw?.partNo ?? ""),
    product: String(raw?.product ?? raw?.name ?? raw?.title ?? raw?.productName ?? ""),
    oe: String(raw?.oe ?? raw?.oe_code ?? raw?.oeNo ?? raw?.oem ?? raw?.oeCode ?? ""),
    brand: String(raw?.brand ?? raw?.make ?? raw?.manufacturer ?? raw?.brandName ?? ""),
    model: String(raw?.model ?? raw?.vehicleModel ?? raw?.carModel ?? raw?.modelName ?? ""),
    year: String(raw?.year ?? raw?.productionYear ?? raw?.y ?? raw?.yearText ?? ""),
    image: String(
      raw?.image ??
      raw?.image_url ??
      raw?.picture ??
      raw?.img ??
      raw?.mainImage ??
      raw?.imageUrl ??
      ""
    ),
  };
}

// 忽略大小写的相等比较
function ciEqual(a?: string, b?: string) {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

async function fetchExternalPage(apiBase: string, params: URLSearchParams, page: number, size: number, key?: string) {
  const q = new URLSearchParams(params);
  q.set("page", String(page));
  q.set("size", String(size));
  const url = `${apiBase}?${q.toString()}`;

  const res = await fetch(url, {
    headers: key ? { Authorization: key } : undefined,
    // 如果你的 API 用 Bearer：{ Authorization: `Bearer ${key}` }
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`External API error ${res.status}`);
  const data = await res.json();

  // 兼容两种返回形态：
  // 1）{ content: [...], totalElements, totalPages, ... }
  // 2）[ ... ]
  const content = Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : [];
  return content as any[];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const apiBase = process.env.SOURCE_API_URL || ""; // e.g. https://niuniuparts.com:6001/scm-product/v1/stock2
  const apiKey  = process.env.SOURCE_API_KEY || "";

  // 前端筛选参数（我们会在拉取后再次补充过滤，确保可用）
  const brand = searchParams.get("brand") || "";
  const model = searchParams.get("model") || "";
  const year  = searchParams.get("year")  || "";
  const num   = searchParams.get("num")   || "";

  // 透传分页（如果前端指定，则按指定；否则默认“尽量多拿几页”，但做安全上限）
  const reqSize = Number(searchParams.get("size") || "") || 200;  // 每页条数默认 200
  const reqPage = searchParams.get("page");                       // 指定 page 时只取该页
  const MAX_PAGES = 5; // 默认最多抓 5 页，避免一次拉太多（后续我们会做真正的分页）

  // ——优先从外部 API 拉数据——
  if (apiBase) {
    try {
      let rawItems: any[] = [];

      if (reqPage !== null) {
        // 指定了 page：只取这一页
        const content = await fetchExternalPage(apiBase, searchParams, Number(reqPage), reqSize, apiKey);
        rawItems = content;
      } else {
        // 未指定 page：尽量多页抓取（带安全上限），便于我们生成筛选下拉
        for (let p = 0; p < MAX_PAGES; p++) {
          const content = await fetchExternalPage(apiBase, searchParams, p, reqSize, apiKey);
          rawItems.push(...content);
          if (!content || content.length < reqSize) break; // 提前收尾
        }
      }

      const mapped = rawItems.map(mapItem).filter(x => x.num && x.product);

      // 某些外部 API 可能不支持我们这些筛选；这里再做“补充过滤”
      let result = mapped;
      if (brand) result = result.filter(i => ciEqual(i.brand, brand));
      if (model) result = result.filter(i => ciEqual(i.model, model));
      if (year)  result = result.filter(i => ciEqual(i.year, year));
      if (num)   result = result.filter(i => ciEqual(i.num, num));

      return NextResponse.json(result);
    } catch (e) {
      console.error("Fetch external API failed:", e);
      // 继续走兜底
    }
  }

  // ——兜底：返回本地示例 3 条（外部 API 未配置或不可用时）——
  let result = FALLBACK;
  if (num)   result = result.filter(i => ciEqual(i.num, num));
  if (brand) result = result.filter(i => ciEqual(i.brand, brand));
  if (model) result = result.filter(i => ciEqual(i.model, model));
  if (year)  result = result.filter(i => ciEqual(i.year, year));

  return NextResponse.json(result);
}
