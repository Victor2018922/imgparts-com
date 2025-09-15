/** 从任意字段里扒出第一个可能的图片 URL（支持 <img src="..."> 片段） */
function pickFirstImageUrlDeep(input: any, depth = 0, seen = new Set<any>()): string | null {
  if (!input || depth > 6 || seen.has(input)) return null;
  seen.add(input);

  if (typeof input === "string") {
    // 如果是一段 HTML，尝试提取 <img src="...">
    const m = input.match(/<img\b[^>]*src=['"]?([^'">\s]+)['"]?/i);
    if (m?.[1]) return m[1];
    return input.trim();
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      const hit = pickFirstImageUrlDeep(item, depth + 1, seen);
      if (hit) return hit;
    }
    return null;
  }

  if (typeof input === "object") {
    // 常见字段优先
    const prefer = [
      "image","imageUrl","image_url","img","imgUrl","img_url","thumb","thumbnail",
      "cover","picture","pictures","photo","photos","gallery","album",
      "url","pic","picUrl","pic_url","fileUrl","file_url","path","filePath","filepath"
    ];
    for (const k of prefer) {
      if (k in input) {
        const hit = pickFirstImageUrlDeep((input as Record<string, any>)[k], depth + 1, seen);
        if (hit) return hit;
      }
    }
    // 全量兜底
    for (const v of Object.values(input)) {
      const hit = pickFirstImageUrlDeep(v, depth + 1, seen);
      if (hit) return hit;
    }
  }
  return null;
}

/** 用 images.weserv.nl 代理输出 HTTPS 图片，并做轻量压缩/缩放 */
function toHttpsProxy(raw?: string | null): string | null {
  if (!raw) return null;
  let u = raw.trim();
  if (!u) return null;

  // 支持 //xx 和 /xx
  if (u.startsWith("//")) u = "http:" + u;
  if (u.startsWith("/")) u = "http://niuniuparts.com" + u;

  // 如果是 data:image，直接用
  if (/^data:image\//i.test(u)) return u;

  // images.weserv.nl 需要去掉协议
  u = u.replace(/^https?:\/\//i, "");

  // 参数说明：
  // w/h 控制画布；fit=contain 保持比例；we=auto WebP；il 渐进式
  return `https://images.weserv.nl/?url=${encodeURIComponent(u)}&w=800&h=600&fit=contain&we&il`;
}
