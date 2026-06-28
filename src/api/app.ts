import { useCallback, useEffect, useState } from "react";

export interface AppLikesState {
  /** 当前点赞总数 */
  likes: number;
  /** 用户是否已点过赞（localStorage 记录） */
  liked: boolean;
  /** 点赞中 */
  liking: boolean;
  /** 点赞 */
  likeApp: () => void;
}

const STORAGE_KEY = "wc2026_app_liked";

async function fetchLikes(): Promise<number> {
  try {
    const res = await fetch("/api/app/likes");
    if (!res.ok) return 0;
    const data = (await res.json()) as { likes: number };
    return data.likes ?? 0;
  } catch {
    return 0;
  }
}

async function postLike(): Promise<number> {
  const res = await fetch("/api/app/likes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("点赞失败");
  const data = (await res.json()) as { likes: number };
  return data.likes ?? 0;
}

/** 应用点赞 Hook */
export function useAppLikes(): AppLikesState {
  const [likes, setLikes] = useState(0);
  const [liking, setLiking] = useState(false);
  const [liked, setLiked] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  // 初始加载点赞数
  useEffect(() => {
    fetchLikes().then(setLikes);
  }, []);

  const likeApp = useCallback(async () => {
    if (liking || liked) return;

    // 乐观更新
    setLikes((prev) => prev + 1);
    setLiked(true);
    setLiking(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch { /* ignore */ }

    try {
      const newLikes = await postLike();
      setLikes(newLikes);
    } catch {
      // 回滚
      setLikes((prev) => Math.max(0, prev - 1));
      setLiked(false);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch { /* ignore */ }
    } finally {
      setLiking(false);
    }
  }, [liking, liked]);

  return { likes, liked, liking, likeApp };
}

/* ——— 访问计数 ——— */

const VISIT_KEY = "wc2026_visited";

async function fetchVisits(): Promise<number> {
  try {
    const res = await fetch("/api/app/visits");
    if (!res.ok) return 0;
    const data = (await res.json()) as { visits: number };
    return data.visits ?? 0;
  } catch {
    return 0;
  }
}

async function postVisit(): Promise<number> {
  const res = await fetch("/api/app/visits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("记录访问失败");
  const data = (await res.json()) as { visits: number };
  return data.visits ?? 0;
}

export interface VisitsState {
  visits: number;
  loading: boolean;
}

/** 访问计数 Hook：每次会话记录一次 */
export function useVisits(): VisitsState {
  const [visits, setVisits] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const count = await fetchVisits();
      if (!cancelled) setVisits(count);

      try {
        if (sessionStorage.getItem(VISIT_KEY) !== "1") {
          sessionStorage.setItem(VISIT_KEY, "1");
          const newCount = await postVisit();
          if (!cancelled) setVisits(newCount);
        }
      } catch {
        /* 静默失败，不影响页面展示 */
      }

      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  return { visits, loading };
}
