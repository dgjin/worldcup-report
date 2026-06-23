import snapshot from "../../data/snapshot.json";

const SNAP = snapshot as Record<string, unknown> & { _meta: { asof: string } };

const FD_BASE = "https://api.football-data.org/v4/competitions/WC";

export type WcType = "standings" | "scorers" | "matches" | "teams";

const PATHS: Record<WcType, string> = {
  standings: "/standings",
  scorers: "/scorers?limit=30",
  matches: "/matches",
  teams: "/teams",
};

export async function getWcData(type: WcType, token?: string) {
  if (token) {
    try {
      const res = await fetch(FD_BASE + PATHS[type], { headers: { "X-Auth-Token": token } });
      if (res.ok) return { data: await res.json(), source: "live" as const };
    } catch {}
  }
  // 快照无球队名单数据，回退空列表
  const fallback = SNAP[type] ?? (type === "teams" ? { teams: [] } : null);
  return { data: fallback, source: "snapshot" as const };
}

export function toJson(data: unknown, source: "live" | "snapshot", maxAge?: number) {
  // 名单等慢变数据用长缓存（maxAge）；实时数据不缓存；快照短缓存
  const cacheControl =
    maxAge != null
      ? `public, max-age=${maxAge}`
      : source === "live"
        ? "no-store, no-cache, must-revalidate"
        : "public, max-age=3600";
  return new Response(JSON.stringify({
    ...(data as object),
    _source: source,
    _asOf: source === "snapshot" ? (SNAP._meta as any).asOf ?? (SNAP._meta as any).asof : new Date().toISOString(),
  }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": cacheControl,
      "X-Data-Source": source,
      "Pragma": source === "live" ? "no-cache" : "",
    },
  });
}
