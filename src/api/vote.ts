import { useCallback, useEffect, useState } from "react";

export type VoteCategory = "champion" | "runnerup" | "thirdplace";

export interface VoteData {
  champion: Record<string, number>;
  runnerup: Record<string, number>;
  thirdplace: Record<string, number>;
  total: number;
  voters?: number;
}

export interface UserVote {
  champion: string;
  runnerup: string;
  thirdplace: string;
  email?: string;
  name?: string;
}

export interface VoteState {
  data: VoteData | null;
  loading: boolean;
  voted: boolean;
  myVote: UserVote | null;
  submitting: boolean;
  submit: (vote: UserVote) => Promise<void>;
  reload: () => void;
}

const STORAGE_KEY = "wc2026_champion_vote";

async function fetchVotes(): Promise<VoteData> {
  try {
    const res = await fetch(`/api/app/vote?_t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("fetch failed");
    return (await res.json()) as VoteData;
  } catch {
    return { champion: {}, runnerup: {}, thirdplace: {}, total: 0, voters: 0 };
  }
}

async function postVote(vote: UserVote): Promise<VoteData & { record?: unknown }> {
  const res = await fetch("/api/app/vote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(vote),
  });
  if (!res.ok) throw new Error("投票失败");
  return (await res.json()) as VoteData & { record?: unknown };
}

export function useChampionVote(): VoteState {
  const [data, setData] = useState<VoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [myVote, setMyVote] = useState<UserVote | null>(null);

  // 从 localStorage 恢复已投票记录
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setMyVote(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // 加载投票数据
  const load = useCallback(async () => {
    const d = await fetchVotes();
    setData(d);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = useCallback(async (vote: UserVote) => {
    if (submitting || myVote) return;
    setSubmitting(true);

    // 乐观更新：立即累加
    setData((prev) => {
      if (!prev) return prev;
      const next = { ...prev, champion: { ...prev.champion }, runnerup: { ...prev.runnerup }, thirdplace: { ...prev.thirdplace } };
      if (vote.champion) next.champion[vote.champion] = (next.champion[vote.champion] ?? 0) + 1;
      if (vote.runnerup) next.runnerup[vote.runnerup] = (next.runnerup[vote.runnerup] ?? 0) + 1;
      if (vote.thirdplace) next.thirdplace[vote.thirdplace] = (next.thirdplace[vote.thirdplace] ?? 0) + 1;
      next.total = prev.total + [vote.champion, vote.runnerup, vote.thirdplace].filter(Boolean).length;
      next.voters = (prev.voters ?? 0) + 1;
      return next;
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(vote));
      setMyVote(vote);
      const fresh = await postVote(vote);
      setData(fresh);
    } catch {
      // 回滚
      setData((prev) => {
        if (!prev) return prev;
        const next = { ...prev, champion: { ...prev.champion }, runnerup: { ...prev.runnerup }, thirdplace: { ...prev.thirdplace } };
        if (vote.champion) next.champion[vote.champion] = Math.max(0, (next.champion[vote.champion] ?? 0) - 1);
        if (vote.runnerup) next.runnerup[vote.runnerup] = Math.max(0, (next.runnerup[vote.runnerup] ?? 0) - 1);
        if (vote.thirdplace) next.thirdplace[vote.thirdplace] = Math.max(0, (next.thirdplace[vote.thirdplace] ?? 0) - 1);
        next.total = Math.max(0, prev.total - [vote.champion, vote.runnerup, vote.thirdplace].filter(Boolean).length);
        next.voters = Math.max(0, (prev.voters ?? 0) - 1);
        return next;
      });
    } finally {
      setSubmitting(false);
    }
  }, [submitting, myVote]);

  return {
    data,
    loading,
    voted: myVote !== null,
    myVote,
    submitting,
    submit,
    reload: load,
  };
}
