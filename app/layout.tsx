
import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "ImgParts 预览站",
  description: "以 OE号 / 品类 / 产品名称 为导向的汽配网站测试版",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <header className="bg-white border-b">
          <div className="container py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold">ImgParts 预览站</Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/" className="hover:underline">首页</Link>
              <Link href="/stock" className="hover:underline">库存预览</Link>
              <Link href="/search" className="hover:underline">OE 搜索</Link>
            </nav>
          </div>
        </header>
        <main className="container py-6">{children}</main>
        <footer className="container py-8 text-xs text-gray-500">
          数据源：niuniuparts.com（测试预览用途）
        </footer>
      </body>
    </html>
  );
}
