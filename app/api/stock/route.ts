import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("https://niuniuparts.com:6001/scm-product/v1/stock2?size=20&page=0");
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch from niuniuparts" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: "Server error", detail: String(err) }, { status: 500 });
  }
}
