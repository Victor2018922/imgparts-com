// postcss.config.js  (CommonJS)
module.exports = {
  plugins: {
    // 可留可去：如无 import 需求可删
    'postcss-import': {},
    // 如不需要嵌套，也可删下面一行
    'tailwindcss/nesting': {},
    tailwindcss: {},
    autoprefixer: {},
  },
};
