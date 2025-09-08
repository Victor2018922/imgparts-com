import { NextResponse } from "next/server";

const mockData = [
  {
    num: "JS0260",
    product: "Oil Filter",
    oe: "90915-YZZE1",
    brand: "Toyota",
    model: "Corolla",
    year: "2018",
    price: "25 USD",
    stock: 120,
  },
  {
    num: "AB1234",
    product: "Brake Pad",
    oe: "BP-7788",
    brand: "BMW",
    model: "X5",
    year: "2020",
    price: "85 USD",
    stock: 60,
  },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const num = searchParams.get("num");

  const item = mockData.find((i) => i.num === num);

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  return NextResponse.json(item);
}
