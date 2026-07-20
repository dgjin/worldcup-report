import { useMemo, useState } from "react";
import { Crown, Trophy } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useChampionPhotos } from "../api/gallery";
import { Flag, cn } from "../components/ui";
import {
  CURATED_SPAIN_CHAMPION_PHOTO,
  findSpainFinal,
  hasIncompleteGoalEvents,
  selectSpainCeremonyPhoto,
} from "../lib/champion";
import { playerZh, teamZh } from "../lib/teams";
import type { MatchGoal, MatchRaw } from "../types/worldcup";

function Scorers({ goals, teamId, align }: { goals?: MatchGoal[]; teamId: number; align: "left" | "right" }) {
  const teamGoals = (goals ?? [])
    .filter((goal) => goal.team.id === teamId)
    .sort((a, b) => a.minute - b.minute);

  if (teamGoals.length === 0) return null;

  return (
    <div className={cn(
      "mt-1 flex min-w-0 flex-col gap-x-2 gap-y-0.5 text-base leading-snug text-white/65 sm:flex-row sm:flex-wrap",
      align === "right"
        ? "items-end text-right sm:items-baseline sm:justify-end"
        : "items-start text-left sm:items-baseline sm:justify-start",
    )}>
      {teamGoals.map((goal, index) => (
        <span key={`${goal.scorer.id}-${goal.minute}-${index}`} className="max-w-full break-words">
          <span className="font-semibold tabular-nums text-gold">{goal.minute}'</span>{" "}
          {playerZh(goal.scorer.id, goal.scorer.name)}
          {goal.type === "PENALTY" && <span className="text-gold">（点）</span>}
          {goal.type === "OWN_GOAL" && <span className="text-[#fff4d6]">（乌龙）</span>}
        </span>
      ))}
    </div>
  );
}

function FinalScore({ match }: { match: MatchRaw }) {
  const homeScore = match.score.fullTime.home;
  const awayScore = match.score.fullTime.away;
  const hasFinalScore = typeof homeScore === "number" && typeof awayScore === "number";
  const goalInformationMissing = hasIncompleteGoalEvents(match);

  return (
    <div className="relative z-10 mx-auto mt-7 w-full max-w-2xl rounded-2xl border border-white/15 bg-black/30 px-3 py-3 shadow-2xl backdrop-blur-md sm:px-5">
      <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-3">
        <div className="min-w-0 text-right">
          <div className="flex items-center justify-end gap-2">
            <span className="truncate text-base font-semibold text-white">{teamZh(match.homeTeam.name)}</span>
            <Flag name={match.homeTeam.name} className="text-lg" />
          </div>
          <Scorers goals={match.goals} teamId={match.homeTeam.id} align="right" />
        </div>

        <div className="flex items-center justify-self-center gap-2 font-display text-2xl font-black tabular-nums text-white sm:text-3xl">
          {hasFinalScore ? (
            <>
              <span>{homeScore}</span>
              <span className="text-base font-medium text-white/40">—</span>
              <span>{awayScore}</span>
            </>
          ) : (
            <span className="text-base font-medium text-white/55">比分同步中</span>
          )}
        </div>

        <div className="min-w-0 text-left">
          <div className="flex items-center gap-2">
            <Flag name={match.awayTeam.name} className="text-lg" />
            <span className="truncate text-base font-semibold text-white">{teamZh(match.awayTeam.name)}</span>
          </div>
          <Scorers goals={match.goals} teamId={match.awayTeam.id} align="left" />
        </div>
      </div>
      {goalInformationMissing && (
        <p className="mt-2 text-base font-medium text-white/65">进球信息同步中</p>
      )}
    </div>
  );
}

