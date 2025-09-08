/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // 允许从外部 OSS 加载并由 Next.js 自动优化（压缩/裁剪/缓存）
    remotePatterns: [
      {
        protocol: "http",
        hostname: "niuniuparts-image.oss-cn-hangzhou.aliyuncs.com",
        port: "",
        pathname: "/**",
      },
      // 如后续有 https 或其它图域名，可在此追加
    ],
  },
};

module.exports = nextConfig;
