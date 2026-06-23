import { useCallback, useEffect, useRef, useState } from "react";
import type { DataSource, MatchesResponse, ScorersResponse, StandingsResponse } from "../types/worldcup";

async function fetchJson<T>(url: string): Promise<T> {
  const sep = url.includes("?") ? "&" : "?";
  const bust = `${sep}_t=${Date.now()}`;
  const res = await fetch(url + bust, { cache: "no-store" });
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

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const [standings, scorers, matches] = await Promise.all([
        fetchJson<StandingsResponse>("/api/wc/standings"),
        fetchJson<ScorersResponse>("/api/wc/scorers"),
        fetchJson<MatchesResponse>("/api/wc/matches"),
      ]);
      setData({ standings, scorers, matches });
      setUpdatedAt(new Date());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, intervalMs);
    return () => clearInterval(id);
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
