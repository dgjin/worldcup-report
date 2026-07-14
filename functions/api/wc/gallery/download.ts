/**
 * Gallery 批量下载 API — 打包所有高清原图为 ZIP。
 * 优先从 KV 读取数据，其次实时抓取各数据源。
 * 使用 ReadableStream 流式输出 ZIP，避免超时和内存溢出。
 */
interface GalleryPhoto {
  id: number;
  src: { large: string; medium: string; small: string };
  photographer: string;
  alt: string;
  width: number;
  height: number;
  url: string;
}

interface Env {
  NEWSAPI_KEY?: string;
  GALLERY_CACHE?: KVNamespace;
  FIRECRAWL_API_KEY?: string;
}

// ============ ZIP 格式辅助（store 模式，无压缩） ============
const encoder = new TextEncoder();

function putU32(buf: Uint8Array, offset: number, v: number) {
  buf[offset] = v & 0xff;
  buf[offset + 1] = (v >>> 8) & 0xff;
  buf[offset + 2] = (v >>> 16) & 0xff;
  buf[offset + 3] = (v >>> 24) & 0xff;
}
function putU16(buf: Uint8Array, offset: number, v: number) {
  buf[offset] = v & 0xff;
  buf[offset + 1] = (v >>> 8) & 0xff;
}

/** 日期时间 → MS-DOS 格式（用于 ZIP 文件头） */
function dosDateTime(d: Date): { time: number; date: number } {
  const time = (d.getSeconds() >> 1) | (d.getMinutes() << 5) | (d.getHours() << 11);
  const date = d.getDate() | ((d.getMonth() + 1) << 5) | ((d.getFullYear() - 1980) << 9);
  return { time, date };
}

/** 创建本地文件头（30 + 文件名长度 字节） */
function makeLocalHeader(nameBytes: Uint8Array, crc32: number, size: number): Uint8Array {
  const now = dosDateTime(new Date());
  const buf = new Uint8Array(30 + nameBytes.length);
  putU32(buf, 0, 0x04034b50);
  putU16(buf, 4, 20);
  putU16(buf, 6, 0);
  putU16(buf, 8, 0); // store
  putU16(buf, 10, now.time);
  putU16(buf, 12, now.date);
  putU32(buf, 14, crc32);
  putU32(buf, 18, size);
  putU32(buf, 22, size);
  putU16(buf, 26, nameBytes.length);
  putU16(buf, 28, 0);
  buf.set(nameBytes, 30);
  return buf;
}

/** 创建中央目录条目（46 + 文件名长度 字节） */
function makeCentralEntry(nameBytes: Uint8Array, crc32: number, size: number, offset: number): Uint8Array {
  const now = dosDateTime(new Date());
  const buf = new Uint8Array(46 + nameBytes.length);
  putU32(buf, 0, 0x02014b50);
  putU16(buf, 4, 20); putU16(buf, 6, 20);
  putU16(buf, 8, 0);
  putU16(buf, 10, 0); // store
  putU16(buf, 12, now.time);
  putU16(buf, 14, now.date);
  putU32(buf, 16, crc32);
  putU32(buf, 20, size);
  putU32(buf, 24, size);
  putU16(buf, 28, nameBytes.length);
  putU16(buf, 30, 0); // extra
  putU16(buf, 32, 0); // comment
  putU16(buf, 34, 0); // disk
  putU16(buf, 36, 0); // internal attrs
  putU32(buf, 38, 0); // external attrs
  putU32(buf, 42, offset);
  buf.set(nameBytes, 46);
  return buf;
}

/** 创建 EOCD 记录（22 字节） */
function makeEocd(entryCount: number, cdSize: number, cdOffset: number): Uint8Array {
  const buf = new Uint8Array(22);
  putU32(buf, 0, 0x06054b50);
  putU16(buf, 4, 0);
  putU16(buf, 6, 0);
  putU16(buf, 8, entryCount);
  putU16(buf, 10, entryCount);
  putU32(buf, 12, cdSize);
  putU32(buf, 16, cdOffset);
  putU16(buf, 20, 0);
  return buf;
}

/** 简单的 CRC32 实现 */
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ============ 数据获取 ============
const ABC_GALLERY_URL = "https://abcnews.go.com/Sports/photos/best-photos-fifa-world-cup-2026-133075564";
const USATODAY_GALLERY_URL = "https://www.usatoday.com/picture-gallery/sports/soccer/worldcup/2026/06/13/world-cup-2026-best-photos/90528304007/";
const APNEWS_GALLERY_URLS = [
  "https://apnews.com/photo-gallery/photos-soccer-world-cup-shakira-opening-ceremony-608e920d1bf477e7aa544fd2b139331e",
  "https://apnews.com/photo-gallery/photos-brazil-morocco-haiti-metlife-qatar-world-cup-ba66730f4a4b4e341942397a6d512c8c",
  "https://apnews.com/photo-gallery/world-cup-photos-soccer-5dee70b837032094e659a0f0a13a8dfe",
  "https://apnews.com/photo-gallery/world-cup-photos-soccer-usmnt-australia-brazil-haiti-4eb587ca785841b2a1328d8b894faf88",
  "https://apnews.com/photo-gallery/photos-cohosts-us-canada-opener-bosnia-wcup-edc7934c9330443e0f624dbb0b039d7e",
];

