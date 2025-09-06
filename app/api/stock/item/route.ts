

import { NextResponse } from "next/server";

type StockItem = {
  num: string;
  product: string;
  oe: string;
  brand: string;
  model: string;
  year: string;
};

// 演示数据（后续可改为数据库/JSON文件）
const DATA: StockItem[] = [
  { num: "JS0260", product: "Oil Filter",  oe: "90915-YZZE1", brand: "Toyota",     model: "Corolla",  year: "2018" },
  { num: "VW1234", product: "Air Filter",  oe: "06C133843",   brand: "Volkswagen", model: "Passat",   year: "2020" },
  { num: "BMW5678",product: "Brake Pad",   oe: "34116761252", brand: "BMW",        model: "X5",       year: "2022" },
];

function ciEqual(a?: string, b?: string) {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const brand = searchParams.get("brand") || "";
  const model = searchParams.get("model") || "";
  const year  = searchParams.get("year")  || "";
  const num   = searchParams.get("num")   || "";

  let result = DATA;

  // 支持 num 精确查询（区分优先级：若传 num，优先按 num 过滤，其他条件可作为叠加）
  if (num) {
    result = result.filter(i => ciEqual(i.num, num));
  }
  if (brand) {
    result = result.filter(i => ciEqual(i.brand, brand));
  }
  if (model) {
    result = result.filter(i => ciEqual(i.model, model));
  }
  if (year) {
    result = result.filter(i => ciEqual(i.year, year));
  }

  return NextResponse.json(result);
}
