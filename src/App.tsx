import { useMemo, useRef, useState } from "react";
import { BarChart3, Camera, Crown, Heart, RefreshCw, ScrollText, Shield, Target, Trophy, Users } from "lucide-react";
import { useWorldCup } from "./api/client";
import { useAppLikes } from "./api/app";
import { useTheme } from "./lib/theme";
import { ThemeToggle } from "./components/ThemeToggle";
import { splitMatches, toGroupTables, toScorers } from "./lib/transform";
import { cn } from "./components/ui";
import { Loader } from "./components/ui";
import GroupStandings from "./views/GroupStandings";
import Scorers from "./views/Scorers";
import KnockoutBracket from "./views/KnockoutBracket";
import ChampionPrediction from "./views/ChampionPrediction";
import TeamCards from "./views/TeamCards";
import Charts from "./views/Charts";
import MatchReport from "./views/MatchReport";
import Gallery from "./views/Gallery";

type TabKey = "standings" | "scorers" | "knockout" | "prediction" | "teams" | "charts" | "report" | "gallery";

const TABS: { key: TabKey; label: string; icon: typeof Trophy }[] = [
  { key: "standings", label: "积分榜", icon: Shield },
  { key: "scorers", label: "射手榜", icon: Target },
  { key: "knockout", label: "淘汰赛", icon: Trophy },
  { key: "prediction", label: "预测", icon: Crown },
  { key: "teams", label: "球队", icon: Users },
  { key: "charts", label: "数据", icon: BarChart3 },
  { key: "report", label: "战报", icon: ScrollText },
  { key: "gallery", label: "精彩瞬间", icon: Camera },
];

