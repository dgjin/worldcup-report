import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { onRequest } from "./index";

interface TestPhoto {
  id: number;
  src: { large: string; medium: string; small: string };
  photographer: string;
  alt: string;
  width: number;
  height: number;
  url: string;
}

interface GalleryBody {
  photos: TestPhoto[];
  next_page?: string;
}

const photo = (id: number, alt: string): TestPhoto => ({
  id,
  alt,
  width: 1600,
  height: 900,
  photographer: "Cached source",
  url: `https://news.example.com/gallery/${id}`,
  src: {
    large: `https://img.example.com/${id}-large.jpg`,
    medium: `https://img.example.com/${id}-medium.jpg`,
    small: `https://img.example.com/${id}-small.jpg`,
  },
});

function kvWith(photos: TestPhoto[]): KVNamespace {
  return {
    // Deliberately stale: the champion branch must never enqueue the normal
    // per-page background refresh chain.
    get: async () => ({ photos, collectedAt: "2020-01-01T00:00:00.000Z" }),
  } as unknown as KVNamespace;
}

async function requestChampion(
  photos: TestPhoto[],
  newsKey?: string,
): Promise<{ body: GalleryBody; waitUntilCount: number }> {
  const pending: Promise<unknown>[] = [];
  const response = await onRequest({
    request: new Request("https://worldcup-report.pages.dev/api/wc/gallery?champion=1&page=1"),
    env: { GALLERY_CACHE: kvWith(photos), NEWSAPI_KEY: newsKey },
    waitUntil(promise: Promise<unknown>) { pending.push(promise); },
  } as unknown as Parameters<typeof onRequest>[0]);

  assert.equal(response.status, 200);
  return {
    body: await response.json() as GalleryBody,
    waitUntilCount: pending.length,
  };
}

const originalFetch = globalThis.fetch;

try {
  const laterCandidate = photo(99, "Spain lift the World Cup trophy as champions");
  const cached = Array.from({ length: 30 }, (_, index) => photo(index, "2026 World Cup highlights"));
  cached[27] = laterCandidate;

  const externalRequests: string[] = [];
  globalThis.fetch = (async (input) => {
    externalRequests.push(String(input));
    throw new Error("cached champion selection must not call an external service");
  }) as typeof fetch;

  const cachedResult = await requestChampion(cached, "configured-key");
  assert.deepEqual(cachedResult.body.photos.map(({ id }) => id), [99]);
  assert.equal(cachedResult.body.next_page, undefined, "champion response must be bounded");
  assert.equal(cachedResult.waitUntilCount, 0, "champion reads must not schedule refresh work");
  assert.equal(externalRequests.length, 0);

  const newsRequests: string[] = [];
  globalThis.fetch = (async (input) => {
    const url = String(input);
    newsRequests.push(url);
    return new Response(JSON.stringify({
      articles: [
        {
          title: "Spain prepare for the World Cup final",
          urlToImage: "https://img.example.com/spain-final.jpg",
          url: "https://news.example.com/spain-final",
          source: { name: "Generic News" },
        },
        {
          title: "Spain lift the World Cup trophy after being crowned champions",
          urlToImage: "https://img.example.com/spain-trophy.jpg",
          url: "https://news.example.com/spain-trophy-report",
          source: { name: "Reuters" },
        },
      ],
    }));
  }) as typeof fetch;

  const newsResult = await requestChampion([photo(1, "2026 World Cup highlights")], "news-key");
  assert.equal(newsRequests.length, 1, "fallback must issue one bounded NewsAPI query");
  const newsUrl = new URL(newsRequests[0]);
  assert.equal(newsUrl.hostname, "newsapi.org");
  assert.equal(newsUrl.searchParams.get("q"), "Spain World Cup champion trophy ceremony");
  assert.equal(newsUrl.searchParams.get("page"), "1");
  assert.ok(Number(newsUrl.searchParams.get("pageSize")) <= 24);
  assert.deepEqual(newsResult.body.photos, [{
    id: 600001,
    alt: "Spain lift the World Cup trophy after being crowned champions",
    width: 0,
    height: 0,
    photographer: "Reuters",
    url: "https://news.example.com/spain-trophy-report",
    src: {
      large: "https://img.example.com/spain-trophy.jpg",
      medium: "https://img.example.com/spain-trophy.jpg",
      small: "https://img.example.com/spain-trophy.jpg",
    },
  }]);
  assert.equal(newsResult.body.next_page, undefined);
  assert.equal(newsResult.waitUntilCount, 0);

  globalThis.fetch = (async () => {
    throw new Error("no-key champion reads must not call external sources");
  }) as typeof fetch;
  const emptyResult = await requestChampion([photo(1, "2026 World Cup highlights")]);
  assert.deepEqual(emptyResult.body.photos, [], "generic cached metadata must be rejected");
  assert.equal(emptyResult.body.next_page, undefined);
} finally {
  globalThis.fetch = originalFetch;
}

const serverSource = readFileSync(new URL("../../../../server.ts", import.meta.url), "utf8");
const galleryRoute = serverSource.slice(
  serverSource.indexOf('app.get("/api/wc/gallery"'),
  serverSource.indexOf("// ====== 精彩瞬间手动刷新 API ======"),
);
assert.match(galleryRoute, /req\.query\.champion/);
assert.match(galleryRoute, /findChampionGalleryPhoto/);
assert.match(galleryRoute, /photos:\s*championResult\.photo\s*\?\s*\[championResult\.photo\]\s*:\s*\[\]/);

const pagesRoutes = JSON.parse(readFileSync(new URL("../../../../public/_routes.json", import.meta.url), "utf8")) as { include: string[] };
const pagesConfig = JSON.parse(readFileSync(new URL("../../../../wrangler.jsonc", import.meta.url), "utf8")) as { name: string };
const workerConfig = JSON.parse(readFileSync(new URL("../../../../worker/wrangler.jsonc", import.meta.url), "utf8")) as { name: string; vars: { SYNC_URL: string } };
const workerSource = readFileSync(new URL("../../../../worker/index.ts", import.meta.url), "utf8");
assert.ok(pagesRoutes.include.includes("/api/wc/*"));
assert.equal(pagesConfig.name, "worldcup-report");
assert.equal(workerConfig.name, "worldcup-sync");
assert.match(workerConfig.vars.SYNC_URL, /worldcup-report\.pages\.dev\/api\/sync/);
assert.match(workerSource, /url\.pathname === "\/gallery"/);
assert.doesNotMatch(workerSource, /url\.pathname === "\/api\/wc\/gallery"/);

console.log("bounded champion gallery endpoint tests passed");
