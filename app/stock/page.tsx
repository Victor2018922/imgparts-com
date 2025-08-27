
import StockCard from "@/components/StockCard";

async function fetchStock(page: number) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/stock?page=${page}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch stock");
  return res.json();
}

export default async function StockPage({ searchParams }: { searchParams: Record<string, string|undefined> }) {
  const page = Number(searchParams.page ?? "0");
  const data = await fetchStock(page);

  // Try common wrappers
  let items: any[] = [];
  const candidates = ["content","data","list","items","records","rows","result"];
  for (const k of candidates) {
    if (Array.isArray(data?.[k])) { items = data[k]; break; }
  }
  if (!items.length && Array.isArray(data)) items = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">库存预览</h1>
        <div className="text-sm text-gray-500">页码：{page}</div>
      </div>

      {!items.length ? (
        <div className="text-gray-600">没有数据（请确认接口返回结构）。</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it, idx) => <StockCard key={idx} item={it} />)}
        </div>
      )}

      <div className="flex gap-2">
        <a className="card" href={`/stock?page=${Math.max(0, page-1)}`}>上一页</a>
        <a className="card" href={`/stock?page=${page+1}`}>下一页</a>
      </div>
    </div>
  );
}