export default function App() {
  const { data, loading, error, source, updatedAt, reload } = useWorldCup();
  const appLikes = useAppLikes();
  const { pref, setPref } = useTheme();
  const [tab, setTab] = useState<TabKey>("standings");

  const groups = useMemo(() => toGroupTables(data?.standings), [data?.standings]);
  const scorers = useMemo(() => toScorers(data?.scorers), [data?.scorers]);
  const matches = useMemo(() => splitMatches(data?.matches), [data?.matches]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const selectTab = (k: TabKey) => {
    setTab(k);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    // App-Shell：外壳固定为一屏高，仅内部容器滚动 —— 任何浏览器都不会"到底还能滚"
    <div className="flex h-[100dvh] flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
          {/* 顶部标题栏 */}
      <header className="flex items-center justify-between gap-2 py-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary-bright shadow-lg shadow-primary/30">
            <Trophy className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="whitespace-nowrap font-display text-xl font-bold leading-none text-ink sm:text-3xl">
              2026 世界杯战报
            </h1>
            <p className="mt-1 hidden text-[11px] tracking-wide text-muted sm:block">FIFA WORLD CUP 2026 · 美加墨 · 48 队</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle pref={pref} onChange={setPref} />
          {/* 点赞按钮 */}
          <button
            onClick={appLikes.likeApp}
            disabled={appLikes.liking}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2.5 transition-all active:scale-90",
              "h-9 sm:h-7", // 移动端匹配单按钮主题切换(h-9)，桌面端匹配三态按钮(h-7)
              appLikes.liked
                ? "border-red-500/30 bg-red-500/10 text-red-400"
                : "border-line/60 bg-surface/60 text-muted hover:border-red-400/40 hover:text-red-400",
            )}
            title={appLikes.liked ? "已点赞" : "点赞应用"}
          >
            <Heart
              className={cn("shrink-0 transition-transform", "h-4 w-4 sm:h-3.5 sm:w-3.5", appLikes.liking && "animate-ping")}
              fill={appLikes.liked ? "currentColor" : "none"}
            />
            <span className="text-[11px] font-semibold tabular-nums leading-none">{appLikes.likes}</span>
          </button>

          {/* 数据状态：移动端只显示圆点，桌面端显示文字+更新时间 */}
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                source === "live" ? "live-dot bg-pitch" : source === "supabase" ? "live-dot bg-emerald-500" : "bg-gold",
              )}
            />
            <div className="hidden text-right sm:block">
              <span
                className={cn(
                  "text-xs font-semibold",
                  source === "live" ? "text-pitch" : source === "supabase" ? "text-emerald-600" : "text-gold",
                )}
              >
                {source === "live" ? "实时数据" : source === "supabase" ? "数据库" : "快照数据"}
              </span>
              {updatedAt && (
                <div className="text-[10px] text-muted">更新于 {updatedAt.toLocaleTimeString("zh-CN")}</div>
              )}
            </div>
          </div>
          <button
            onClick={reload}
            disabled={loading}
            className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-surface/60 text-muted transition-colors hover:border-primary/50 hover:text-ink disabled:opacity-50"
            title="刷新"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </header>

      {/* 点赞引导（未点赞时显示，点击即点赞） */}
      {!appLikes.liked && (
        <button
          onClick={appLikes.likeApp}
          disabled={appLikes.liking}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.07] px-4 py-2.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/15 active:scale-[0.99] disabled:opacity-60"
        >
          <Heart className="h-3.5 w-3.5 shrink-0" fill="none" />
          如果对你有帮助，请点赞鼓励一下 ❤
        </button>
      )}

      {/* 快照模式提示 */}
      {source === "snapshot" && (
        <div className="mb-4 rounded-xl border border-gold/30 bg-gold/[0.07] px-4 py-2.5 text-xs text-gold/90">
          当前为<strong className="text-gold">快照数据</strong>（赛果与积分真实，但非实时）。在 Cloudflare Pages 环境变量中配置
          <code className="mx-1 rounded bg-black/30 px-1">FOOTBALL_DATA_TOKEN</code>
          即可切换为真·实时。
        </div>
      )}

      {/* 顶部 Tab 导航（桌面端） */}
      <nav className="sticky top-0 z-10 -mx-4 mb-6 hidden border-b border-line/60 bg-bg/80 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 md:block">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => selectTab(key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-semibold transition-colors",
                tab === key
                  ? "border-primary text-ink"
                  : "border-transparent text-muted hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* 内容区 */}
      {loading && !data ? (
        <Loader label="正在加载赛事数据…" />
      ) : error && !data ? (
        <div className="rounded-xl border border-primary/40 bg-primary/10 p-6 text-center text-sm text-primary-bright">
          数据加载失败：{error}
        </div>
      ) : (
        <main>
          {tab === "standings" && <GroupStandings groups={groups} matches={matches} />}
          {tab === "scorers" && <Scorers scorers={scorers} />}
          {tab === "knockout" && <KnockoutBracket groups={groups} matches={matches} />}
          {tab === "prediction" && <ChampionPrediction groups={groups} matches={matches.all} />}
          {tab === "teams" && <TeamCards groups={groups} matches={matches} scorers={scorers} />}
          {tab === "charts" && <Charts groups={groups} matches={matches} scorers={scorers} />}
          {tab === "report" && <MatchReport matches={matches} />}
          {tab === "gallery" && <Gallery />}
        </main>
      )}

          <footer className="mt-6 md:mt-12 border-t border-line/50 pt-5 text-center text-[11px] text-muted">
            数据源 football-data.org（竞赛 WC）· 自动每 60 秒刷新 · 仅供学习演示
          </footer>
        </div>
      </div>

      {/* 移动端底部导航栏：作为 App-Shell 的底栏（不再 fixed，避免任何越界滚动） */}
      <nav
        className="shrink-0 border-t border-line/70 bg-bg/95 backdrop-blur-lg md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => selectTab(key)}
                aria-label={label}
                className="relative flex flex-1 flex-col items-center gap-1 py-2.5"
              >
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
                <Icon className={cn("h-5 w-5 transition-colors", active ? "text-primary-bright" : "text-muted")} />
                <span className={cn("text-[10px] transition-colors", active ? "font-semibold text-ink" : "text-muted")}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
