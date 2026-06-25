/**
 * 每日世界杯照片收集脚本
 * 从多个来源抓取最新比赛照片，保存为本地 JSON 缓存
 * 数据源: ABC News + USA Today + AP News
 * 用法：node scripts/collect-gallery.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const OUTPUT = join(DATA_DIR, "gallery-collected.json");

const ABC_URL =
  "https://abcnews.go.com/Sports/photos/best-photos-fifa-world-cup-2026-133075564";

const USATODAY_URL =
  "https://www.usatoday.com/picture-gallery/sports/soccer/worldcup/2026/06/13/world-cup-2026-best-photos/90528304007/";

const APNEWS_URLS = [
  "https://apnews.com/photo-gallery/photos-soccer-world-cup-shakira-opening-ceremony-608e920d1bf477e7aa544fd2b139331e",
  "https://apnews.com/photo-gallery/photos-brazil-morocco-haiti-metlife-qatar-world-cup-ba66730f4a4b4e341942397a6d512c8c",
  "https://apnews.com/photo-gallery/world-cup-photos-soccer-5dee70b837032094e659a0f0a13a8dfe",
  "https://apnews.com/photo-gallery/world-cup-photos-soccer-usmnt-australia-brazil-haiti-4eb587ca785841b2a1328d8b894faf88",
  "https://apnews.com/photo-gallery/photos-cohosts-us-canada-opener-bosnia-wcup-edc7934c9330443e0f624dbb0b039d7e",
];

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

const SOURCE_MAP = {
  gty: "Getty Images",
  rt: "Reuters",
  ap: "Associated Press",
};

async function collectAbcNews() {
  console.log("  [ABC News] 抓取中...");
  const r = await fetch(ABC_URL, { headers: { "User-Agent": UA } });
  if (!r.ok) { console.error(`    ❌ HTTP ${r.status}`); return []; }

  const html = await r.text();
  const imgRE = /https?:\/\/i\.abcnewsfe\.com\/a\/[a-f0-9-]+\/(wc-[\w.-]+)/gi;
  const seen = new Set();
  const urls = [];

  for (const m of html.matchAll(imgRE)) {
    const name = m[1].replace(/\?.*$/, "");
    if (!seen.has(name)) { seen.add(name); urls.push(m[0].replace(/\?.*$/, "")); }
  }

  const photos = urls.map((url, i) => {
    const fname = url.split("/").pop()?.replace(/\?.*$/, "") ?? "";
    const srcCode = fname.match(/wc-\d+-(\w+)-gmh/)?.[1] ?? "";
    const dateCode = fname.match(/_gmh-(\d{6})_/)?.[1] ?? "";
    const dateStr = dateCode
      ? `20${dateCode.slice(0, 2)}-${dateCode.slice(2, 4)}-${dateCode.slice(4, 6)}`
      : "";
    const photographer = SOURCE_MAP[srcCode] || srcCode || "ABC News";
    return {
      id: 200000 + i,
      src: { large: `${url}?w=1600`, medium: `${url}?w=800`, small: `${url}?w=400` },
      photographer,
      alt: `2026 世界杯精彩瞬间${dateStr ? ` - ${dateStr}` : ""} (${photographer})`,
      width: 1600, height: 1067,
      url: ABC_URL,
    };
  });
  console.log(`    ✅ ${photos.length} 张照片`);
  return photos;
}

async function collectUsaToday() {
  console.log("  [USA Today] 抓取中...");
  const r = await fetch(USATODAY_URL, { headers: { "User-Agent": UA } });
  if (!r.ok) { console.error(`    ❌ HTTP ${r.status}`); return []; }

  const html = await r.text();
  const imgRE = /https?:\/\/www\.usatoday\.com\/gcdn\/authoring\/authoring-images\/\d{4}\/\d{2}\/\d{2}\/[A-Z]+\/([^"'\s]+\.jpg)/gi;
  const seen = new Set();
  const urls = [];

  for (const m of html.matchAll(imgRE)) {
    const base = m[0].split("?")[0];
    if (!seen.has(base)) { seen.add(base); urls.push(base); }
  }

  const photos = urls.map((url, i) => {
    const fname = url.split("/").pop()?.replace(/\.jpg$/i, "") ?? "";
    let photographer = "USA Today Sports";
    if (fname.includes("getty-images") || fname.includes("gty-")) photographer = "Getty Images";
    else if (fname.includes("afp-")) photographer = "AFP via Getty Images";
    else if (fname.includes("usatsi-")) photographer = "USA Today Sports";
    else if (fname.includes("usp-soccer")) photographer = "USA Today Sports";

    const dateMatch = url.match(/authoring-images\/(\d{4})\/(\d{2})\/(\d{2})\//);
    const dateStr = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : "";

    return {
      id: 300000 + i,
      src: {
        large: `${url}?width=1600&height=900&format=pjpg&auto=webp`,
        medium: `${url}?width=800&height=450&format=pjpg&auto=webp`,
        small: `${url}?width=400&height=225&format=pjpg&auto=webp`,
      },
      photographer,
      alt: `2026 世界杯精彩瞬间${dateStr ? ` - ${dateStr}` : ""} (${photographer})`,
      width: 1600, height: 900,
      url: USATODAY_URL,
    };
  });
  console.log(`    ✅ ${photos.length} 张照片`);
  return photos;
}

async function collectApNews() {
  console.log("  [AP News] 抓取中...");
  const allPhotos = [];

  for (const galleryUrl of APNEWS_URLS) {
    try {
      const r = await fetch(galleryUrl, { headers: { "User-Agent": UA } });
      if (!r.ok) continue;
      const html = await r.text();

      const dimsRE = /https?:\/\/dims\.apnews\.com\/[^"'\s]*url=https?%3A%2F%2Fassets\.apnews\.com%2F([a-f0-9]+)%2F([a-f0-9]+)%2F([a-f0-9]+)%2F([a-f0-9]+)/gi;
      const seen = new Set();
      const assetsUrls = [];

      for (const m of html.matchAll(dimsRE)) {
        const hash = `${m[1]}/${m[2]}/${m[3]}/${m[4]}`;
        if (!seen.has(hash)) { seen.add(hash); assetsUrls.push(`https://assets.apnews.com/${hash}`); }
      }

      if (assetsUrls.length === 0) continue;

      const altMatch = html.match(/og:image:alt"[^>]*content="([^"]+)"/);
      const photographerMatch = altMatch?.[1]?.match(/\(([^)]+)\)$/);
      const photographer = photographerMatch?.[1] ?? "AP Photo";

      for (const au of assetsUrls) {
        allPhotos.push({
          id: 400000 + allPhotos.length,
          src: {
            large: `https://dims.apnews.com/dims4/default/7811647/2147483647/strip/true/crop/4744x3161+0+0/resize/1600x1067!/quality/90/?url=${encodeURIComponent(au)}`,
            medium: `https://dims.apnews.com/dims4/default/7811647/2147483647/strip/true/crop/4744x3161+0+0/resize/800x533!/quality/90/?url=${encodeURIComponent(au)}`,
            small: `https://dims.apnews.com/dims4/default/7811647/2147483647/strip/true/crop/4744x3161+0+0/resize/400x267!/quality/90/?url=${encodeURIComponent(au)}`,
          },
          photographer,
          alt: `2026 世界杯精彩瞬间 (${photographer})`,
          width: 1600, height: 1067,
          url: galleryUrl,
        });
      }
    } catch { /* 继续 */ }
  }

  const dedup = new Set();
  const unique = allPhotos.filter(p => { const k = p.src.medium; if (dedup.has(k)) return false; dedup.add(k); return true; });
  console.log(`    ✅ ${unique.length} 张照片（从 ${APNEWS_URLS.length} 个图集）`);
  return unique;
}

