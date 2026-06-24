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
}

export interface GalleryState {
  photos: GalleryPhoto[];
  loading: boolean;
  error: string | null;
  loadMore: () => void;
  hasMore: boolean;
  reload: () => void;
  source: "newsapi" | "abcnews" | null;
}

async function fetchGallery(page: number, signal?: AbortSignal): Promise<GalleryData> {
  const res = await fetch(`/api/wc/gallery?page=${page}`, { signal });
  if (!res.ok) throw new Error(`Gallery API 返回 ${res.status}`);
  return (await res.json()) as GalleryData;
}

/** 分页加载精彩瞬间照片 */
export function useGallery(): GalleryState {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [source, setSource] = useState<"newsapi" | "abcnews" | null>(null);
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
      const data = await fetchGallery(page, ac.signal);
      if (ac.signal.aborted) return;
      setPhotos(prev => append ? [...prev, ...data.photos] : data.photos);
      setHasMore(Boolean(data.next_page));
      setSource(data.source ?? null);
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

  return { photos, loading, error, loadMore, hasMore, reload, source };
}
