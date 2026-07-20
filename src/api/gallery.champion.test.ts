import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { GalleryPhoto } from "./gallery";

const photo = (id: number, alt: string): GalleryPhoto => ({
  id,
  alt,
  width: 1600,
  height: 900,
  photographer: "Reuters",
  url: `https://example.com/${id}`,
  src: {
    large: `https://img.example.com/${id}-l.jpg`,
    medium: `https://img.example.com/${id}-m.jpg`,
    small: `https://img.example.com/${id}-s.jpg`,
  },
});

const galleryApi = await import("./gallery");
const exportedApi = galleryApi as Record<string, unknown>;

assert.equal(
  typeof exportedApi.loadChampionPhotos,
  "function",
  "gallery API should expose a single-request champion photo loader",
);

const loadChampionPhotos = exportedApi.loadChampionPhotos as (
  signal?: AbortSignal,
) => Promise<GalleryPhoto[]>;
const originalFetch = globalThis.fetch;

try {
  const requestedUrls: string[] = [];
  const requestedOptions: (RequestInit | undefined)[] = [];
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    requestedUrls.push(url);
    requestedOptions.push(init);
    return new Response(JSON.stringify({
      photos: [photo(2, "Spain crowned champions and lift the World Cup trophy")],
      // The champion loader must ignore pagination, even when the token is unique.
      next_page: "page-token-that-never-repeats-1",
    }));
  }) as typeof fetch;

  const photos = await loadChampionPhotos();

  assert.deepEqual(photos.map(({ id }) => id), [2]);
  assert.equal(requestedUrls.length, 1, "champion loader must make exactly one gallery request");
  const requested = new URL(requestedUrls[0], "https://example.com");
  assert.equal(requested.pathname, "/api/wc/gallery");
  assert.equal(requested.search, "?champion=1", "champion request URL must be stable for cache reuse");
  assert.equal(requested.searchParams.get("champion"), "1");
  assert.equal(requested.searchParams.has("page"), false, "champion request must not paginate");
  assert.notEqual(requestedOptions[0]?.cache, "no-store", "champion reads must honor response caching");
  assert.ok(requestedUrls.every((url) => !url.includes("likes") && !url.includes("refresh")));
} finally {
  globalThis.fetch = originalFetch;
}

const gallerySource = readFileSync(new URL("./gallery.ts", import.meta.url), "utf8");
assert.doesNotMatch(gallerySource, /loadAllGalleryPhotos|useAllGalleryPhotos|visitedPages/);

console.log("single-request champion gallery tests passed");
