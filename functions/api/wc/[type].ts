import { getWcData, toJson } from "../../lib/snapshot.js";
import type { WcDataType } from "../../lib/supabase.js";

interface Env {
  FOOTBALL_DATA_TOKEN?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

const VALID_TYPES: ReadonlySet<WcDataType> = new Set(["standings", "scorers", "matches", "teams"]);

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const type = ctx.params.type as string;
  if (!VALID_TYPES.has(type as WcDataType)) {
    return new Response("Not Found", { status: 404 });
  }
  const token = ctx.env.FOOTBALL_DATA_TOKEN ?? "";
  const sbConfig =
    ctx.env.SUPABASE_URL && ctx.env.SUPABASE_SERVICE_ROLE_KEY
      ? { url: ctx.env.SUPABASE_URL, key: ctx.env.SUPABASE_SERVICE_ROLE_KEY }
      : undefined;
  const { data, source } = await getWcData(type as WcDataType, token, sbConfig);
  if (!data) return new Response(JSON.stringify({ error: "No data" }), { status: 502 });
  // 名单数据慢变，给 6 小时缓存，减少对免费档限流的压力
  return toJson(data, source, type === "teams" ? 21600 : undefined);
};
