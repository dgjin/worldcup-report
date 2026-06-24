/**
 * Cloudflare Worker: 定时同步世界杯数据到 Supabase
 * 每 5 分钟由 cron trigger 触发，调用 Pages 的 /api/wc/sync 端点
 */
export default {
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    const syncUrl = env.SYNC_URL;
    const syncSecret = env.SYNC_SECRET ?? "";

    if (!syncUrl) {
      console.error("SYNC_URL not configured");
      return;
    }

    try {
      const url = new URL(syncUrl);
      if (syncSecret) url.searchParams.set("secret", syncSecret);

      const res = await fetch(url.toString(), {
        method: "POST",
        headers: syncSecret ? { "X-Sync-Secret": syncSecret } : {},
      });

      const data = await res.json() as any;
      console.log(`[sync] ${res.status}`, JSON.stringify(data.results ?? data));
    } catch (e) {
      console.error("[sync] failed:", (e as Error).message);
    }
  },
};

interface Env {
  SYNC_URL: string;
  SYNC_SECRET?: string;
}