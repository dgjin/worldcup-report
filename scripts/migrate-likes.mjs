/**
 * 创建 gallery_likes 表（照片点赞）
 * 用法：node scripts/migrate-likes.mjs
 */
import pg from "pg";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function readEnvFile() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return {};
  const map = {};
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    map[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return map;
}

async function tryConnect(url, label) {
  console.log(`  尝试: ${label}...`);
  const pool = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 8000 });
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    console.log(`  ✅ 连接成功！`);
    return pool;
  } catch (e) {
    console.log(`  ❌ ${e.message.slice(0, 80)}`);
    await pool.end().catch(() => {});
    return null;
  }
}

async function main() {
  const env = readEnvFile();
  const url = env.SUPABASE_URL ?? "";
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!url || !key) {
    console.error("❌ 未找到 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const ref = url.match(/\/\/(.+)\.supabase/)?.[1] ?? "";
  console.log(`📍 项目: ${ref}`);

  const SQL = `CREATE TABLE IF NOT EXISTS gallery_likes (
  photo_key   text PRIMARY KEY,
  likes       integer NOT NULL DEFAULT 0,
  updated_at  timestamptz DEFAULT now()
);
ALTER TABLE gallery_likes ENABLE ROW LEVEL SECURITY;`;

  const candidates = [
    {
      url: `postgresql://postgres.${ref}:${encodeURIComponent(key)}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`,
      label: "Pooler (transaction mode)",
    },
    {
      url: `postgresql://postgres.${ref}:${encodeURIComponent(key)}@aws-0-us-west-1.pooler.supabase.com:5432/postgres`,
      label: "Pooler (session mode)",
    },
    {
      url: `postgresql://postgres:${encodeURIComponent(key)}@db.${ref}.supabase.co:5432/postgres`,
      label: "Direct connection",
    },
  ];

  let pool = null;
  for (const c of candidates) {
    pool = await tryConnect(c.url, c.label);
    if (pool) break;
  }

  if (pool) {
    try {
      await pool.query(SQL);
      console.log("\n✅ gallery_likes 表创建成功！");
    } catch (e) {
      console.error("\n❌ 建表失败:", e.message);
    }
    await pool.end();
  } else {
    console.log("\n⚠️  无法自动连接数据库。");
    console.log("请在 Supabase Dashboard SQL Editor 中执行以下 SQL：");
    console.log(`\n${"=".repeat(50)}`);
    console.log(SQL);
    console.log("=".repeat(50));
    console.log(`\n📍 Dashboard: https://supabase.com/dashboard/project/${ref}/sql/new`);
  }
}

main();
