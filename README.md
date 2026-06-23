# 2026 世界杯实时战报 ⚽

一个数据可实时更新的 2026 世界杯（美/加/墨，48 队）战报应用。体育热血风，覆盖六大板块。

## 板块

| Tab | 内容 |
|---|---|
| 积分榜 | 12 组小组赛积分榜，前二晋级（绿）/ 最佳第三 8 席（金）高亮 |
| 射手榜 | 进球排序，前三领奖台，含点球数 |
| 淘汰赛 | 近期赛程（按日）+ 冠军之路漏斗 + 依当前积分推演的晋级席位 |
| 球队 | 点选球队看积分、近期战绩、核心射手 |
| 数据 | 各组进球、各轮进球、射手榜 Top10（recharts）+ 关键指标 |
| 战报 | 由真实比分模板化生成的中文战报，可按"爆冷/血洗/进球大战"等标签筛选 |

## 实时数据机制

数据源为 [football-data.org](https://www.football-data.org/) 免费档（竞赛代码 `WC`）：

```
前端每 60s 自动轮询  →  后端 /api/wc/*（Express 代理 + 60s 缓存）
                          ├─ 有 token → 调 football-data.org 真实 API
                          └─ 无 token / 失败 → 回退 data/snapshot.json 快照
```

- **没 key 也能跑**：内置一份截至 2026-06-23 的真实赛况快照（赛果与积分真实，交叉验证自 NBC/ESPN；射手榜为示例）。
- **配 key 即实时**：刷新为分钟级（免费档限流约 10 次/分钟，故后端缓存 60s），非秒级直播。

## 快速开始

```bash
npm install
npm run dev          # http://localhost:5273
```

### 开启真·实时（可选）

1. 去 https://www.football-data.org/client/register 免费注册，1 分钟拿到 token。
2. 复制 `.env.example` 为 `.env`，填入 `FOOTBALL_DATA_TOKEN=你的token`。
3. 重启 `npm run dev`。右上角数据源徽章会从「快照」变为「实时」。

## 脚本

```bash
npm run dev        # 开发（Express + Vite 中间件）
npm run build      # 构建前端 + 打包服务端
npm start          # 运行生产构建
npm test           # 数据转换 / 战报生成单元测试
npm run lint       # tsc 类型检查
npm run snapshot   # 由 data/build-snapshot.mjs 重新生成快照
```

## 技术栈

React 19 · Vite 6 · Tailwind v4 · TypeScript · Express · recharts · motion · lucide-react

## 说明

数据仅供学习演示。国旗来自 [flagcdn](https://flagcdn.com/)。
