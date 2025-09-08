import Link from "next/link";

async function getItem(num: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/stock/item?num=${num}`);
  if (!res.ok) {
    throw new Error("Failed to fetch item data");
  }
  return res.json();
}

export default async function ItemPage({ params }: { params: { num: string } }) {
  const item = await getItem(params.num);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Product Detail</h1>
      <p><strong>Num:</strong> {item.num}</p>
      <p><strong>Product:</strong> {item.product}</p>
      <p><strong>OE:</strong> {item.oe}</p>
      <p><strong>Brand:</strong> {item.brand}</p>
      <p><strong>Model:</strong> {item.model}</p>
      <p><strong>Year:</strong> {item.year}</p>

      {/* 新增字段（测试数据可用） */}
      <p><strong>Price:</strong> {item.price ?? "N/A"}</p>
      <p><strong>Stock:</strong> {item.stock ?? "N/A"}</p>

      <div style={{ marginTop: "20px" }}>
        <Link href="/stock">
          <button style={{ padding: "10px 20px", backgroundColor: "#0070f3", color: "white", border: "none", borderRadius: "5px" }}>
            返回列表
          </button>
        </Link>
      </div>
    </div>
  );
}
