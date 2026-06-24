import { useMemo, useRef, useState } from "react";
import { BarChart3, Camera, RefreshCw, ScrollText, Shield, Target, Trophy, Users } from "lucide-react";
import { useWorldCup } from "./api/client";
import { splitMatches, toGroupTables, toScorers } from "./lib/transform";
import { cn } from "./components/ui";
import { Loader } from "./components/ui";
import GroupStandings from "./views/GroupStandings";
import Scorers from "./views/Scorers";
import KnockoutBracket from "./views/KnockoutBracket";
import TeamCards from "./views/TeamCards";
import Charts from "./views/Charts";
import MatchReport from "./views/MatchReport";
import Gallery from "./views/Gallery";

type TabKey = "standings" | "scorers" | "knockout" | "teams" | "charts" | "report" | "gallery";

const TABS: { key: TabKey; label: string; icon: typeof Trophy }[] = [
  { key: "standings", label: "积分榜", icon: Shield },
  { key: "scorers", label: "射手榜", icon: Target },
  { key: "knockout", label: "淘汰赛", icon: Trophy },
  { key: "teams", label: "球队", icon: Users },
  { key: "charts", label: "数据", icon: BarChart3 },
  { key: "report", label: "战报", icon: ScrollText },
  { key: "gallery", label: "精彩瞬间", icon: Camera },
];

export default function App() {
  const { data, loading, error, source, updatedAt, reload } = useWorldCup();
  const [tab, setTab] = useState<TabKey>("standings");

  const groups = useMemo(() => toGroupTables(data?.standings), [data]);
  const scorers = useMemo(() => toScorers(data?.scorers), [data]);
  const matches = useMemo(() => splitMatches(data?.matches), [data]);

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
            <h1 className="font-display text-xl font-bold leading-none text-ink sm:text-3xl">
              2026 世界杯战报
            </h1>
            <p className="mt-1 text-[11px] tracking-wide text-muted">FIFA WORLD CUP 2026 · 美加墨 · 48 队</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5">
              {source === "live" ? (
                <>
                  <span className="live-dot h-2 w-2 rounded-full bg-pitch" />
                  <span className="text-xs font-semibold text-pitch">实时数据</span>
                </>
              ) : source === "supabase" ? (
                <>
                  <span className="live-dot h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-emerald-600">数据库</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-gold" />
                  <span className="text-xs font-semibold text-gold">快照数据</span>
                </>
              )}
            </div>
            {updatedAt && (
              <div className="text-[10px] text-muted">更新于 {updatedAt.toLocaleTimeString("zh-CN")}</div>
            )}
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