export default function ChampionMoment({ matches }: { matches: MatchRaw[] }) {
  const { photos } = useChampionPhotos();
  const shouldReduceMotion = useReducedMotion();
  const final = useMemo(() => findSpainFinal(matches), [matches]);
  const galleryPhoto = useMemo(() => selectSpainCeremonyPhoto(photos), [photos]);
  const [failedPhotoId, setFailedPhotoId] = useState<number | null>(null);
  const [loadedPhotoId, setLoadedPhotoId] = useState<number | null>(null);
  const photo = failedPhotoId === CURATED_SPAIN_CHAMPION_PHOTO.id
    ? galleryPhoto
    : CURATED_SPAIN_CHAMPION_PHOTO;

  const photoFailed = Boolean(photo && failedPhotoId === photo.id);
  const showPhoto = Boolean(photo && !photoFailed);
  const photoLoaded = Boolean(photo && loadedPhotoId === photo.id && !photoFailed);

  return (
    <motion.section
      aria-labelledby="champion-moment-title"
      className="champion-moment relative mb-7 overflow-hidden rounded-[1.75rem] border px-4 py-8 text-center sm:px-8 sm:py-10"
      initial={shouldReduceMotion ? false : "hidden"}
      animate={shouldReduceMotion ? false : "visible"}
      variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
      transition={{ duration: 0.55, ease: "easeOut" }}
    >
      {showPhoto && photo && (
        <img
          key={photo.id}
          src={photo.src.large}
          srcSet={`${photo.src.small} 400w, ${photo.src.medium} 800w${photo.width > 800 ? `, ${photo.src.large} ${photo.width}w` : ""}`}
          sizes="(min-width: 640px) min(100vw - 4rem, 80rem), calc(100vw - 2rem)"
          width={photo.width > 0 ? photo.width : undefined}
          height={photo.height > 0 ? photo.height : undefined}
          alt={photo.alt || "西班牙队捧起世界杯冠军奖杯"}
          className="champion-photo absolute inset-0 h-full w-full object-cover"
          onLoad={() => setLoadedPhotoId(photo.id)}
          onError={() => setFailedPhotoId(photo.id)}
        />
      )}
      <div aria-hidden="true" className="champion-radiance absolute inset-0" />
      <div aria-hidden="true" className="champion-ribbon champion-ribbon--left absolute" />
      <div aria-hidden="true" className="champion-ribbon champion-ribbon--right absolute" />
      <div aria-hidden="true" className="champion-particles absolute inset-0">
        <span className="champion-particle" />
        <span className="champion-particle" />
        <span className="champion-particle" />
        <span className="champion-particle" />
        <span className="champion-particle" />
        <span className="champion-particle" />
        <span className="champion-particle" />
      </div>
      <div aria-hidden="true" className="champion-vignette absolute inset-0" />

      <div className="champion-content relative z-10">
        <div className="flex items-center justify-center gap-3 text-base font-bold uppercase tracking-[0.35em] text-gold">
          <span aria-hidden="true" className="tracking-[0.2em]">★★</span>
          <span>夺冠时刻</span>
          <span aria-hidden="true" className="tracking-[0.2em]">★★</span>
        </div>

        <motion.div
          className="champion-emblem relative mx-auto mt-5 grid h-24 w-24 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold shadow-[0_0_45px_rgba(245,190,70,0.22)]"
          initial={shouldReduceMotion ? false : "hidden"}
          animate={shouldReduceMotion ? false : "visible"}
          variants={{ hidden: { opacity: 0, scale: 0.82 }, visible: { opacity: 1, scale: 1 } }}
          transition={{ delay: 0.1, duration: 0.45, ease: "easeOut" }}
        >
          <Crown aria-hidden="true" className="absolute -top-3 h-7 w-7" strokeWidth={1.6} />
          <Trophy aria-hidden="true" className="h-12 w-12" strokeWidth={1.4} />
        </motion.div>

        <h2 id="champion-moment-title" className="mt-5 text-white">
          <span className="block text-base font-semibold tracking-[0.28em] text-white/75">冠军属于西班牙</span>
          <span className="mt-1 block font-display text-5xl font-black tracking-tight text-gold drop-shadow-lg sm:text-7xl">西班牙</span>
          <span className="mt-1 block font-display text-base font-semibold tracking-[0.48em] text-white/60">CAMPEONES</span>
        </h2>

        {final ? <FinalScore match={final} /> : <p className="relative z-10 mt-7 text-base font-medium text-white/70">决赛战报同步中</p>}

        {photoLoaded && photo && (
          <a
            href={photo.url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex min-h-11 items-center text-xs text-white/60 underline-offset-2 transition-colors hover:text-white/85 hover:underline"
          >
            摄影/来源：{photo.photographer}
          </a>
        )}
      </div>
    </motion.section>
  );
}
