
# 一键部署到 Vercel（图文步骤）

> 你已经有 `imgparts-preview.zip`。下面的步骤帮你把它部署上网，获得一个可以分享给别人的网址。

## 方式 A：最简单（推荐）—— 通过 Vercel + GitHub

1. **创建 GitHub 仓库**
   - 打开 https://github.com 新建一个空仓库，例如：`imgparts-preview`
   - 在你电脑上解压 `imgparts-preview.zip`，把所有文件上传到该仓库（包括 `app/`、`components/`、`package.json`、`next.config.js` 等）
   - 可直接在 GitHub 网页端上传，也可以用 git：
     ```bash
     git init
     git remote add origin https://github.com/你的账号/imgparts-preview.git
     git add .
     git commit -m "init preview"
     git push -u origin main
     ```

2. **登录 Vercel 并导入项目**
   - 打开 https://vercel.com —— 用 GitHub 登录
   - 点击 **Add New… → Project**
   - 选择你刚创建的仓库 `imgparts-preview`，点击 **Import**

3. **设置环境变量（很重要）**
   - 在 Vercel 项目页 → **Settings → Environment Variables**，添加：
     - `NIUNIUPARTS_BASE_URL` = `https://niuniuparts.com:6001`
     - `NIUNIUPARTS_BEARER_TOKEN` = （如果接口需要鉴权就在这里填，否则留空）
     - `NIUNIUPARTS_PAGE_SIZE` = `20`（或 50/100）
   - 将这些环境变量复制到 **Production** 和 **Preview** 两个环境中（若出现）

4. **点击 Deploy**
   - Vercel 会自动执行 `npm install` 和 `npm run build`
   - 完成后会给你一个形如 `https://imgparts-preview-yourname.vercel.app` 的网址

5. **访问测试**
   - 打开 `https://你的域名.vercel.app/`（首页）
   - 打开 `https://你的域名.vercel.app/stock`（库存预览页面）

> 如果接口需要鉴权但你未配置 token，可能会看到 “没有数据” 或报错。给我一个 token，我可以帮你确认是否还需额外请求头。

---

## 方式 B：直接上传（不走 GitHub）

1. 在 Vercel 首页点击 **Add New… → Project → Import**，选择 **Other**，上传整个项目文件夹。
2. 在部署向导中照样设置 **Environment Variables**。
3. 点击 **Deploy**。

---

## 常见问题

- **跨域问题（CORS）？**  
  我们的页面请求的是 `/api/stock`（Next.js 的服务端路由），由服务端转发到 niuniuparts，所以浏览器不会跨域。

- **图片显示不出来？**  
  不用 `next/image`，我们使用 `<img>`，通常不需要配置域名白名单。如果仍然无法显示，提供一个返回样例我来调整。

- **返回结构跟我这边不一样？**  
  组件内做了字段容错；若仍未显示，发我一页 JSON，我来快速适配。

- **需要密码保护吗？**  
  如需临时保护预览站，可以在 Vercel 上启用 **Password Protection**（Pro 计划可用），或我给你加一个简单的 Basic Auth 中间件。

---

## 下一步

- 接入 “OE/名称/品类 搜索”接口（我来开发 `/search` 页面）
- 增加产品详情页（支持替代件、适配车型）
- 打通 B2C 下单链路：购物车 → 支付
- 打通 B2B 批量询盘：Excel 导入 OE 清单 → 在线报价

如果你愿意，我也能把这个项目直接推到你的 GitHub（你给我一个空仓库链接），并协助你在 Vercel 上点几下就完成部署。
