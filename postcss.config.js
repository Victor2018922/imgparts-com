/**
 * 万能安全版 PostCSS 配置：
 * - 只导出 plugins（Next.js 要求）
 * - tailwindcss / autoprefixer 按“有则用、无则跳过”的策略加载，避免未安装时报错
 */
module.exports = {
  plugins: [
    (() => { try { return require('tailwindcss'); } catch { return null; } })(),
    (() => { try { return require('autoprefixer'); } catch { return null; } })(),
  ].filter(Boolean),
};
