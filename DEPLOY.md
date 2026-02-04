# 🚀 Cloudflare Pages 部署指南

## 快速部署

```bash
# 1. 安装依赖
npm install

# 2. 登录 Cloudflare（只需一次）
npx wrangler login

# 3. 部署到生产环境
npm run deploy:cf

# 4. 部署到预览分支
npm run deploy:cf:staging
```

## 环境要求

- Node.js 18+
- npm 或 yarn
- Cloudflare 账号

## 本地开发

```bash
# 本地预览
npm run preview

# 或使用任意静态服务器
npm run start
```

## 首次部署前

确保已在 [Cloudflare Dashboard](https://dash.cloudflare.com) 创建 Pages 项目，项目名为 `canvas`。

## 部署配置

- **配置文件**: `wrangler.toml`
- **构建命令**: 无需构建（纯静态项目）
- **部署目录**: 项目根目录 `.`

## 安全头信息

部署时自动配置以下安全头：

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

静态资源（JS/CSS）配置了长期缓存。
