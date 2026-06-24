import { createClient, writeWcData, writeWcMatches } from "../lib/supabase.js";
import type { MatchRaw } from "../../src/types/worldcup";

interface Env {
  FOOTBALL_DATA_TOKEN?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SYNC_SECRET?: string;
}

const FD_BASE = "https://api.football-data.org/v4/competitions/WC";

/** 从请求中提取并校验 SYNC_SECRET，未通过返回 401 Response，通过返回 null */
function checkSecret(ctx: { request: Request; env: Env }): Response | null {
  const url = new URL(ctx.request.url);
  const secret = url.searchParams.get("secret") ?? ctx.request.headers.get("X-Sync-Secret") ?? "";
  if (ctx.env.SYNC_SECRET && secret !== ctx.env.SYNC_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  return null;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const unauthorized = checkSecret(ctx);
  if (unauthorized) return unauthorized;

  const token = ctx.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ error: "No FOOTBALL_DATA_TOKEN configured" }), { status: 500 });
  }

  const sbUrl = ctx.env.SUPABASE_URL;
  const sbKey = ctx.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !sbKey) {
    return new Response(JSON.stringify({ error: "No Supabase credentials configured" }), { status: 500 });
  }

  const sb = createClient(sbUrl, sbKey);
  const results: Record<string, string> = {};

  // 同步所有 4 个端点
  const endpoints = [
    { type: "matches" as const, path: "/matches" },
    { type: "standings" as const, path: "/standings" },
    { type: "scorers" as const, path: "/scorers?limit=30" },
    { type: "teams" as const, path: "/teams" },
  ];

  for (const { type, path } of endpoints) {
    try {
      const res = await fetch(FD_BASE + path, {
        headers: { "X-Auth-Token": token },
      });
      if (!res.ok) {
        results[type] = `API returned ${res.status}`;
        continue;
      }
      const data = await res.json() as Record<string, unknown>;

      if (type === "matches" && data.matches) {
        const matches = data.matches as MatchRaw[];
        await writeWcMatches(sb, matches, "live");
        results[type] = `${matches.length} matches synced`;
      } else if (type !== "matches") {
        await writeWcData(sb, type, data, "live");
        const count = Array.isArray(data[type]) ? (data[type] as unknown[]).length : 0;
        results[type] = `${count} ${type} synced`;
      }
    } catch (e) {
      results[type] = `Error: ${(e as Error).message}`;
    }
  }

  return new Response(JSON.stringify({ ok: true, results, syncedAt: new Date().toISOString() }), {
    headers: { "Content-Type": "application/json" },
  });
};

// 也支持 GET（用于简单测试）
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const unauthorized = checkSecret(ctx);
  if (unauthorized) return unauthorized;

  const sbUrl = ctx.env.SUPABASE_URL;
  const sbKey = ctx.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !sbKey) {
    return new Response(JSON.stringify({ error: "Supabase not configured" }), { status: 500 });
  }
  const sb = createClient(sbUrl, sbKey);
  const { data: meta } = await sb.from("wc_sync_meta").select("*");
  return new Response(JSON.stringify({ syncMeta: meta }), {
    headers: { "Content-Type": "application/json" },
  });
};
