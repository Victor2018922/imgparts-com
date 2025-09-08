import Image from "next/image";
import Link from "next/link";

type Item = {
  num: string;
  product: string;
  oe: string;
  brand: string;
  model: string;
  year?: string;
  image?: string;
  images?: string[];
};

async function getItem(num: string): Promise<Item | null> {
  const url = `${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/stock/item?num=${encodeURIComponent(num)}`;
  // 在 Node 端，用相对路径同样可行（兼容本地 dev）
  const res = await fetch(url.startsWith("http") ? url : `/api/stock/item?num=${encodeURIComponent(num)}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const arr: Item[] = await res.json();
  return arr && arr.length > 0 ? arr[0] : null;
}

export default async function StockDetailPage(props: { params: { num: string } }) {
  const num = decodeURIComponent(props.params.num);
  const item = await getItem(num);

  if (!item) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="text-sm text-gray-500 mb-2">
          数据源：niuniuparts.com（测试预览用途）
        </div>
        <h1 className="text-xl font-semibold mb-2">Item not found.</h1>
        <Link href="/stock" className="text-blue-600 hover:underline">← Back to Stock</Link>
      </div>
    );
  }

  // 画廊数据
  const gallery = (item.images && item.images.length > 0)
    ? item.images
    : (item.image ? [item.image] : []);

  // 简单的服务端“默认当前索引”为 0（交互在客户端用 <Image> 自适应加载）
  const currentIndex = 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="text-sm text-gray-500 mb-2">
        数据源：niuniuparts.com（测试预览用途）
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* 画廊区域 */}
        <div className="md:w-1/2">
          <div className="relative w-full aspect-square bg-gray-100 rounded overflow-hidden">
            {gallery.length > 0 ? (
              <Image
                src={gallery[currentIndex]}
                alt={item.product || item.num}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                quality={70}
                style={{ objectFit: "contain", background: "white" }}
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                No Image
              </div>
            )}
          </div>

          {/* 缩略图条（简单版：首屏展示所有缩略图，点击跳到 hash） */}
          {gallery.length > 1 && (
            <div className="mt-3 grid grid-cols-5 sm:grid-cols-6 gap-2">
              {gallery.map((src, idx) => (
                <a key={idx} href={`#img-${idx}`} className="block border rounded overflow-hidden bg-gray-100">
                  <div className="relative w-full aspect-square">
                    <Image
                      src={src}
                      alt={`thumb-${idx}`}
                      fill
                      sizes="100px"
                      quality={40}
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* 上一张/下一张（无状态简化：用锚点引导，前端不持久状态；如需更强交互可后续加 use client 版本） */}
          {gallery.length > 1 && (
            <div className="flex gap-2 mt-3">
              <a className="px-3 py-2 border rounded text-sm" href="#img-prev" title="上一张">上一张</a>
              <a className="px-3 py-2 border rounded text-sm" href="#img-next" title="下一张">下一张</a>
              <span className="text-xs text-gray-500">(简化版切换；若需真正切图交互，下一步我给你客户端版)</span>
            </div>
          )}
        </div>

        {/* 信息区域 */}
        <div className="md:w-1/2">
          <h1 className="text-2xl font-semibold mb-2">{item.product || "-"}</h1>
          <div className="text-gray-700 space-y-1">
            <div><b>SKU / Num：</b>{item.num}</div>
            <div><b>OE：</b>{item.oe || "-"}</div>
            <div><b>Brand：</b>{item.brand || "-"}</div>
            <div><b>Model：</b>{item.model || "-"}</div>
            {item.year ? <div><b>Year：</b>{item.year}</div> : null}
          </div>

          <div className="mt-3 flex gap-2">
            <CopyButton label="复制 OE" value={item.oe || ""} disabled={!item.oe} />
            <CopyButton label="复制 Num" value={item.num} />
          </div>

          <div className="mt-6">
            <Link href="/stock" className="text-blue-600 hover:underline">← Back to Stock</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// —— 轻量的服务端可用按钮（用 form+JS 实现复制，避免引入 client 组件复杂度）——
function CopyButton({ label, value, disabled }: { label: string; value: string; disabled?: boolean }) {
  return (
    <form
      action={async () => {
        "use server";
        // 服务器动作本身无法访问客户端剪贴板，这里仅作占位。
        // 真正复制发生在浏览器端：我们用最简单的 progressive enhancement 写法。
      }}
      onSubmit={(e) => {
        // 阻止提交，用浏览器 API 复制
        e.preventDefault();
        if (disabled || !value) return;
        navigator.clipboard
          .writeText(value)
          .then(() => alert("已复制到剪贴板：" + value))
          .catch(() => alert("复制失败，请手动选择文本复制。"));
      }}
    >
      <button
        type="submit"
        className="px-3 py-2 border rounded text-sm disabled:opacity-50"
        disabled={disabled}
        title={label}
      >
        {label}
      </button>
    </form>
  );
}
