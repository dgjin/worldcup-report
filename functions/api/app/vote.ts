/**
 * Champion Vote API — 用户投票冠军/亚军/季军
 *
 * GET  /api/app/vote            → 聚合投票结果 { champion, runnerup, thirdplace, total, voters }
 * GET  /api/app/vote?email=xxx  → 额外返回该邮箱的投票记录 { ...aggregate, myRecord }
 * POST /api/app/vote            → 提交投票 { champion, runnerup, thirdplace, email?, name? }
 *
 * 数据存储:
 *   - 聚合计数: gallery_likes 表，键格式 vote_{category}_{teamZh}
 *   - 个人记录: wc_data 表，type=vote_record_{id}，data=JSONB{email,name,champion,runnerup,thirdplace,ts}
 * 防重复投票: 前端 localStorage 记录
 */

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  /** 查看投票详情的密码（未配置则关闭详情查看入口） */
  VOTE_DETAIL_PASSWORD?: string;
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

/** 从 gallery_likes 读取聚合计数 */
async function readAggregate(env: Env): Promise<Record<VoteCategory, Record<string, number>>> {
  const result: Record<VoteCategory, Record<string, number>> = {
    champion: {},
    runnerup: {},
    thirdplace: {},
  };
  try {
    const rows = await sbFetch(env, `gallery_likes?select=photo_key,likes&photo_key=like.vote_*`);
    for (const row of rows ?? []) {
      const parts = row.photo_key.split("_");
      if (parts.length < 3) continue;
      const cat = parts[1] as VoteCategory;
      const team = parts.slice(2).join("_");
      if (CATEGORIES.includes(cat)) {
        result[cat][team] = row.likes;
      }
    }
  } catch { /* empty */ }
  return result;
}

/** 读取个人投票记录数 */
async function countVoteRecords(env: Env): Promise<number> {
  try {
    const rows = await sbFetch(env, `wc_data?select=type&type=like.vote_record_*`);
    return rows?.length ?? 0;
  } catch {
    return 0;
  }
}

/** 读取全部个人投票记录（投票详情，需密码） */
async function readAllRecords(env: Env): Promise<any[]> {
  try {
    const rows = await sbFetch(env, `wc_data?select=data&type=like.vote_record_*`);
    return (rows ?? [])
      .map((r: any) => r.data)
      .filter(Boolean)
      .sort((a: any, b: any) => String(b?.ts ?? "").localeCompare(String(a?.ts ?? "")));
  } catch {
    return [];
  }
}

/** 按邮箱查找个人投票记录 */
async function findVoteByEmail(env: Env, email: string): Promise<any | null> {
  try {
    // PostgREST 不支持 JSONB 直接查询，先取所有记录再过滤
    const rows = await sbFetch(env, `wc_data?select=data&type=like.vote_record_*`);
    for (const row of rows ?? []) {
      if (row.data?.email?.toLowerCase() === email.toLowerCase()) {
        return row.data;
      }
    }
  } catch { /* empty */ }
  return null;
}

/** 生成唯一 ID */
function genId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
      const url = new URL(ctx.request.url);
      const email = url.searchParams.get("email")?.trim();

      const aggregate = await readAggregate(sb);
      const total = Object.values(aggregate).reduce(
        (sum, cat) => sum + Object.values(cat).reduce((s, v) => s + v, 0),
        0,
      );
      const voters = await countVoteRecords(sb);

      const result: Record<string, unknown> = { ...aggregate, total, voters };

      // 如果提供了 email，查找该用户的投票记录
      if (email) {
        result.myRecord = await findVoteByEmail(sb, email);
      }

      // 投票详情（需密码）：?detail=密码
      const detail = url.searchParams.get("detail");
      if (detail != null) {
        const pw = ctx.env.VOTE_DETAIL_PASSWORD;
        if (!pw || detail !== pw) {
          return new Response(JSON.stringify({ error: "密码错误" }), { status: 403, headers });
        }
        result.records = await readAllRecords(sb);
        headers["Cache-Control"] = "no-store";
        return new Response(JSON.stringify(result), { headers });
      }

      headers["Cache-Control"] = "public, max-age=15";
      return new Response(JSON.stringify(result), { headers });
    }

    if (ctx.request.method === "POST") {
      const body = await ctx.request.json() as {
        champion?: string;
        runnerup?: string;
        thirdplace?: string;
        email?: string;
        name?: string;
      };

      const picks: { cat: VoteCategory; team: string }[] = [];
      for (const cat of CATEGORIES) {
        const team = body[cat]?.trim();
        if (team) picks.push({ cat, team });
      }

      if (picks.length === 0) {
        return new Response(JSON.stringify({ error: "请至少选择一个名次" }), { status: 400, headers });
      }

      const email = body.email?.trim() || "";
      const name = body.name?.trim() || "";

      // 1. 存入个人投票记录到 wc_data
      const recordId = `vote_record_${genId()}`;
      const recordData = {
        email,
        name,
        champion: body.champion?.trim() || "",
        runnerup: body.runnerup?.trim() || "",
        thirdplace: body.thirdplace?.trim() || "",
        ts: new Date().toISOString(),
      };
      try {
        await sbFetch(sb, "wc_data", {
          method: "POST",
          body: JSON.stringify({
            type: recordId,
            data: recordData,
            source: "user",
            updated_at: new Date().toISOString(),
          }),
        });
      } catch (e) {
        console.error("[vote] record save failed:", (e as Error).message);
        // 记录保存失败不影响聚合计数
      }

      // 2. 更新聚合计数到 gallery_likes
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
        } catch { /* 单条失败不影响其他 */ }
      }

      // 3. 返回最新聚合数据
      const aggregate = await readAggregate(sb);
      const total = Object.values(aggregate).reduce(
        (sum, cat) => sum + Object.values(cat).reduce((s, v) => s + v, 0),
        0,
      );
      const voters = await countVoteRecords(sb);

      headers["Cache-Control"] = "no-store";
      return new Response(JSON.stringify({ ok: true, ...aggregate, total, voters, record: recordData }), { headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  } catch (e) {
    console.error("[vote]", (e as Error).message);
    if (ctx.request.method === "GET") {
      return new Response(JSON.stringify({ champion: {}, runnerup: {}, thirdplace: {}, total: 0, voters: 0 }), { headers });
    }
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
  }
};
