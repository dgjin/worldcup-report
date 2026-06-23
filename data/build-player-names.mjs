// 生成 球员id -> 简体中文名 映射。
// 数据源：football-data 阵容（id/拉丁名/生日） + 维基百科《2026年世界杯参赛球员名单》。
// 匹配键：出生日期 + 姓氏。中文名最后统一经 MediaWiki 转为简体（zh-cn）。
// 用法：node data/build-player-names.mjs   （需 .env 里的 FOOTBALL_DATA_TOKEN）
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(join(__dirname, "../.env"));
} catch {
  /* 无 .env */
}
const TOKEN = process.env.FOOTBALL_DATA_TOKEN;
if (!TOKEN) {
  console.error("缺 FOOTBALL_DATA_TOKEN（请配置 .env）");
  process.exit(1);
}

const UA = "worldcup-report/1.0 (https://worldcup-report.pages.dev; dgjin@qq.com) node-fetch";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) =>
  (s || "").normalize("NFD").toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
const hasCJK = (s) => /[一-鿿]/.test(s);
// 解析维基语言转换标记 -{zh-hans:X;zh-tw:Y;...}- / -{H|X}- / -{X}-，优先取简体
function resolveConv(s) {
  const m = s.match(/-\{([^}]*)\}-/);
  if (!m) return s;
  const inner = m[1];
  const hans = inner.match(/zh-(?:hans|cn):\s*([^;]+)/i);
  if (hans) return s.replace(m[0], hans[1].trim());
  const plain = inner.replace(/^[a-zA-Z-]+\|/, "").split(";")[0].replace(/^[a-zA-Z-]+:\s*/, "").trim();
  return s.replace(m[0], plain);
}

// 1) football-data 全部阵容
const fdRes = await fetch("https://api.football-data.org/v4/competitions/WC/teams", { headers: { "X-Auth-Token": TOKEN, "User-Agent": UA } });
if (!fdRes.ok) {
  console.error("football-data 请求失败:", fdRes.status);
  process.exit(1);
}
const fd = await fdRes.json();
const fdPlayers = [];
for (const t of fd.teams || []) for (const p of t.squad || []) fdPlayers.push({ id: p.id, name: p.name, dob: p.dateOfBirth });
console.log("football-data 球员:", fdPlayers.length);

// 2) 维基百科 wikitext
const PAGE = "2026%E5%B9%B4%E5%9C%8B%E9%9A%9B%E8%B6%B3%E5%8D%94%E4%B8%96%E7%95%8C%E7%9B%83%E5%8F%83%E8%B3%BD%E7%90%83%E5%93%A1%E5%90%8D%E5%96%AE";
const wt = (await (await fetch(`https://zh.wikipedia.org/w/api.php?action=parse&page=${PAGE}&prop=wikitext&format=json&formatversion=2`, { headers: { "User-Agent": UA } })).json()).parse.wikitext;

// 3) 解析球员模板行 -> {zh(原始,可能繁/含-{}-), surname, dob}
function cleanName(raw) {
  let s = resolveConv(raw.trim());
  const link = s.match(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/); // [[链接|显示]] 或 [[显示]]
  if (link) s = link[1].trim();
  return resolveConv(s).replace(/'''?/g, "").replace(/<ref.*$/i, "").trim();
}
const wiki = [];
for (const line of wt.split("\n")) {
  if (!/\bfs g? ?player\b/.test(line) && !line.includes("fs player")) continue;
  const nameM = line.match(/\|name=(.+?)\|(?:sortname|sort|sortvalue|age|caps|goals|club|pos|no|clubnat)=/i);
  const ageM = line.match(/birth date and age2?\s*\|([\d|\s]+)/i);
  if (!nameM || !ageM) continue;
  const nums = ageM[1].split("|").map((x) => parseInt(x.trim(), 10)).filter((n) => !Number.isNaN(n));
  let ymd;
  if (nums.length >= 6) ymd = nums.slice(3, 6);
  else if (nums.length >= 3) ymd = nums.slice(0, 3);
  else continue;
  const dob = `${ymd[0]}-${String(ymd[1]).padStart(2, "0")}-${String(ymd[2]).padStart(2, "0")}`;
  const zh = cleanName(nameM[1]);
  if (!zh) continue;
  const surname = (line.match(/sortname=([^|}]+)/)?.[1] || "").split(",")[0].trim();
  wiki.push({ zh, surname, dob });
}
console.log("维基球员:", wiki.length);

// 4) 按 dob 建索引并匹配（dob+姓氏唯一优先，其次 dob 唯一）
const byDob = new Map();
for (const w of wiki) (byDob.get(w.dob) ?? byDob.set(w.dob, []).get(w.dob)).push(w);

const raw = {}; // id -> 原始中文名（待转简体）
let bySurname = 0, byDobOnly = 0;
for (const p of fdPlayers) {
  const cands = byDob.get(p.dob);
  if (!cands?.length) continue;
  const fn = norm(p.name);
  const hits = cands.filter((c) => c.surname.length >= 3 && fn.includes(norm(c.surname)));
  let pick = null;
  if (hits.length === 1) (pick = hits[0]), bySurname++;
  else if (hits.length === 0 && cands.length === 1) (pick = cands[0]), byDobOnly++;
  if (pick) raw[p.id] = pick.zh;
}
console.log(`匹配: ${Object.keys(raw).length}/${fdPlayers.length}（姓氏+生日 ${bySurname}，仅生日 ${byDobOnly}）`);

// 5) 批量转简体（zh-cn），顺带把 -{}- 转换标记解析掉
async function convertChunk(chunk, attempt = 0) {
  const SEP = " @@@ ";
  const body = new URLSearchParams({
    action: "parse", format: "json", formatversion: "2", prop: "text",
    contentmodel: "wikitext", disablelimitreport: "1", variant: "zh-cn", text: chunk.join(SEP),
  });
  const res = await fetch("https://zh.wikipedia.org/w/api.php", {
    method: "POST", body, headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
  });
  const text = await res.text();
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    if (attempt < 4) {
      console.log(`  限流，等待重试…(${attempt + 1})`);
      await sleep(4000 * (attempt + 1));
      return convertChunk(chunk, attempt + 1);
    }
    return chunk; // 放弃转换，返回原文
  }
  const txt = (j.parse?.text || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&");
  const parts = txt.split("@@@").map((s) => s.trim());
  return chunk.map((orig, k) => (parts[k] && hasCJK(parts[k]) ? parts[k] : orig));
}

async function toSimplified(names) {
  const result = [];
  for (let i = 0; i < names.length; i += 200) {
    const out = await convertChunk(names.slice(i, i + 200));
    result.push(...out);
    await sleep(1500);
  }
  return result;
}

const ids = Object.keys(raw);
const simplified = await toSimplified(ids.map((id) => raw[id]));
const map = {};
ids.forEach((id, i) => {
  const zh = simplified[i];
  if (zh && hasCJK(zh)) map[id] = zh;
});

// 6) 写文件
const entries = Object.entries(map)
  .sort((a, b) => Number(a[0]) - Number(b[0]))
  .map(([id, zh]) => `  ${id}: ${JSON.stringify(zh)},`)
  .join("\n");
writeFileSync(
  join(__dirname, "../src/lib/player-names.generated.ts"),
  `// 自动生成：football-data 阵容 × 维基百科《2026年世界杯参赛球员名单》（出生日期+姓氏匹配，统一简体）
// 重新生成：node data/build-player-names.mjs
export const PLAYER_NAMES: Record<number, string> = {
${entries}
};
`,
);
console.log("已写 src/lib/player-names.generated.ts，共", Object.keys(map).length, "条");
