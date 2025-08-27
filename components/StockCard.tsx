
'use client';

type AnyRecord = Record<string, any>;

function pick<T=string>(obj: AnyRecord, keys: string[], fallback: string = ""): T | string {
  for (const k of keys) {
    const parts = k.split('.');
    let cur: any = obj;
    for (const p of parts) {
      if (cur && p in cur) cur = cur[p];
      else { cur = undefined; break; }
    }
    if (cur !== undefined && cur !== null && cur !== "") return cur as T;
  }
  return fallback;
}

export default function StockCard({ item }: { item: AnyRecord }) {
  const name = String(pick(item, ["name","productName","title","itemName"], "未命名产品"));
  const oe = String(pick(item, ["oe","oeNumber","oe_number","OE","originalNo","partNo"], ""));
  const price = pick<number>(item, ["price","unitPrice","salePrice","amount"], "") as number | string;
  const stock = pick<number>(item, ["stock","qty","quantity","available","inventory"], "") as number | string;
  const image = String(pick(item, ["image","imageUrl","imgUrl","picture","thumbnail","photo","images.0"], ""));
  const brand = String(pick(item, ["brand","brandName","maker"], ""));

  return (
    <div className="card">
      <div className="flex gap-4">
        <div className="w-28 h-28 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
          {image ? <img src={image} alt={name} className="object-contain w-full h-full" /> : <span className="text-xs text-gray-400">No Image</span>}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-lg">{name}</h3>
            {brand && <span className="badge bg-gray-100 text-gray-700">品牌：{brand}</span>}
            {oe && <span className="badge bg-blue-100 text-blue-700">OE：{oe}</span>}
          </div>
          <div className="mt-2 text-sm text-gray-600 space-y-1">
            <p>价格：{price !== "" ? String(price) : "—"}</p>
            <p>库存：{stock !== "" ? String(stock) : "—"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
