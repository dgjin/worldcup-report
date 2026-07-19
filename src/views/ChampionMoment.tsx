import { useEffect, useMemo, useState } from "react";
import { Crown, Trophy } from "lucide-react";
import { motion } from "motion/react";
import { useGallery } from "../api/gallery";
import { Flag, cn } from "../components/ui";
import { findSpainFinal, selectSpainCeremonyPhoto } from "../lib/champion";
import { playerZh, teamZh } from "../lib/teams";
import type { MatchGoal, MatchRaw } from "../types/worldcup";

function Scorers({ goals, teamId, align }: { goals?: MatchGoal[]; teamId: number; align: "left" | "right" }) {
  const teamGoals = (goals ?? [])
    .filter((goal) => goal.team.id === teamId)
    .sort((a, b) => a.minute - b.minute);

  if (teamGoals.length === 0) return null;

  return (
    <div className={cn("mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-white/65", align === "right" ? "justify-end" : "justify-start")}>
      {teamGoals.map((goal, index) => (
        <span key={`${goal.scorer.id}-${goal.minute}-${index}`} className="whitespace-nowrap">
          <span className="font-semibold tabular-nums text-gold">{goal.minute}'</span>{" "}
          {playerZh(goal.scorer.id, goal.scorer.name)}
          {goal.type === "PENALTY" && <span className="text-gold">（点）</span>}
          {goal.type === "OWN_GOAL" && <span className="text-primary-bright">（乌龙）</span>}
        </span>
      ))}
    </div>
  );
}

function FinalScore({ match }: { match: MatchRaw }) {
  const homeScore = match.score.fullTime.home ?? 0;
  const awayScore = match.score.fullTime.away ?? 0;

  return (
    <div className="relative z-10 mx-auto mt-7 w-full max-w-2xl rounded-2xl border border-white/15 bg-black/30 px-3 py-3 shadow-2xl backdrop-blur-md sm:px-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3">
        <div className="min-w-0 text-right">
          <div className="flex items-center justify-end gap-2">
            <span className="truncate text-sm font-semibold text-white sm:text-base">{teamZh(match.homeTeam.name)}</span>
            <Flag name={match.homeTeam.name} className="text-lg" />
          </div>
          <Scorers goals={match.goals} teamId={match.homeTeam.id} align="right" />
        </div>

        <div className="flex items-center gap-2 font-display text-2xl font-black tabular-nums text-white sm:text-3xl">
          <span>{homeScore}</span>
          <span className="text-sm font-medium text-white/40">—</span>
          <span>{awayScore}</span>
        </div>

        <div className="min-w-0 text-left">
          <div className="flex items-center gap-2">
            <Flag name={match.awayTeam.name} className="text-lg" />
            <span className="truncate text-sm font-semibold text-white sm:text-base">{teamZh(match.awayTeam.name)}</span>
          </div>
          <Scorers goals={match.goals} teamId={match.awayTeam.id} align="left" />
        </div>
      </div>
    </div>
  );
}

export default function ChampionMoment({ matches }: { matches: MatchRaw[] }) {
  const { photos } = useGallery();
  const final = useMemo(() => findSpainFinal(matches), [matches]);
  const photo = useMemo(() => selectSpainCeremonyPhoto(photos), [photos]);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [loadedPhotoId, setLoadedPhotoId] = useState<number | null>(null);

  useEffect(() => {
    setPhotoFailed(false);
    setLoadedPhotoId(null);
  }, [photo?.id]);

  const showPhoto = Boolean(photo && !photoFailed);
  const photoLoaded = Boolean(photo && loadedPhotoId === photo.id && !photoFailed);

  return (
    <motion.section
      aria-labelledby="champion-moment-title"
      className="relative mb-7 overflow-hidden rounded-[1.75rem] border border-gold/35 bg-gradient-to-br from-[#4a0710] via-[#821323] to-[#3a0711] px-4 py-8 text-center shadow-[0_24px_70px_-35px_rgba(127,16,35,0.9)] sm:px-8 sm:py-10"
      initial="hidden"
      animate="visible"
      variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
      transition={{ duration: 0.55, ease: "easeOut" }}
    >
      {showPhoto && photo && (
        <img
          key={photo.id}
          src={photo.src.large}
          alt={photo.alt || "西班牙队捧起世界杯冠军奖杯"}
          className="absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-luminosity"
          onLoad={() => setLoadedPhotoId(photo.id)}
          onError={() => setPhotoFailed(true)}
        />
      )}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-black/20 via-[#5f0915]/45 to-[#240308]/90" />
      <div aria-hidden="true" className="absolute -left-20 top-1/2 h-px w-64 -rotate-12 bg-gradient-to-r from-transparent to-gold/45" />
      <div aria-hidden="true" className="absolute -right-20 top-1/3 h-px w-64 rotate-12 bg-gradient-to-l from-transparent to-gold/45" />
      <div aria-hidden="true" className="absolute left-5 top-0 h-32 w-3 -rotate-[18deg] bg-gold/10 sm:left-16" />
      <div aria-hidden="true" className="absolute right-5 top-0 h-32 w-3 rotate-[18deg] bg-gold/10 sm:right-16" />

      <div className="relative z-10">
        <div className="flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-[0.35em] text-gold sm:text-xs">
          <span aria-hidden="true" className="tracking-[0.2em]">★★</span>
          <span>夺冠时刻</span>
          <span aria-hidden="true" className="tracking-[0.2em]">★★</span>
        </div>

        <motion.div
          className="relative mx-auto mt-5 grid h-24 w-24 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold shadow-[0_0_45px_rgba(245,190,70,0.22)]"
          variants={{ hidden: { opacity: 0, scale: 0.82 }, visible: { opacity: 1, scale: 1 } }}
          transition={{ delay: 0.1, duration: 0.45, ease: "easeOut" }}
        >
          <Crown aria-hidden="true" className="absolute -top-3 h-7 w-7" strokeWidth={1.6} />
          <Trophy aria-hidden="true" className="h-12 w-12" strokeWidth={1.4} />
        </motion.div>

        <h2 id="champion-moment-title" className="mt-5 text-white">
          <span className="block text-xs font-semibold tracking-[0.28em] text-white/75 sm:text-sm">冠军属于西班牙</span>
          <span className="mt-1 block font-display text-5xl font-black tracking-tight text-gold drop-shadow-lg sm:text-7xl">西班牙</span>
          <span className="mt-1 block font-display text-sm font-semibold tracking-[0.48em] text-white/60 sm:text-base">CAMPEONES</span>
        </h2>

        {final ? <FinalScore match={final} /> : <p className="relative z-10 mt-7 text-sm font-medium text-white/70">决赛战报同步中</p>}

        {photoLoaded && photo && (
          <a
            href={photo.url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-[10px] text-white/45 underline-offset-2 transition-colors hover:text-white/75 hover:underline"
          >
            摄影/来源：{photo.photographer}
          </a>
        )}
      </div>
    </motion.section>
  );
}
