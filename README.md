
# ImgParts 预览站（可直接部署的仓库）

这是一个已经准备好的 **Next.js 测试站点**，用于演示：
- 以 `OE号 / 品类 / 名称` 为导向的汽配站结构（从“库存预览”这个点开始）
- 通过服务器端代理对接 `https://niuniuparts.com:6001/scm-product/v1/stock2`（避免浏览器跨域）

## 部署到 Vercel（最简单）
1. 把本仓库完整上传到你的 GitHub（例如新建仓库 `imgparts-preview`）。
2. 登陆 https://vercel.com → Add New → Project → 选择你的仓库 → Import。
3. 在 Vercel 项目 **Settings → Environment Variables** 中添加：
   - `NIUNIUPARTS_BASE_URL` = `https://niuniuparts.com:6001`
   - `NIUNIUPARTS_BEARER_TOKEN` = `<如需鉴权则填入token，否则留空>`
   - `NIUNIUPARTS_PAGE_SIZE` = `20`
4. 点击 **Deploy**，完成后访问：`/` 与 `/stock`。

更多细节请见 `README_DEPLOY_TO_VERCEL.md`。
