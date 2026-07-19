import assert from "node:assert/strict";
import type { GalleryPhoto } from "./gallery";
import { selectSpainCeremonyPhoto } from "../lib/champion";

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
  typeof exportedApi.loadAllGalleryPhotos,
  "function",
  "gallery API should expose a read-only all-pages photo loader",
);

const loadAllGalleryPhotos = exportedApi.loadAllGalleryPhotos as (
  signal?: AbortSignal,
) => Promise<GalleryPhoto[]>;
const originalFetch = globalThis.fetch;

try {
  const requestedUrls: string[] = [];
  globalThis.fetch = (async (input) => {
    const url = String(input);
    requestedUrls.push(url);

    if (url.includes("page=1")) {
      return new Response(JSON.stringify({
        photos: [photo(1, "World Cup highlights")],
        next_page: "2",
      }));
    }

    if (url.includes("page=2")) {
      return new Response(JSON.stringify({
        photos: [photo(2, "Spain crowned champions and lift the World Cup trophy")],
      }));
    }

    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  const photos = await loadAllGalleryPhotos();

  assert.equal(selectSpainCeremonyPhoto(photos)?.id, 2);
  assert.deepEqual(requestedUrls.map((url) => new URL(url, "https://example.com").searchParams.get("page")), ["1", "2"]);
  assert.ok(requestedUrls.every((url) => !url.includes("likes") && !url.includes("refresh")));

  requestedUrls.length = 0;
  globalThis.fetch = (async (input) => {
    const url = String(input);
    requestedUrls.push(url);
    const page = new URL(url, "https://example.com").searchParams.get("page");

    return new Response(JSON.stringify({
      photos: [photo(page === "1" ? 3 : 4, "Generic gallery photo")],
      next_page: page === "1" ? "2" : "1",
    }));
  }) as typeof fetch;

  await loadAllGalleryPhotos();
  assert.equal(requestedUrls.length, 2, "repeated pagination tokens must stop the loader");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("all-pages gallery integration tests passed");
