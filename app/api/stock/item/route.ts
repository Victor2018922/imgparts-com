import { NextResponse } from "next/server";

// 示例静态数据（后续可改为数据库/CSV）
const stockData = [
  { num: "JS0260", product: "Oil Filter", oe: "90915-YZZE1", brand: "Toyota",      model: "Corolla", year: "2018" },
  { num: "VW1234", product: "Air Filter", oe: "06C133843",   brand: "Volkswagen",  model: "Passat",  year: "2020" },
  { num: "BMW5678", product: "Brake Pad", oe: "34116761252", brand: "BMW",         model: "X5",      year: "2022" },
  // ✅ 后续你可以在这里继续追加更多真实库存数据
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // 允许空字符串，空则不过滤
  const brand = (searchParams.get("brand") ?? "").trim();
  const model = (searchParams.get("model") ?? "").trim();
  const year  = (searchParams.get("year")  ?? "").trim();

  // 基础结果
  let result = stockData;

  // 严格等值匹配（区分大小写，如果想忽略大小写，可在此处统一转小写比较）
  if (brand) result = result.filter((item) => item.brand === brand);
  if (model) result = result.filter((item) => item.model === model);
  if (year)  result = result.filter((item) => item.year  === year);

  return NextResponse.json(result);
}
