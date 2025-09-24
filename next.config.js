// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 不再强制配置 images.domains，因为我们使用 <img> + https 升级 + 兜底
};

export default nextConfig;
