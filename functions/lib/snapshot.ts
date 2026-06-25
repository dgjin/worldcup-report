import snapshot from "../../data/snapshot.json";
import {
  createClient,
  readWcData,
  readWcMatches,
  writeWcData,
  writeWcMatches,
  type WcDataType,
} from "./supabase.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchRaw } from "../../src/types/worldcup";

const SNAP = snapshot as Record<string, unknown> & { _meta: { asOf?: string; asof?: string } };

const FD_BASE = "https://api.football-data.org/v4/competitions/WC";

const PATHS: Record<WcDataType, string> = {
  standings: "/standings",
  scorers: "/scorers?limit=30",
  matches: "/matches?dateFrom=2026-06-10&dateTo=2026-07-20",
  teams: "/teams",
};

export type DataSourceWithSupabase = "live" | "supabase" | "snapshot";

export interface SupabaseConfig {
  url: string;
  key: string;
}

/** fire-and-forget 写入 Supabase（不阻塞响应） */
function fireAndForget(sb: SupabaseClient, type: WcDataType, data: Record<string, unknown>): void {
  const source = "live";
  if (type === "matches" && data.matches) {
    writeWcMatches(sb, data.matches as MatchRaw[], source).catch(() => {});
  } else if (type !== "matches") {
    writeWcData(sb, type as "standings" | "scorers" | "teams", data, source).catch(() => {});
  }
}

export async function getWcData(
  type: WcDataType,
  token?: string,
  sbConfig?: SupabaseConfig,
) {
  // 1. 尝试 live API
  if (token) {
    try {
      const res = await fetch(FD_BASE + PATHS[type], {
        headers: { "X-Auth-Token": token },
      });
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        // fire-and-forget 写入 Supabase
        if (sbConfig) {
          try {
            const sb = createClient(sbConfig.url, sbConfig.key);
            fireAndForget(sb, type, data);
          } catch {
            // 写入失败不影响响应
          }
        }
        return { data, source: "live" as const };
      }
    } catch {}
  }

  // 2. live API 失败 → 尝试 Supabase
  if (sbConfig) {
    try {
      const sb = createClient(sbConfig.url, sbConfig.key);
      if (type === "matches") {
        const result = await readWcMatches(sb);
        if (result && result.matches.length > 0) {
          return { data: { matches: result.matches }, source: "supabase" as const };
        }
      } else {
        const result = await readWcData(sb, type as "standings" | "scorers" | "teams");
        if (result) {
          return { data: result.data, source: "supabase" as const };
        }
      }
    } catch {}
  }

  // 3. 最终兜底 → snapshot.json
  const fallback = SNAP[type] ?? (type === "teams" ? { teams: [] } : null);
  return { data: fallback, source: "snapshot" as const };
}

export function toJson(
  data: unknown,
  source: DataSourceWithSupabase,
  maxAge?: number,
) {
  const cacheControl =
    maxAge != null
      ? `public, max-age=${maxAge}`
      : source === "live"
        ? "no-store, no-cache, must-revalidate"
        : source === "supabase"
          ? "public, max-age=120, s-maxage=120"
          : "public, max-age=3600";
  return new Response(
    JSON.stringify({
      ...(data as object),
      _source: source,
      _asOf:
        source === "snapshot"
          ? (SNAP._meta.asOf ?? SNAP._meta.asof)
          : new Date().toISOString(),
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": cacheControl,
        "X-Data-Source": source,
        "Pragma": source === "live" ? "no-cache" : "",
      },
    },
  );
}
