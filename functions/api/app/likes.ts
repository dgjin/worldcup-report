/**
 * App Likes API — 应用点赞
 *
 * GET  /api/app/likes  → { likes: number }
 * POST /api/app/likes  → 点赞 +1，返回 { likes: number }
 *
 * 数据存储: Supabase app_likes 表（单行，id=1）
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
    "Cache-Control": "public, max-age=10",
  };
  const sb = {
    SUPABASE_URL: ctx.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: ctx.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  try {
    if (ctx.request.method === "GET") {
      const rows = await sbFetch(sb, "app_likes?select=likes&id=eq.1");
      const likes = rows?.[0]?.likes ?? 0;
      return new Response(JSON.stringify({ likes }), { headers });
    }

    if (ctx.request.method === "POST") {
      // 先查当前值
      const existing = await sbFetch(sb, "app_likes?select=likes&id=eq.1");
      const currentLikes = existing?.[0]?.likes ?? 0;

      if (existing?.length) {
        // 更新
        await sbFetch(sb, "app_likes?id=eq.1", {
          method: "PATCH",
          body: JSON.stringify({ likes: currentLikes + 1 }),
        });
      } else {
        // 插入初始行
        await sbFetch(sb, "app_likes", {
          method: "POST",
          body: JSON.stringify({ id: 1, likes: 1 }),
        });
      }

      headers["Cache-Control"] = "no-store";
      return new Response(JSON.stringify({ likes: currentLikes + 1 }), { headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  } catch (e) {
    console.error("[app-likes]", (e as Error).message);
    if (ctx.request.method === "GET") {
      return new Response(JSON.stringify({ likes: 0 }), { headers });
    }
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
  }
};
