import { useCallback, useEffect, useRef, useState } from "react";
import type { DataSource, MatchesResponse, ScorersResponse, StandingsResponse } from "../types/worldcup";

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const sep = url.includes("?") ? "&" : "?";
  const bust = `${sep}_t=${Date.now()}`;
  const res = await fetch(url + bust, { cache: "no-store", signal });
  if (!res.ok) throw new Error(`${url} 返回 ${res.status}`);
  return (await res.json()) as T;
}

export interface WorldCupData {
  standings: StandingsResponse;
  scorers: ScorersResponse;
  matches: MatchesResponse;
}

export interface WorldCupState {
  data: WorldCupData | null;
  loading: boolean;
  error: string | null;
  source: DataSource | null;
  updatedAt: Date | null;
  reload: () => void;
}

/** 根据比赛状态计算自适应轮询间隔 */
function getAdaptiveInterval(matches: MatchesResponse | undefined): number {
  if (!matches?.matches?.length) return 60_000;

  const now = Date.now();
  let hasLive = false;
  let latestFinishMs = 0;

  for (const m of matches.matches) {
    const status = m.status;
    if (status === "IN_PLAY" || status === "PAUSED") {
      hasLive = true;
    } else if (status === "FINISHED") {
      const t = new Date(m.utcDate).getTime();
      if (t > latestFinishMs) latestFinishMs = t;
    }
  }

  // 有比赛正在进行 → 15 秒高频刷新
  if (hasLive) return 15_000;

  // 最近 10 分钟内有比赛结束 → 30 秒快速确认
  if (latestFinishMs > 0 && (now - latestFinishMs) < 10 * 60 * 1000) return 30_000;

  // 空闲 → 60 秒
  return 60_000;
}

/** 同时拉取三个端点，自适应轮询：比赛进行中 15s，刚完赛 30s，空闲 60s */
export function useWorldCup(): WorldCupState {
  const [data, setData] = useState<WorldCupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const inFlight = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  // 保存最新数据引用，供自适应间隔计算使用（避免 effect 依赖 data 导致重建定时器）
  const matchesRef = useRef<MatchesResponse | undefined>(undefined);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const [standings, scorers, matches] = await Promise.all([
        fetchJson<StandingsResponse>("/api/wc/standings", ac.signal),
        fetchJson<ScorersResponse>("/api/wc/scorers", ac.signal),
        fetchJson<MatchesResponse>("/api/wc/matches", ac.signal),
      ]);
      setData({ standings, scorers, matches });
      setUpdatedAt(new Date());
      setError(null);
      matchesRef.current = matches;
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
      }
    } finally {
      inFlight.current = false;
      if (abortRef.current === ac) abortRef.current = null;
      setLoading(false);
    }
  }, []);

  // 自适应轮询：用递归 setTimeout 替代固定 setInterval
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const scheduleNext = () => {
      if (stopped) return;
      const nextMs = getAdaptiveInterval(matchesRef.current);
      timer = setTimeout(async () => {
        if (stopped) return;
        if (document.visibilityState === "visible") {
          await load();
        }
        scheduleNext();
      }, nextMs);
    };

    // 首次加载后启动轮询
    load().then(() => {
      if (!stopped) scheduleNext();
    });

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [load]);

  return {
    data,
    loading,
    error,
    source: data?.standings._source ?? null,
    updatedAt,
    reload: load,
  };
}
