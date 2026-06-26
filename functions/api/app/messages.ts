/**
 * Fan Talk API — 球迷交流区留言
 *
 * GET  /api/app/messages?limit=60  → { messages: [{ id, nickname, content, ts }] }（按时间倒序）
 * POST /api/app/messages           → 发表留言 { content, nickname?, anonymous? }
 *
 * 数据存储: 复用 wc_data 表，type="msg_{时间戳}_{随机}"，data=JSONB{ nickname, content, ts }
 *   —— 与冠军投票记录相同的模式，PostgREST 直接读写，无需额外建表
 */

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

const MAX_LEN = 140;
const MAX_NICK = 24;
const DEFAULT_LIMIT = 60;

async function sbFetch(env: Env, path: string, options: RequestInit = {}): Promise<any> {
  const base = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Supabase not configured");

  const res = await fetch(`${base}/rest/v1/${path}`, {
    ...options,
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${res.status}: ${err.slice(0, 200)}`);
  }
  const ct = res.headers.get("content-type") ?? "";
  return ct.includes("json") ? res.json() : null;
}

interface Row { type: string; data?: { nickname?: string; content?: string; ts?: string } }

function toMessage(row: Row) {
  return {
    id: row.type,
    nickname: (row.data?.nickname ?? "").trim(),
    content: row.data?.content ?? "",
    ts: row.data?.ts ?? "",
  };
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const sb = {
    SUPABASE_URL: ctx.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: ctx.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  try {
    if (ctx.request.method === "GET") {
      const url = new URL(ctx.request.url);
      const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "", 10) || DEFAULT_LIMIT, 1), 100);
      // type 形如 msg_{Date.now()}_{rand}，Date.now() 定长 → 字典序即时间序，desc 取最新
      const rows = await sbFetch(sb, `wc_data?select=type,data&type=like.msg_*&order=type.desc&limit=${limit}`);
      const messages = (rows ?? []).map(toMessage);
      headers["Cache-Control"] = "public, max-age=10";
      return new Response(JSON.stringify({ messages }), { headers });
    }

    if (ctx.request.method === "POST") {
      const body = await ctx.request.json() as { content?: string; nickname?: string; anonymous?: boolean };
      const content = (body.content ?? "").trim().slice(0, MAX_LEN);
      if (!content) {
        return new Response(JSON.stringify({ error: "留言内容不能为空" }), { status: 400, headers });
      }
      const nickname = body.anonymous ? "" : (body.nickname ?? "").trim().slice(0, MAX_NICK);
      const ts = new Date().toISOString();
      const type = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const data = { nickname, content, ts };

      await sbFetch(sb, "wc_data", {
        method: "POST",
        body: JSON.stringify({ type, data, source: "user", updated_at: ts }),
      });

      headers["Cache-Control"] = "no-store";
      return new Response(JSON.stringify({ ok: true, message: { id: type, nickname, content, ts } }), { headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  } catch (e) {
    console.error("[messages]", (e as Error).message);
    if (ctx.request.method === "GET") {
      return new Response(JSON.stringify({ messages: [] }), { headers });
    }
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
  }
};
