/**
 * Gallery Likes API — 照片点赞
 * 
 * GET  /api/wc/gallery/likes          → 返回所有照片的点赞数 { [photoKey]: likes }
 * POST /api/wc/gallery/likes          → 点赞照片 body: { photoKey: string }
 * 
 * 数据存储: Supabase gallery_likes 表
 */

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

// Supabase REST 请求
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
  const headers = { "Content-Type": "application/json", "Cache-Control": "public, max-age=30" };
  const sb = { SUPABASE_URL: ctx.env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: ctx.env.SUPABASE_SERVICE_ROLE_KEY };

  try {
    if (ctx.request.method === "GET") {
      // 返回所有点赞数
      const rows = await sbFetch(sb, "gallery_likes?select=photo_key,likes");
      const map: Record<string, number> = {};
      for (const r of (rows ?? [])) {
        map[r.photo_key] = r.likes;
      }
      return new Response(JSON.stringify(map), { headers });
    }

    if (ctx.request.method === "POST") {
      const body = await ctx.request.json() as { photoKey: string };
      const pk = body.photoKey;
      if (!pk) return new Response(JSON.stringify({ error: "缺少 photoKey" }), { status: 400, headers });

      // Upsert: 尝试更新 +1，不存在则插入
      // 先查当前值
      const existing = await sbFetch(sb, `gallery_likes?photo_key=eq.${encodeURIComponent(pk)}&select=likes`);
      const currentLikes = existing?.[0]?.likes ?? 0;

      await sbFetch(sb, "gallery_likes", {
        method: existing?.length ? "PATCH" : "POST",
        body: JSON.stringify(existing?.length
          ? { likes: currentLikes + 1 }
          : { photo_key: pk, likes: 1 }
        ),
        headers: existing?.length
          ? {}
          : { "Prefer": "resolution=ignore-duplicates" },
      });

      headers["Cache-Control"] = "no-store";
      return new Response(JSON.stringify({ photoKey: pk, likes: currentLikes + 1 }), { headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  } catch (e) {
    console.error("[gallery-likes]", (e as Error).message);
    // 表不存在时返回空数据，不阻断前端
    if (ctx.request.method === "GET") {
      return new Response(JSON.stringify({}), { headers });
    }
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
  }
};
