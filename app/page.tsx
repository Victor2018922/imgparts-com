// 首页：中英文切换（/?lang=zh 或 /?lang=en）+ B2B/B2C 展示卡片
// 说明：仅渲染静态文案与链接，不影响已稳定的列表页与详情页逻辑

import Link from "next/link";

type Lang = "zh" | "en";

function getLang(sp?: { [k: string]: string | string[] | undefined }): Lang {
  const v = (sp?.lang as string) || "";
  return v === "en" ? "en" : "zh";
}

const dict = {
  zh: {
    heroTitle: "全球汽配一站式选购",
    heroSub: "按品牌 / 车型 / OE 精准匹配，实时价格与库存",
    stockBtn: "进入库存",
    oeBtn: "OE 搜索",
    langLabel: "语言",
    zh: "中文",
    en: "English",
    b2bTitle: "B2B 批发合作",
    b2bDesc: "支持批量下单、长期供货、ODM/OEM、报关与物流方案对接",
    b2bCTA: "进入 B2B",
    b2cTitle: "B2C 零售购买",
    b2cDesc: "按车型与 OE 快速搜索，单件直购",
    b2cCTA: "进入 B2C",
    refLabel: "对标参考",
  },
  en: {
    heroTitle: "One-Stop Auto Parts Shopping",
    heroSub: "Match by brand / model / OE with live price & stock",
    stockBtn: "Browse Stock",
    oeBtn: "OE Search",
    langLabel: "Language",
    zh: "中文",
    en: "English",
    b2bTitle: "B2B Wholesale",
    b2bDesc: "Bulk orders, long-term supply, ODM/OEM, customs & logistics",
    b2bCTA: "Go to B2B",
    b2cTitle: "B2C Retail",
    b2cDesc: "Quick search by vehicle & OE; buy single items",
    b2cCTA: "Go to B2C",
    refLabel: "Reference",
  },
} as const;

export default function Home({
  searchParams,
}: {
  searchParams?: { [k: string]: string | string[] | undefined };
}) {
  const lang = getLang(searchParams);
  const t = dict[lang];

  // 加入语言切换链接（不改顶部导航），仅作用于首页文案
  const zhHref = "/?lang=zh";
  const enHref = "/?lang=en";

  // B2B/B2C 入口：如果你已有专页，可把 href 换成真实路径
  const b2bHref = "/stock?channel=b2b";
  const b2cHref = "/stock?channel=b2c";

  return (
    <main style={{ padding: "24px 0" }}>
      {/* 顶部：语言切换 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          fontSize: 14,
          color: "#6b7280",
        }}
      >
        <span>{t.langLabel}:</span>
        <Link
          href={zhHref}
          style={{
            padding: "4px 8px",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            background: lang === "zh" ? "#f3f4f6" : "#fff",
            textDecoration: "none",
            color: "#111827",
          }}
        >
          {t.zh}
        </Link>
        <Link
          href={enHref}
          style={{
            padding: "4px 8px",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            background: lang === "en" ? "#f3f4f6" : "#fff",
            textDecoration: "none",
            color: "#111827",
          }}
        >
          {t.en}
        </Link>
      </div>

      {/* Hero 区 */}
      <section
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>{t.heroTitle}</h1>
        <p style={{ marginTop: 8, color: "#6b7280", fontSize: 14 }}>{t.heroSub}</p>
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <Link
            href="/stock"
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              background: "#111827",
              color: "#fff",
              textDecoration: "none",
            }}
          >
            {t.stockBtn}
          </Link>
          <Link
            href="/oe"
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              background: "#fff",
              color: "#111827",
              border: "1px solid #e5e7eb",
              textDecoration: "none",
            }}
          >
            {t.oeBtn}
          </Link>
        </div>
      </section>

      {/* B2B / B2C 卡片 */}
      <section
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 16,
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 24,
          }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>{t.b2bTitle}</h2>
          <p style={{ marginTop: 6, color: "#6b7280", fontSize: 14 }}>{t.b2bDesc}</p>
          <Link
            href={b2bHref}
            style={{
              marginTop: 12,
              display: "inline-block",
              padding: "10px 16px",
              borderRadius: 10,
              background: "#2563eb",
              color: "#fff",
              textDecoration: "none",
            }}
          >
            {t.b2bCTA}
          </Link>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 24,
          }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>{t.b2cTitle}</h2>
          <p style={{ marginTop: 6, color: "#6b7280", fontSize: 14 }}>{t.b2cDesc}</p>
          <Link
            href={b2cHref}
            style={{
              marginTop: 12,
              display: "inline-block",
              padding: "10px 16px",
              borderRadius: 10,
              background: "#10b981",
              color: "#fff",
              textDecoration: "none",
            }}
          >
            {t.b2cCTA}
          </Link>
        </div>
      </section>

      {/* 参考站 */}
      <section style={{ marginTop: 16, color: "#6b7280", fontSize: 13 }}>
        {t.refLabel}：{" "}
        <a
          href="https://www.autodoc.co.uk/"
          target="_blank"
          rel="noreferrer"
          style={{ textDecoration: "underline", color: "#2563eb" }}
        >
          autodoc.co.uk
        </a>
      </section>
    </main>
  );
}
