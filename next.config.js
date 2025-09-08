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
  // 保持默认：不要添加 output: 'export'
  experimental: {
    optimizeCss: true,
  },
};

module.exports = nextConfig;
