import { useCallback, useEffect, useRef, useState } from "react";

export interface GalleryPhoto {
  id: number;
  src: { large: string; medium: string; small: string };
  photographer: string;
  alt: string;
  width: number;
  height: number;
  url: string;
}

export interface GalleryData {
  photos: GalleryPhoto[];
  next_page?: string;
  source?: "newsapi" | "abcnews";
  collectedAt?: string;
  stale?: boolean;
}

export interface GalleryState {
  photos: GalleryPhoto[];
  loading: boolean;
  error: string | null;
  loadMore: () => void;
  hasMore: boolean;
  reload: () => void;
  source: "newsapi" | "abcnews" | null;
  collectedAt: string | null;
  stale: boolean;
  refreshing: boolean;
  refresh: () => void;
  /** 点赞数映射 { photoKey → likes } */
  likes: Record<string, number>;
  /** 点赞照片 */
  likePhoto: (photo: GalleryPhoto) => void;
  /** 点赞加载状态 { photoKey → true } */
  liking: Record<string, boolean>;
}

async function fetchGallery(page: number, signal?: AbortSignal): Promise<GalleryData> {
  const res = await fetch(`/api/wc/gallery?page=${page}&_t=${Date.now()}`, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`Gallery API 返回 ${res.status}`);
  return (await res.json()) as GalleryData;
}

async function refreshGallery(): Promise<GalleryData & { ok?: boolean; message?: string; total?: number }> {
  const res = await fetch("/api/wc/gallery/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`刷新失败: HTTP ${res.status}`);
  return (await res.json()) as GalleryData & { ok?: boolean; message?: string; total?: number };
}

async function fetchLikes(): Promise<Record<string, number>> {
  try {
    const res = await fetch("/api/wc/gallery/likes");
    if (!res.ok) return {};
    return (await res.json()) as Record<string, number>;
  } catch {
    return {};
  }
}

async function postLike(photoKey: string): Promise<{ likes: number }> {
  const res = await fetch("/api/wc/gallery/likes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photoKey }),
  });
  if (!res.ok) throw new Error("点赞失败");
  return (await res.json()) as { likes: number };
}

/** 从图片 URL 提取唯一 key */
export function getPhotoKey(photo: GalleryPhoto): string {
  return photo.src.medium.split("/").pop()?.split("?")[0] ?? String(photo.id);
}

/** 分页加载精彩瞬间照片 + 点赞数据 + 手动刷新 */
export function useGallery(): GalleryState {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [source, setSource] = useState<"newsapi" | "abcnews" | null>(null);
  const [collectedAt, setCollectedAt] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [liking, setLiking] = useState<Record<string, boolean>>({});
  const pageRef = useRef(1);
  const inFlight = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (page: number, append = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const [data, likeData] = await Promise.all([
        fetchGallery(page, ac.signal),
        fetchLikes(),
      ]);
      if (ac.signal.aborted) return;
      setPhotos(prev => append ? [...prev, ...data.photos] : data.photos);
      setHasMore(Boolean(data.next_page));
      setSource(data.source ?? null);
      setCollectedAt(data.collectedAt ?? null);
      setStale(data.stale ?? false);
      setLikes(likeData);
      setError(null);
      pageRef.current = page;
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
      }
    } finally {
      inFlight.current = false;
      if (abortRef.current === ac) abortRef.current = null;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1);
    return () => abortRef.current?.abort();
  }, [load]);

  const loadMore = useCallback(() => {
    if (hasMore && !inFlight.current) {
      load(pageRef.current + 1, true);
    }
  }, [hasMore, load]);

  const reload = useCallback(() => {
    setPhotos([]);
    setLoading(true);
    setError(null);
    setHasMore(true);
    load(1);
  }, [load]);

  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const data = await refreshGallery();
      if (data.photos) {
        setPhotos(data.photos);
        setHasMore(Boolean(data.next_page));
        setSource("abcnews");
        setCollectedAt(data.collectedAt ?? new Date().toISOString());
        setStale(false);
        setError(null);
        pageRef.current = 1;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing]);

  const likePhoto = useCallback(async (photo: GalleryPhoto) => {
    const pk = getPhotoKey(photo);
    if (liking[pk]) return; // 防重复

    // 乐观更新
    setLikes(prev => ({ ...prev, [pk]: (prev[pk] ?? 0) + 1 }));
    setLiking(prev => ({ ...prev, [pk]: true }));

    try {
      await postLike(pk);
    } catch {
      // 回滚
      setLikes(prev => ({ ...prev, [pk]: Math.max(0, (prev[pk] ?? 1) - 1) }));
    } finally {
      setLiking(prev => ({ ...prev, [pk]: false }));
    }
  }, [liking]);

  return { photos, loading, error, loadMore, hasMore, reload, source, collectedAt, stale, refreshing, refresh, likes, likePhoto, liking };
}