async function main() {
  console.log(`[${new Date().toISOString()}] 🔄 开始收集世界杯照片...\n`);

  // 并行抓取所有来源
  const [abcPhotos, usaPhotos, apPhotos] = await Promise.all([
    collectAbcNews(),
    collectUsaToday(),
    collectApNews(),
  ]);

  const allPhotos = [...abcPhotos, ...usaPhotos, ...apPhotos];

  if (allPhotos.length === 0) {
    console.error("\n❌ 所有来源均未返回照片");
    process.exit(1);
  }

  // 全局去重
  const dedup = new Set();
  const unique = allPhotos.filter(p => {
    const key = p.src.medium;
    if (dedup.has(key)) return false;
    dedup.add(key);
    return true;
  });

  console.log(`\n  📸 总计: ${unique.length} 张唯一照片 (ABC:${abcPhotos.length} USA:${usaPhotos.length} AP:${apPhotos.length})`);

  // 保存
  mkdirSync(DATA_DIR, { recursive: true });
  const output = {
    collectedAt: new Date().toISOString(),
    count: unique.length,
    source: "merged",
    photos: unique,
  };

  writeFileSync(OUTPUT, JSON.stringify(output, null, 2), "utf-8");
  console.log(`✅ 收集完成！${unique.length} 张照片已保存到 ${OUTPUT}`);

  // 来源分布统计
  const sources = {};
  for (const p of unique) {
    sources[p.photographer] = (sources[p.photographer] || 0) + 1;
  }
  console.log("  📊 来源分布:", JSON.stringify(sources));
}

main();
