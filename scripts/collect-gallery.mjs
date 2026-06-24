/**
 * 每日世界杯照片收集脚本
 * 从 ABC News 图集抓取最新比赛照片，保存为本地 JSON 缓存
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

const SOURCE_MAP = {
  gty: "Getty Images",
  rt: "Reuters",
  ap: "Associated Press",
};

async function main() {
  console.log(`[${new Date().toISOString()}] 🔄 开始收集世界杯照片...`);

  try {
    // 1. 抓取 ABC News 页面 HTML
    const r = await fetch(ABC_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    if (!r.ok) {
      console.error(`❌ ABC News 返回 HTTP ${r.status}`);
      process.exit(1);
    }

    const html = await r.text();

    // 2. 提取图片 URL（去重）
    const imgRE =
      /https?:\/\/i\.abcnewsfe\.com\/a\/[a-f0-9-]+\/(wc-[\w.-]+)/gi;
    const seen = new Set();
    const urls = [];

    for (const m of html.matchAll(imgRE)) {
      const name = m[1].replace(/\?.*$/, "");
      if (!seen.has(name)) {
        seen.add(name);
        urls.push(m[0].replace(/\?.*$/, ""));
      }
    }

    console.log(`  📸 发现 ${urls.length} 张唯一照片`);

    // 3. 生成照片数据
    const photos = urls.map((url, i) => {
      const fname = url.split("/").pop()?.replace(/\?.*$/, "") ?? "";
      const srcCode = fname.match(/wc-\d+-(\w+)-gmh/)?.[1] ?? "";
      const dateCode = fname.match(/_gmh-(\d{6})_/)?.[1] ?? "";
      const dateStr = dateCode
        ? `20${dateCode.slice(0, 2)}-${dateCode.slice(2, 4)}-${dateCode.slice(4, 6)}`
        : "";
      const photographer = SOURCE_MAP[srcCode] || srcCode || "ABC News";

      return {
        id: i,
        src: {
          large: `${url}?w=1600`,
          medium: `${url}?w=800`,
          small: `${url}?w=400`,
        },
        photographer,
        alt: `2026 世界杯精彩瞬间${dateStr ? ` - ${dateStr}` : ""} (${photographer})`,
        width: 1600,
        height: 1067,
        url: ABC_URL,
      };
    });

    // 4. 保存到文件
    mkdirSync(DATA_DIR, { recursive: true });
    const output = {
      collectedAt: new Date().toISOString(),
      count: photos.length,
      source: "abcnews",
      photos,
    };

    writeFileSync(OUTPUT, JSON.stringify(output, null, 2), "utf-8");
    console.log(
      `✅ 收集完成！${photos.length} 张照片已保存到 ${OUTPUT}`
    );

    // 5. 输出摘要
    const sources = {};
    for (const p of photos) {
      sources[p.photographer] = (sources[p.photographer] || 0) + 1;
    }
    console.log("  📊 来源分布:", JSON.stringify(sources));
  } catch (err) {
    console.error("❌ 收集失败:", err.message);
    process.exit(1);
  }
}

main();
