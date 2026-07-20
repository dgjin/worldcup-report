import type { GalleryPhoto } from "../api/gallery";
import type { MatchRaw } from "../types/worldcup";

const SPAIN_TERMS = ["spain", "spanish", "西班牙"];
const CEREMONY_TERMS = ["champion", "trophy", "lift", "crown", "冠军", "捧杯", "颁奖"];
const CHAMPION_NEWS_QUERY = "Spain World Cup champion trophy ceremony";
const CHAMPION_NEWS_PAGE_SIZE = 20;
const CHAMPION_NEWS_TIMEOUT_MS = 5_000;

interface NewsApiArticle {
  title?: string | null;
  urlToImage?: string | null;
  url?: string | null;
  source?: { name?: string | null } | null;
}

export interface ChampionGalleryResult {
  photo: GalleryPhoto | null;
  source: "cache" | "newsapi" | null;
}

export function findSpainFinal(matches: MatchRaw[]): MatchRaw | null {
  return [...matches]
    .filter((match) => match.status === "FINISHED" && match.stage === "FINAL")
    .filter((match) => [match.homeTeam.name, match.awayTeam.name]
      .some((name) => name.trim().toLocaleLowerCase("en") === "spain"))
    .sort((a, b) => b.utcDate.localeCompare(a.utcDate))[0] ?? null;
}

export function hasIncompleteGoalEvents(match: MatchRaw): boolean {
  const { home, away } = match.score.fullTime;
  if (typeof home !== "number" || typeof away !== "number") return false;

  const expectedGoalEvents = Math.max(0, home) + Math.max(0, away);
  return (match.goals?.length ?? 0) < expectedGoalEvents;
}

export function selectSpainCeremonyPhoto(photos: GalleryPhoto[]): GalleryPhoto | null {
  const ranked = photos.flatMap((photo, index) => {
    const text = `${photo.alt} ${photo.url}`.toLocaleLowerCase("en");
    const spainHits = SPAIN_TERMS.filter((term) => text.includes(term)).length;
    const ceremonyHits = CEREMONY_TERMS.filter((term) => text.includes(term)).length;
    if (spainHits === 0 || ceremonyHits === 0) return [];
    return [{
      photo,
      index,
      score: spainHits * 10 + ceremonyHits * 10
        + (photo.width > 0 && photo.height > 0 && photo.width / photo.height >= 1.35 ? 1 : 0),
    }];
  });

  ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked[0]?.photo ?? null;
}

/**
 * Select one bounded champion image from all available cache metadata, then make
 * at most one targeted NewsAPI request when the cache has no semantic match.
 */
export async function findChampionGalleryPhoto(
  cachedPhotos: GalleryPhoto[],
  newsApiKey?: string,
  fetcher: typeof fetch = fetch,
): Promise<ChampionGalleryResult> {
  const cachedPhoto = selectSpainCeremonyPhoto(cachedPhotos);
  if (cachedPhoto) return { photo: cachedPhoto, source: "cache" };

  const key = newsApiKey?.trim();
  if (!key) return { photo: null, source: null };

  const params = new URLSearchParams({
    q: CHAMPION_NEWS_QUERY,
    sortBy: "publishedAt",
    language: "en",
    pageSize: String(CHAMPION_NEWS_PAGE_SIZE),
    page: "1",
    apiKey: key,
  });

  try {
    const response = await fetcher(`https://newsapi.org/v2/everything?${params}`, {
      signal: AbortSignal.timeout(CHAMPION_NEWS_TIMEOUT_MS),
    });
    if (!response.ok) return { photo: null, source: null };

    const data = await response.json() as { articles?: NewsApiArticle[] };
    const photos = (data.articles ?? []).flatMap((article, index): GalleryPhoto[] => {
      const title = article.title?.trim();
      const imageUrl = article.urlToImage?.trim();
      const articleUrl = article.url?.trim();
      if (!title || !imageUrl || !articleUrl) return [];

      return [{
        id: 600000 + index,
        src: { large: imageUrl, medium: imageUrl, small: imageUrl },
        photographer: article.source?.name?.trim() || "NewsAPI",
        alt: title,
        // NewsAPI does not provide verified intrinsic dimensions.
        width: 0,
        height: 0,
        url: articleUrl,
      }];
    });
    const photo = selectSpainCeremonyPhoto(photos);
    return { photo, source: photo ? "newsapi" : null };
  } catch {
    return { photo: null, source: null };
  }
}
