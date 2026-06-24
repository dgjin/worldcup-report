/**
 * 将 snapshot.json + goals.json 的数据种子到 Supabase
 *
 * 用法:
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node data/seed-supabase.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SB_URL = process.env.SUPABASE_URL?.trim();
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!SB_URL || !SB_KEY) {
  console.error("❌ 请设置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 环境变量");
  process.exit(1);
}

const sb = createClient(SB_URL, SB_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 读取 snapshot 和 goals
const snapshot = JSON.parse(readFileSync(join(__dirname, "snapshot.json"), "utf-8"));
const goalsRaw = JSON.parse(readFileSync(join(__dirname, "goals.json"), "utf-8"));

async function seed() {
  console.log("🌱 开始种子数据到 Supabase...\n");

  // 1. 种子 matches
  const matches = snapshot.matches?.matches || [];
  if (matches.length > 0) {
    // 将 goals.json 中的进球数据注入到对应比赛
    for (const m of matches) {
      if (m.status === "FINISHED" && !m.goals?.length) {
        // goals.json 的 key 格式为 "HomeTeam|AwayTeam"
        const key = `${m.homeTeam?.name}|${m.awayTeam?.name}`;
        if (goalsRaw[key]) {
          m.goals = goalsRaw[key];
        }
      }
    }

    const rows = matches.map((m) => ({
      id: m.id,
      data: m,
      home_team: m.homeTeam?.name ?? "",
      away_team: m.awayTeam?.name ?? "",
      status: m.status ?? "TIMED",
      utc_date: m.utcDate ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    // 分批 upsert（每批 50 条）
    const BATCH = 50;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await sb.from("wc_matches").upsert(batch, { onConflict: "id" });
      if (error) {
        console.error(`  ❌ matches 批次 ${Math.floor(i / BATCH) + 1} 写入失败:`, error.message);
      } else {
        console.log(`  ✅ matches 批次 ${Math.floor(i / BATCH) + 1} (${batch.length} 条)`);
      }
    }

    // 更新 sync_meta
    await sb.from("wc_sync_meta").upsert(
      { type: "matches", last_sync_at: new Date().toISOString(), source: "snapshot" },
      { onConflict: "type" },
    );
    console.log(`  📊 共 ${matches.length} 场比赛，含 ${matches.filter((m) => m.goals?.length).length} 场进球数据\n`);
  }

  // 2. 种子 standings / scorers / teams
  const blobTypes = ["standings", "scorers", "teams"];
  for (const type of blobTypes) {
    const data = snapshot[type];
    if (!data) {
      console.log(`  ⏭️  ${type} 无数据，跳过`);
      continue;
    }
    const { error } = await sb.from("wc_data").upsert(
      { type, data, source: "snapshot", updated_at: new Date().toISOString() },
      { onConflict: "type" },
    );
    if (error) {
      console.error(`  ❌ ${type} 写入失败:`, error.message);
    } else {
      console.log(`  ✅ ${type}`);
    }
    // 更新 sync_meta
    await sb.from("wc_sync_meta").upsert(
      { type, last_sync_at: new Date().toISOString(), source: "snapshot" },
      { onConflict: "type" },
    );
  }

  console.log("\n🎉 种子数据完成！");
}

seed().catch((e) => {
  console.error("种子失败:", e);
  process.exit(1);
});
