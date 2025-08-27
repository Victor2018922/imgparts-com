
import Link from "next/link";

export default function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ImgParts 预览站（测试版）</h1>
      <p className="text-gray-700">
        这是一个以 <b>OE号 / 品类 / 产品名称</b> 为导向的汽配网站测试版本。
        我们先从“库存预览”这个点开始，逐步注入真实数据。
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Link href="/stock" className="card">
          <h3 className="font-semibold">库存预览</h3>
          <p className="text-sm text-gray-600 mt-1">对接 /scm-product/v1/stock2，展示图片、OE、名称、价格、库存。</p>
        </Link>
        <Link href="/search" className="card">
          <h3 className="font-semibold">OE 搜索（占位）</h3>
          <p className="text-sm text-gray-600 mt-1">后续接入按 OE / 名称 / 品类 的检索与筛选。</p>
        </Link>
      </div>
    </div>
  );
}
