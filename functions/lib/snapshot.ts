import snapshot from "../../data/snapshot.json";
import {
  createClient,
  readWcData,
  readWcMatches,
  writeWcData,
  writeWcMatches,
  injectSupabaseGoals,
  type WcDataType,
} from "./supabase.js";
import type { SupabaseClient } from "@supabase/supabase-js";

const SNAP = snapshot as Record<string, unknown> & { _meta: { asof: string } };

const FD_BASE = "https://api.football-data.org/v4/competitions/WC";

const PATHS: Record<WcDataType, string> = {
  standings: "/standings",
  scorers: "/scorers?limit=30",
  matches: "/matches",
  teams: "/teams",
};

export type DataSourceWithSupabase = "live" | "supabase" | "snapshot";

export interface SupabaseConfig {
  url: string;
  key: string;
}

/** fire-and-forget 写入 Supabase（不阻塞响应） */
function fireAndForget(sb: SupabaseClient, type: WcDataType, data: any): void {
  const source = "live";
  if (type === "matches" && data.matches) {
    writeWcMatches(sb, data.matches, source).catch(() => {});
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
        const data = await res.json();
        // 对 matches 端点用 Supabase goals 数据富化
        if (type === "matches" && data.matches && sbConfig) {
          try {
            const sb = createClient(sbConfig.url, sbConfig.key);
            await injectSupabaseGoals(sb, data.matches);
          } catch {
            // Supabase goals 注入失败不影响响应
          }
        }
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
          ? (SNAP._meta as any).asOf ?? (SNAP._meta as any).asof
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
