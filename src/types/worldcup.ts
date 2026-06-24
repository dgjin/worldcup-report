export type DataSource = "live" | "supabase" | "snapshot";

export interface ApiTeam {
  id: number;
  name: string;
  tla?: string | null;
  crest?: string | null;
}

export interface StandingRow {
  position: number;
  team: ApiTeam;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface StandingGroupRaw {
  stage: string;
  type: string;
  group: string | null;
  table: StandingRow[];
}

export interface StandingsResponse {
  standings: StandingGroupRaw[];
  _source?: DataSource;
  _asOf?: string;
}

export interface ScorerRaw {
  player: { id: number; name: string; nationality?: string | null };
  team: ApiTeam;
  playedMatches?: number;
  goals: number;
  assists?: number | null;
  penalties?: number | null;
}

export interface ScorersResponse {
  scorers: ScorerRaw[];
  _source?: DataSource;
  _asOf?: string;
}

export type MatchStatus =
  | "FINISHED"
  | "IN_PLAY"
  | "PAUSED"
  | "TIMED"
  | "SCHEDULED"
  | "POSTPONED"
  | "SUSPENDED"
  | "CANCELLED";

export interface MatchGoal {
  minute: number;
  team: { id: number; name: string };
  scorer: { id: number; name: string };
  assist?: { id: number; name: string } | null;
  type?: "REGULAR" | "PENALTY" | "OWN_GOAL";
}

export interface MatchRaw {
  id: number;
  utcDate: string;
  status: MatchStatus;
  matchday: number | null;
  stage: string;
  group: string | null;
  homeTeam: ApiTeam;
  awayTeam: ApiTeam;
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    duration?: string;
    fullTime: { home: number | null; away: number | null };
  };
  goals?: MatchGoal[];
}

export interface MatchesResponse {
  matches: MatchRaw[];
  _source?: DataSource;
  _asOf?: string;
}

/* ---------- 视图模型 ---------- */

export interface GroupTable {
  letter: string;
  table: StandingRow[];
}

export interface SplitMatches {
  all: MatchRaw[];
  finished: MatchRaw[];
  upcoming: MatchRaw[];
  live: MatchRaw[];
}
