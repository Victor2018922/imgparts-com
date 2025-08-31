// app/api/stock/route.ts
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// 必须：Node 运行时 + 强制动态，避免静态化
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 读取仓库内的 Excel 文件：app/api/stock/excel/stock_20_0.xlsx
    const filePath = path.join(
      process.cwd(),
      "app",
      "api",
      "stock",
      "excel",
      "stock_20_0.xlsx"
    );

    const buf = await fs.readFile(filePath);

    return new NextResponse(buf, {
      status: 200,
      headers: {
        // Excel MIME
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        // 触发下载（也方便被 /api/stock/item 作为二进制读取）
        "Content-Disposition": 'attachment; filename="stock_20_0.xlsx"',
        // CDN 缓存策略（可按需调整）
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
      },
    });
  } catch (err: any) {
    // 文件不存在或路径错误
    return NextResponse.json(
      { error: err?.message || "Stock file not found" },
      { status: 404 }
    );
  }
}
