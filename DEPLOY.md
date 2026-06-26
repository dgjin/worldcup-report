# Cloudflare Pages 部署指南

## 准备工作

项目已配置好以下文件：
- `wrangler.jsonc` — wrangler 配置，项目名称 worldcup-report
- `_pages/functions/lib/snapshot.ts` — API 共享库（快照+football-data.org）
- `_pages/functions/api/wc/[type].ts` — Pages Functions API 路由 `/api/wc/:type`
- `data/snapshot.json` — 世界杯快照数据

## 方式一：GitHub 集成（推荐，自动 CI/CD）

```bash
# 1. 推送代码到 GitHub
git add -A
git commit -m "deploy to cloudflare pages"
git push origin main
```

2. 访问 https://dash.cloudflare.com/pages → **Create a project** → **Connect to Git**
3. 选择仓库，点击 **Begin setup**
4. 设置：
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Output directory**: `dist/client`
   - **Build output root**: `/`（留空）
5. 展开 **Environment Variables**，添加：
   - `FOOTBALL_DATA_TOKEN` = ``
6. 点击 **Save and Deploy**

后续每次 `git push` 会自动触发部署。

## 方式二：wrangler CLI 手动部署

```bash
cd /Users/dgjin/dgjinapp/不良资产商机发现助手/worldcup-report

# 登录 Cloudflare（会打开浏览器）
npx wrangler login

# 构建前端
npm run build

# 部署到 Pages
npx wrangler pages deploy dist/client --project-name=worldcup-report
```

首次使用 `wrangler login` 会自动打开浏览器授权。后续可以用 API token 免登录：
```bash
export CLOUDFLARE_API_TOKEN="your-api-token-here"
npx wrangler pages deploy dist/client --project-name=worldcup-report
```

## 方式三：手动 Dashboard 上传

1. `npm run build`
2. `zip -r worldcup-report.zip dist/ _pages/functions/ data/snapshot.json wrangler.jsonc package.json`
3. https://dash.cloudflare.com → Pages → Create → **Direct upload**

## 环境变量说明

| Variable | 说明 | 默认值 |
|---|---|---|
| `FOOTBALL_DATA_TOKEN` | football-data.org API token（免费） | 留空则使用快照数据 |

API Token 申请：https://www.football-data.org/client/register（1分钟拿到，免费档 10次/分钟）

## 本地预览

```bash
npx wrangler pages dev dist/client
# → http://localhost:8788
```
