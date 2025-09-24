/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // 兼容旧链接：/checkout 与 /cart 均跳到库存页结算面板
      { source: '/checkout', destination: '/stock?checkout=1', permanent: false },
      { source: '/cart', destination: '/stock?checkout=1', permanent: false },
    ];
  },
};

module.exports = nextConfig;