async function fetchAbcNews(): Promise<GalleryPhoto[] | null> {
  try {
    const r = await fetch(ABC_GALLERY_URL);
    if (!r.ok) return null;
    const html = await r.text();
    const imgRE = /https?:\/\/i\.abcnewsfe\.com\/a\/[a-f0-9-]+\/(wc-[\w.-]+)/gi;
    const seen = new Set<string>();
    const matches: string[] = [];
    for (const m of html.matchAll(imgRE)) {
      const name = m[1].replace(/\?.*$/, "");
      if (!seen.has(name)) { seen.add(name); matches.push(m[0].replace(/\?.*$/, "")); }
    }
    if (matches.length === 0) return null;
    return matches.map((url, i) => {
      const baseUrl = url.replace(/\?.*$/, "");
      const photographer = "ABC News";
      return {
        id: 200000 + i,
        src: { large: `${baseUrl}?w=1600`, medium: `${baseUrl}?w=800`, small: `${baseUrl}?w=400` },
        photographer,
        alt: `2026 世界杯精彩瞬间 (${photographer})`,
        width: 1600, height: 1067,
        url: ABC_GALLERY_URL,
      };
    });
  } catch { return null; }
}

async function fetchUsaToday(): Promise<GalleryPhoto[] | null> {
  try {
    const r = await fetch(USATODAY_GALLERY_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
    });
    if (!r.ok) return null;
    const html = await r.text();
    const imgRE = /https?:\/\/www\.usatoday\.com\/gcdn\/authoring\/authoring-images\/\d{4}\/\d{2}\/\d{2}\/[A-Z]+\/([^"'\s]+\.jpg)/gi;
    const seen = new Set<string>();
    const urls: string[] = [];
    for (const m of html.matchAll(imgRE)) {
      const base = m[0].split("?")[0];
      if (!seen.has(base)) { seen.add(base); urls.push(base); }
    }
    if (urls.length === 0) return null;
    return urls.map((url, i) => {
      let photographer = "USA Today Sports";
      const fname = url.split("/").pop()?.replace(/\.jpg$/i, "") ?? "";
      if (fname.includes("getty-images")) photographer = "Getty Images";
      else if (fname.includes("afp-")) photographer = "AFP via Getty Images";
      return {
        id: 300000 + i,
        src: {
          large: `${url}?width=1600&height=900&format=pjpg&auto=webp`,
          medium: `${url}?width=800&height=450&format=pjpg&auto=webp`,
          small: `${url}?width=400&height=225&format=pjpg&auto=webp`,
        },
        photographer, alt: `2026 世界杯精彩瞬间 (${photographer})`,
        width: 1600, height: 900, url: USATODAY_GALLERY_URL,
      };
    });
  } catch { return null; }
}

async function fetchApNews(): Promise<GalleryPhoto[] | null> {
  const all: GalleryPhoto[] = [];
  for (const galleryUrl of APNEWS_GALLERY_URLS) {
    try {
      const r = await fetch(galleryUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      });
      if (!r.ok) continue;
      const html = await r.text();
      const dimsRE = /https?:\/\/dims\.apnews\.com\/[^"'\s]*url=https?%3A%2F%2Fassets\.apnews\.com%2F([a-f0-9]+)%2F([a-f0-9]+)%2F([a-f0-9]+)%2F([a-f0-9]+)/gi;
      const seen = new Set<string>();
      const assetsUrls: string[] = [];
      for (const m of html.matchAll(dimsRE)) {
        const hash = `${m[1]}/${m[2]}/${m[3]}/${m[4]}`;
        if (!seen.has(hash)) { seen.add(hash); assetsUrls.push(`https://assets.apnews.com/${hash}`); }
      }
      for (const au of assetsUrls) {
        all.push({
          id: 400000 + all.length,
          src: { large: au, medium: au, small: au },
          photographer: "AP Photo",
          alt: `2026 世界杯精彩瞬间 (AP Photo)`,
          width: 1600, height: 1067, url: galleryUrl,
        });
      }
    } catch { /* continue */ }
  }
  if (all.length === 0) return null;
  const s = new Set<string>();
  return all.filter(p => { const k = p.src.medium; if (s.has(k)) return false; s.add(k); return true; });
}

async function fetchReuters(env: Env): Promise<GalleryPhoto[] | null> {
  if (!env.FIRECRAWL_API_KEY) return null;
  try {
    const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: "https://www.reuters.com/sports/world-cup/",
        formats: ["html"],
        waitFor: 5000,
        actions: [
          { type: "scroll", direction: "down", amount: 2000 },
          { type: "wait", milliseconds: 2000 },
          { type: "scroll", direction: "down", amount: 2000 },
        ],
      }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { success: boolean; data?: { html?: string } };
    if (!data.success || !data.data?.html) return null;
    const html = data.data.html;
    const imgRE = /https?:\/\/www\.reuters\.com\/resizer\/v2\/[^"'\s<>]+\.(?:jpg|webp|png)/gi;
    const seen = new Set<string>();
    const urls: string[] = [];
    for (const m of html.matchAll(imgRE)) {
      const clean = m[0].split("?")[0].split("#")[0];
      if (!seen.has(clean)) { seen.add(clean); urls.push(m[0]); }
    }
    if (urls.length === 0) return null;
    return urls.map((url, i) => {
      const base = url.split("?")[0];
      return {
        id: 500000 + i,
        src: {
          large: `${base}?width=1600&quality=80`,
          medium: `${base}?width=800&quality=80`,
          small: `${base}?width=400&quality=80`,
        },
        photographer: "Reuters",
        alt: `2026 世界杯精彩瞬间 (Reuters)`,
        width: 1600, height: 1067,
        url: "https://www.reuters.com/sports/world-cup/",
      };
    });
  } catch { return null; }
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const kv = ctx.env.GALLERY_CACHE;

  // 获取所有照片
  let allPhotos: GalleryPhoto[] = [];

  if (kv) {
    try {
      const cached = await kv.get("latest", "json") as { photos: GalleryPhoto[] } | null;
      if (cached?.photos?.length) {
        allPhotos = cached.photos;
      }
    } catch {}
  }

  if (allPhotos.length === 0) {
    const [abc, usa, ap, reuters] = await Promise.all([
      fetchAbcNews().catch(() => null),
      fetchUsaToday().catch(() => null),
      fetchApNews().catch(() => null),
      fetchReuters(ctx.env).catch(() => null),
    ]);
    if (abc) allPhotos.push(...abc);
    if (usa) allPhotos.push(...usa);
    if (ap) allPhotos.push(...ap);
    if (reuters) allPhotos.push(...reuters);
    const s = new Set<string>();
    allPhotos = allPhotos.filter(p => { const k = p.src.medium; if (s.has(k)) return false; s.add(k); return true; });
  }

  if (allPhotos.length === 0) {
    return new Response(JSON.stringify({ error: "暂无照片可下载" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const totalCount = allPhotos.length;
  const CONCURRENCY = 6;

  // 构建 ZIP 的 ReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      const centralEntries: Uint8Array[] = [];
      let offset = 0;
      let downloaded = 0;
      let skipped = 0;

      // 辅助：下载图片并写入 ZIP 条目
      async function processPhoto(photo: GalleryPhoto) {
        const originalUrl = photo.src.large;
        const urlPath = originalUrl.split("?")[0];
        const rawName = urlPath.split("/").pop() || `photo-${photo.id}`;
        const ext = rawName.includes(".") ? "" : ".jpg";
        const fileName = `${photo.id}_${rawName}${ext}`;
        const nameBytes = encoder.encode(fileName);

        try {
          const imgResp = await fetch(originalUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
          });
          if (!imgResp.ok) { skipped++; return; }
          const data = new Uint8Array(await imgResp.arrayBuffer());
          const c32 = crc32(data);
          const size = data.length;

          const header = makeLocalHeader(nameBytes, c32, size);
          controller.enqueue(header);
          controller.enqueue(data);
          const entrySize = header.length + size;
          centralEntries.push(makeCentralEntry(nameBytes, c32, size, offset));
          offset += entrySize;
          downloaded++;
        } catch { skipped++; }
      }

      // 并发处理队列
      const queue = [...allPhotos];
      const workers: Promise<void>[] = [];
      for (let i = 0; i < Math.min(CONCURRENCY, queue.length); i++) {
        workers.push((async () => {
          while (queue.length > 0) {
            await processPhoto(queue.shift()!);
          }
        })());
      }
      await Promise.all(workers);

      // 添加 README
      const readmeText = `世界杯 2026 精彩瞬间原图合集\n总计: ${totalCount} 张（成功 ${downloaded} 张）\n数据来源: ABC News / USA Today / AP News / Reuters\n版权归原作者所有，仅供个人欣赏\n`;
      const readmeBytes = encoder.encode(readmeText);
      const readmeName = encoder.encode("README.txt");
      const rc32 = crc32(readmeBytes);
      controller.enqueue(makeLocalHeader(readmeName, rc32, readmeBytes.length));
      controller.enqueue(readmeBytes);
      centralEntries.push(makeCentralEntry(readmeName, rc32, readmeBytes.length, offset));
      offset += 30 + readmeName.length + readmeBytes.length;

      // 写入中央目录 + EOCD
      let cdOffset = offset;
      let cdSize = 0;
      for (const entry of centralEntries) {
        controller.enqueue(entry);
        cdSize += entry.length;
      }
      controller.enqueue(makeEocd(centralEntries.length, cdSize, cdOffset));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="worldcup-gallery-${dateStr}.zip"`,
      "Cache-Control": "no-store",
    },
  });
};
