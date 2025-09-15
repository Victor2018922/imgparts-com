/** 规范化 URL：支持 //xxx、/xxx、http(s)://xxx、data:image/... */
function normalizeUrlMaybeImage(s: string): string | null {
  const str = (s || "").trim();
  if (!str) return null;
  if (/^data:image\//i.test(str)) return str;
  if (str.startsWith("//")) return "https:" + str;
  if (str.startsWith("/")) return "https://niuniuparts.com" + str;
  if (/^https?:\/\//i.test(str)) return str;

  // 如果是一段 HTML，尝试提取 <img src="...">
  if (/<img\b[^>]*src=['"]?([^'">\s]+)['"]?/i.test(str)) {
    const m = str.match(/<img\b[^>]*src=['"]?([^'">\s]+)['"]?/i);
    if (m?.[1]) return normalizeUrlMaybeImage(m[1]);
  }
  return null;
}

/** 递归在任意层级中找“第一个像 URL 的字符串”就用（不过滤后缀） */
function findFirstImageUrlDeep(input: any, depth = 0, seen = new Set<any>()): string | null {
  if (!input || depth > 6 || seen.has(input)) return null;
  seen.add(input);

  if (typeof input === "string") {
    const u = normalizeUrlMaybeImage(input);
    if (u) return u;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      const hit = findFirstImageUrlDeep(item, depth + 1, seen);
      if (hit) return hit;
    }
    return null;
  }

  if (typeof input === "object") {
    // 优先扫常见图片字段
    const prefer = [
      "imageUrl","image_url","imgUrl","img_url","image","img","photo","picture",
      "thumb","thumbnail","cover","url","images","imgs","photos","pics","gallery",
      "album","pictures","pic","picUrl","pic_url","fileUrl","file_url","path","filePath","filepath"
    ];
    for (const k of prefer) {
      if (k in input) {
        const hit = findFirstImageUrlDeep((input as Record<string, any>)[k], depth + 1, seen);
        if (hit) return hit;
      }
    }
    // 其次全量扫
    for (const v of Object.values(input)) {
      const hit = findFirstImageUrlDeep(v, depth + 1, seen);
      if (hit) return hit;
    }
  }
  return null;
}

/* 保持 <img> 渲染不变（确认已有）：
<img
  src={it.image ? it.image : ""}
  alt={it.num}
  loading="lazy"
  decoding="async"
  referrerPolicy="no-referrer"
  style={{ maxWidth: "100%", maxHeight: 210, objectFit: "contain", borderRadius: 8 }}
  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
/>
*/
