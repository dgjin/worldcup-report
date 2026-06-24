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

/** 同时拉取三个端点，可见时每 intervalMs 自动轮询，并暴露手动刷新 */
export function useWorldCup(intervalMs = 60_000): WorldCupState {
  const [data, setData] = useState<WorldCupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const inFlight = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    // 取消上一次未完成的请求
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
    } catch (e) {
      // abort 引起的错误不算失败
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
      }
    } finally {
      inFlight.current = false;
      if (abortRef.current === ac) abortRef.current = null;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, intervalMs);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [load, intervalMs]);

  return {
    data,
    loading,
    error,
    source: data?.standings._source ?? null,
    updatedAt,
    reload: load,
  };
}
