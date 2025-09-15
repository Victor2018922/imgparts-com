/** 统一把可能的图片地址规范成可加载的 HTTPS 绝对地址 */
function normalizeMaybeImageUrl(s: string): string | null {
  let str = (s || "").trim();
  if (!str) return null;

  // 内联 data:image
  if (/^data:image\//i.test(str)) return str;

  // //xx 开头 -> https://xx
  if (str.startsWith("//")) str = "https:" + str;

  // /xx 开头 -> https://niuniuparts.com/xx
  if (str.startsWith("/")) str = "https://niuniuparts.com" + str;

  // 强制把 http:// 升级为 https://（避免 https 页面混合内容被浏览器拦截）
  str = str.replace(/^http:\/\//i, "https://");

  // 简单兜底：像 http(s)://xx 或 data:image/ 才返回
  if (/^https?:\/\//i.test(str) || /^data:image\//i.test(str)) return str;

  // 如果是一段 HTML，尝试提取 <img src="...">
  const m = str.match(/<img\b[^>]*src=['"]?([^'">\s]+)['"]?/i);
  if (m?.[1]) return normalizeMaybeImageUrl(m[1]);

  return null;
}

/** 在对象任意层级里找第一个可能的图片 URL（不依赖后缀名） */
function pickFirstImageUrlDeep(input: any, depth = 0, seen = new Set<any>()): string | null {
  if (!input || depth > 6 || seen.has(input)) return null;
  seen.add(input);

  if (typeof input === "string") {
    const u = normalizeMaybeImageUrl(input);
    if (u) return u;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      const hit = pickFirstImageUrlDeep(item, depth + 1, seen);
      if (hit) return hit;
    }
    return null;
  }

  if (typeof input === "object") {
    // 常见的图片字段优先
    const prefer = [
      "image","imageUrl","image_url","img","imgUrl","img_url",
      "thumb","thumbnail","cover","picture","pictures","photo","photos","gallery","album",
      "url","pic","picUrl","pic_url","fileUrl","file_url","path","filePath","filepath"
    ];
    for (const k of prefer) {
      if (k in input) {
        const hit = pickFirstImageUrlDeep((input as Record<string, any>)[k], depth + 1, seen);
        if (hit) return hit;
      }
    }
    // 其次全量扫一遍
    for (const v of Object.values(input)) {
      const hit = pickFirstImageUrlDeep(v, depth + 1, seen);
      if (hit) return hit;
    }
  }
  return null;
}
