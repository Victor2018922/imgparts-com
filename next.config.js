/** @type {import('next').NextConfig} */
const nextConfig = {
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
  // 可选：在本地开发时更快一点
  experimental: {
    optimizeCss: true,
  },
};

module.exports = nextConfig;
