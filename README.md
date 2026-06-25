# 2026 世界杯实时战报 ⚽

一个数据可实时更新的 2026 世界杯（美/加/墨，48 队）战报应用。体育热血风，覆盖八大板块，含 AI 冠军预测与球迷投票。

**线上地址**: [https://worldcup-report.pages.dev](https://worldcup-report.pages.dev)

## 八大板块

| Tab | 内容 |
|---|---|
| 积分榜 | 12 组小组赛积分榜，前二晋级（绿）/ 最佳第三 8 席（金）高亮，顶部今日速递含进球队员 |
| 射手榜 | 进球排序，前三领奖台，含点球数，中文名 + 国旗展示 |
| 淘汰赛 | 近期赛程（按日）+ 冠军之路漏斗 + 依当前积分推演的晋级席位 |
| 预测 | 9 维加权冠军预测模型（FIFA 排名 / 阵容身价 / 状态 / 底蕴 / 攻防 / 伤病 / 大赛经验 / 势头）+ 球迷投票（冠军/亚军/季军） |
| 球队 | 点选球队看积分、近期战绩、核心射手，按分组折叠呈现 |
| 数据 | 各组进球、各轮进球、射手榜 Top10（recharts）+ 关键指标 |
| 战报 | 由真实比分模板化生成的中文战报，可按"爆冷/血洗/进球大战"等标签筛选 |
| 精彩瞬间 | ABC News 专业赛事图集，灯箱浏览 + 照片点赞 |

## 数据架构

三级数据回退，确保任何环境都有数据：

```
前端每 60s 自动轮询
    ↓
后端 /api/wc/*（Cloudflare Pages Functions）
    ├─ 1. football-data.org 实时 API（收费版，含完整赛程/积分/射手）
    ├─ 2. Supabase 数据库缓存（自动同步 + 进球数据注入）
    └─ 3. data/snapshot.json 快照（离线兜底）
```

### Supabase 后端

| 表 | 用途 |
|---|---|
| `wc_data` | 积分榜 / 射手榜 / 球队名单缓存 |
| `wc_matches` | 比赛数据（含进球详情注入） |
| `wc_sync_meta` | 同步元信息（时间戳 / 数据源） |
| `gallery_likes` | 照片点赞 + 应用全局点赞 + 冠军投票（复用表，键前缀区分） |

### 进球数据注入

football-data.org API 的 matches 端点不返回 `goals` 字段。应用通过 Supabase 种子数据双策略注入进球信息：
- **策略 1**：按 match ID 精确匹配
- **策略 2**：按球队名对模糊匹配（种子数据 ID 1001-1072 vs live API ID 537xxx）

### 自动同步

通过 `/api/sync` 端点 + Cron Worker 定时拉取 football-data.org 最新数据并写入 Supabase，保证数据库缓存始终最新。

## 冠军预测模型

9 维加权评分 + softmax 概率归一化：

| 维度 | 权重 | 数据来源 |
|---|---|---|
| FIFA 排名 | 18% | FIFA.com（2026.06.11） |
| 阵容身价 | 16% | Transfermarkt（2026.06） |
| 小组赛状态 | 14% | football-data.org 实时 API |
| 世界杯底蕴 | 10% | FIFA 官方历史档案 |
| 伤病跟踪 | 10% | ESPN / BBC / Sky Sports |
| 攻击效率 | 8% | football-data.org 实时 API |
| 防守稳固 | 8% | football-data.org 实时 API |
| 大赛经验 | 8% | 世界杯冠军/决赛历史 |
| 近 3 场势头 | 8% | football-data.org 实时 API |
| 东道主加分 | +4 | — |

> 所有知识库数据均来自公开可验证来源，未收录球队使用明确默认分，不做猜测。模型仅供参考娱乐。

## 球迷投票

预测页底部内置投票功能：
- 选择冠军 / 亚军 / 季军（三个名次不可重复）
- 提交后实时展示各名次 Top 5 球队得票分布
- localStorage 防重复投票
- 乐观更新 + 失败回滚

## 快速开始

```bash
npm install
npm run dev          # http://localhost:5273
```

### 环境变量

复制 `.env.example` 为 `.env`，按需填写：

```env
FOOTBALL_DATA_TOKEN=xxx        # football-data.org API token（必填，实时数据）
SUPABASE_URL=xxx               # Supabase 项目 URL（必填，数据库缓存）
SUPABASE_SERVICE_ROLE_KEY=xxx  # Supabase service_role key（必填）
SYNC_SECRET=xxx                # /api/sync 鉴权密钥（可选）
NEWSAPI_KEY=xxx                # NewsAPI key（可选，精彩瞬间图集）
```

> 不配置也能跑 —— 自动回退到内置快照数据。

## 脚本

```bash
npm run dev        # 本地开发（Express + Vite 中间件）
npm run build      # 构建前端到 dist/client
npm start          # 运行生产构建
npm test           # 数据转换 / 战报生成单元测试
npm run lint       # tsc 类型检查
npm run snapshot   # 重新生成 data/snapshot.json 快照
npm run deploy     # 构建 + 部署到 Cloudflare Pages（Production）
npm run collect    # 收集精彩瞬间图集到本地缓存
```

## 部署

项目部署在 **Cloudflare Pages**，使用 Pages Functions 提供 API：

```
wrangler pages deploy dist/client --project-name=worldcup-report --branch=main
```

Pages Functions 路由：
- `/api/wc/[type]` — 赛事数据（standings / scorers / matches / teams）
- `/api/wc/gallery` — 精彩瞬间图集
- `/api/wc/gallery/likes` — 照片点赞
- `/api/app/likes` — 应用全局点赞
- `/api/app/vote` — 冠军投票
- `/api/sync` — 数据同步（Cron 触发）

## 技术栈

React 19 · Vite 6 · Tailwind v4 · TypeScript · Cloudflare Pages Functions · Supabase · Express · recharts · motion · lucide-react

## 说明

数据仅供学习演示。国旗来自 [flagcdn](https://flagcdn.com/)。
