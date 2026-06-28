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
  moreLoading: boolean;
  error: string | null;
  loadMore: () => void;
  hasMore: boolean;
  reload: () => void;
  source: "newsapi" | "abcnews" | null;
  collectedAt: string | null;
  stale: boolean;
  refreshing: boolean;
  /** 手动刷新；成功时返回新增张数 / 总张数 / 是否首次加载，正在刷新中则返回 null，失败抛出异常 */
  refresh: () => Promise<{ added: number; total: number; isFirstLoad: boolean } | null>;
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

async function refreshGallery(): Promise<GalleryData & { ok?: boolean; message?: string; total?: number; added?: number }> {
  const res = await fetch("/api/wc/gallery/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`刷新失败: HTTP ${res.status}`);
  return (await res.json()) as GalleryData & { ok?: boolean; message?: string; total?: number; added?: number };
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
  const [moreLoading, setMoreLoading] = useState(false);
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
  const prevKeysRef = useRef<Set<string>>(new Set());

  const load = useCallback(async (page: number, append = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (append) setMoreLoading(true);
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
      setMoreLoading(false);
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

  const refresh = useCallback(async (): Promise<{ added: number; total: number; isFirstLoad: boolean } | null> => {
    if (refreshing) return null;
    setRefreshing(true);
    try {
      const data = await refreshGallery();
      // 刷新接口返回去重后的完整图集 → 整体替换并重置分页
      if (data.photos && data.photos.length > 0) {
        setPhotos(data.photos);
        setHasMore(false);
        // 根据 results 字段动态判断数据来源（组合源优先显示主来源）
        const results = data.results as Record<string, number> | undefined;
        const dynamicSource = results
          ? (results.abcnews > 0 && results.usatoday > 0 ? "combined" as const
            : results.abcnews > 0 ? "abcnews" as const
            : results.usatoday > 0 ? "usatoday" as const
            : results.apnews > 0 ? "apnews" as const
            : "abcnews" as const)
          : "abcnews" as const;
        setSource(dynamicSource);
        setCollectedAt(data.collectedAt ?? new Date().toISOString());
        setStale(false);
        setError(null);
        pageRef.current = 1;
      }
      return { added: data.added ?? 0, total: data.total ?? data.photos?.length ?? 0, isFirstLoad: !prevKeysRef.current };
    } finally {
      // 刷新失败不写 setError（否则整页会切到错误态），异常向上冒泡交由调用方用 toast 提示
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

  return { photos, loading, moreLoading, error, loadMore, hasMore, reload, source, collectedAt, stale, refreshing, refresh, likes, likePhoto, liking };
}
