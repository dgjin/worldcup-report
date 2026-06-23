import { useEffect, useState } from "react";

export interface SquadPlayer {
  id: number;
  name: string;
  position?: string | null;
  dateOfBirth?: string | null;
  nationality?: string | null;
}

export interface TeamSquad {
  id: number;
  name: string;
  tla?: string | null;
  coach?: { name?: string | null; nationality?: string | null } | null;
  squad: SquadPlayer[];
}

interface TeamsResponse {
  teams?: TeamSquad[];
}

/** 一次性拉取全部球队名单（教练 + 阵容），构建 id -> 名单 映射；仅在球队页挂载时调用一次 */
export function useTeams() {
  const [teams, setTeams] = useState<Map<number, TeamSquad> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/wc/teams?_t=${Date.now()}`, { cache: "no-store" });
        const j = (await res.json()) as TeamsResponse;
        if (!alive) return;
        const map = new Map<number, TeamSquad>();
        for (const t of j.teams ?? []) map.set(t.id, t);
        setTeams(map);
      } catch {
        if (alive) setTeams(new Map());
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { teams, loading };
}

/** 位置分组（中文）。football-data 用 Goalkeeper/Defence/Midfield/Offence，也兼容细分位置名 */
export const POSITION_GROUPS = ["门将", "后卫", "中场", "前锋", "其他"] as const;
export type PositionGroup = (typeof POSITION_GROUPS)[number];

export function positionGroup(position?: string | null): PositionGroup {
  const p = (position ?? "").toLowerCase();
  if (!p) return "其他";
  if (p.includes("goalkeeper") || p.includes("keeper")) return "门将";
  if (p.includes("back") || p.includes("defence") || p.includes("defender")) return "后卫";
  if (p.includes("midfield")) return "中场";
  if (p.includes("offence") || p.includes("forward") || p.includes("winger") || p.includes("striker") || p.includes("attack"))
    return "前锋";
  return "其他";
}

/** 由出生日期算年龄 */
export function ageFromDob(dob?: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}
