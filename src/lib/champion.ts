import type { GalleryPhoto } from "../api/gallery";
import type { MatchRaw } from "../types/worldcup";

const SPAIN_TERMS = ["spain", "spanish", "西班牙"];
const CEREMONY_TERMS = ["champion", "trophy", "lift", "crown", "冠军", "捧杯", "颁奖"];

export function findSpainFinal(matches: MatchRaw[]): MatchRaw | null {
  return [...matches]
    .filter((match) => match.status === "FINISHED" && match.stage === "FINAL")
    .filter((match) => [match.homeTeam.name, match.awayTeam.name]
      .some((name) => name.trim().toLocaleLowerCase("en") === "spain"))
    .sort((a, b) => b.utcDate.localeCompare(a.utcDate))[0] ?? null;
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
      score: spainHits * 10 + ceremonyHits * 10 + (photo.width / photo.height >= 1.35 ? 1 : 0),
    }];
  });

  ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked[0]?.photo ?? null;
}
