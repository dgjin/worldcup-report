/**
 * Visits API — 访问计数
 *
 * GET  /api/app/visits  → { visits: number }
 * POST /api/app/visits  → 访问 +1，返回 { visits: number }
 *
 * 数据存储: Supabase gallery_likes 表（key = __visits__）
 */

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

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

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=15",
  };
  const sb = {
    SUPABASE_URL: ctx.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: ctx.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const KEY = "__visits__";

  try {
    if (ctx.request.method === "GET") {
      const rows = await sbFetch(sb, `gallery_likes?select=likes&photo_key=eq.${KEY}`);
      const visits = rows?.[0]?.likes ?? 0;
      return new Response(JSON.stringify({ visits }), { headers });
    }

    if (ctx.request.method === "POST") {
      const existing = await sbFetch(sb, `gallery_likes?select=likes&photo_key=eq.${KEY}`);
      const current = existing?.[0]?.likes ?? 0;

      if (existing?.length) {
        await sbFetch(sb, `gallery_likes?photo_key=eq.${KEY}`, {
          method: "PATCH",
          body: JSON.stringify({ likes: current + 1, updated_at: new Date().toISOString() }),
        });
      } else {
        await sbFetch(sb, "gallery_likes", {
          method: "POST",
          headers: { Prefer: "resolution=ignore-duplicates" },
          body: JSON.stringify({ photo_key: KEY, likes: 1, updated_at: new Date().toISOString() }),
        });
      }

      headers["Cache-Control"] = "no-store";
      return new Response(JSON.stringify({ visits: current + 1 }), { headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  } catch (e) {
    console.error("[app-visits]", (e as Error).message);
    if (ctx.request.method === "GET") {
      return new Response(JSON.stringify({ visits: 0 }), { headers });
    }
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
  }
};
