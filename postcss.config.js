/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'niuniuparts-image.oss-cn-hangzhou.aliyuncs.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'niuniuparts-image.oss-cn-hangzhou.aliyuncs.com',
        pathname: '/**',
      },
    ],
  },
  // ⚠️ 重要：
  // 1) 不要添加 output: 'export'（否则会强制静态导出导致很多限制）
  // 2) 不要开启 experimental.optimizeCss（开启会要求依赖 `critters`，Vercel 构建会报错）
};

module.exports = nextConfig;
