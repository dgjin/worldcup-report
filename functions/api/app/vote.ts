/**
 * Champion Vote API — 用户投票冠军/亚军/季军
 *
 * GET  /api/app/vote  → { champion: {team: count}, runnerup: {...}, thirdplace: {...}, total: number }
 * POST /api/app/vote  → 提交投票 { champion, runnerup, thirdplace } → { ok: true, total: number }
 *
 * 数据存储: Supabase gallery_likes 表（复用），键格式: vote_{category}_{teamZh}
 * 防重复投票: 前端 localStorage 记录
 */

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

type VoteCategory = "champion" | "runnerup" | "thirdplace";
const CATEGORIES: VoteCategory[] = ["champion", "runnerup", "thirdplace"];

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

/** 从 gallery_likes 读取所有投票数据 */
async function readVotes(env: Env): Promise<Record<VoteCategory, Record<string, number>>> {
  const result: Record<VoteCategory, Record<string, number>> = {
    champion: {},
    runnerup: {},
    thirdplace: {},
  };

  try {
    // 读取所有 vote_ 前缀的行
    const rows = await sbFetch(env, `gallery_likes?select=photo_key,likes&photo_key=like.vote_*`);
    for (const row of rows ?? []) {
      const parts = row.photo_key.split("_"); // vote_champion_阿根廷 → ["vote", "champion", "阿根廷"]
      if (parts.length < 3) continue;
      const cat = parts[1] as VoteCategory;
      const team = parts.slice(2).join("_");
      if (CATEGORIES.includes(cat)) {
        result[cat][team] = row.likes;
      }
    }
  } catch {
    // Supabase 未配置或出错，返回空
  }

  return result;
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const sb = {
    SUPABASE_URL: ctx.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: ctx.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  try {
    if (ctx.request.method === "GET") {
      const votes = await readVotes(sb);
      const total = Object.values(votes).reduce(
        (sum, cat) => sum + Object.values(cat).reduce((s, v) => s + v, 0),
        0,
      );
      headers["Cache-Control"] = "public, max-age=15";
      return new Response(JSON.stringify({ ...votes, total }), { headers });
    }

    if (ctx.request.method === "POST") {
      const body = await ctx.request.json() as {
        champion?: string;
        runnerup?: string;
        thirdplace?: string;
      };

      const picks: { cat: VoteCategory; team: string }[] = [];
      for (const cat of CATEGORIES) {
        const team = body[cat]?.trim();
        if (team) picks.push({ cat, team });
      }

      if (picks.length === 0) {
        return new Response(JSON.stringify({ error: "请至少选择一个名次" }), { status: 400, headers });
      }

      // 为每个选择 +1 票
      for (const { cat, team } of picks) {
        const key = `vote_${cat}_${team}`;
        try {
          const existing = await sbFetch(sb, `gallery_likes?select=likes&photo_key=eq.${encodeURIComponent(key)}`);
          const current = existing?.[0]?.likes ?? 0;

          if (existing?.length) {
            await sbFetch(sb, `gallery_likes?photo_key=eq.${encodeURIComponent(key)}`, {
              method: "PATCH",
              body: JSON.stringify({ likes: current + 1, updated_at: new Date().toISOString() }),
            });
          } else {
            await sbFetch(sb, "gallery_likes", {
              method: "POST",
              headers: { Prefer: "resolution=ignore-duplicates" },
              body: JSON.stringify({ photo_key: key, likes: 1, updated_at: new Date().toISOString() }),
            });
          }
        } catch {
          // 单条失败不影响其他
        }
      }

      // 返回最新投票数据
      const votes = await readVotes(sb);
      const total = Object.values(votes).reduce(
        (sum, cat) => sum + Object.values(cat).reduce((s, v) => s + v, 0),
        0,
      );
      headers["Cache-Control"] = "no-store";
      return new Response(JSON.stringify({ ok: true, ...votes, total }), { headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  } catch (e) {
    console.error("[vote]", (e as Error).message);
    if (ctx.request.method === "GET") {
      return new Response(JSON.stringify({ champion: {}, runnerup: {}, thirdplace: {}, total: 0 }), { headers });
    }
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
  }
};
