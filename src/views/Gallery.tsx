import React, { useState, useCallback, useEffect } from "react";
import { Camera, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Heart } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useGallery, getPhotoKey, type GalleryPhoto } from "../api/gallery";
import { cn, Card, SectionHeading, Loader } from "../components/ui";

/** 灯箱 —— 全屏查看照片，支持左右滑动浏览 */
function Lightbox({
  photos,
  index,
  onClose,
  onNavigate,
  source,
  likes,
  onLike,
  liking,
}: {
  photos: GalleryPhoto[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  source?: string;
  likes: Record<string, number>;
  onLike: (p: GalleryPhoto) => void;
  liking: Record<string, boolean>;
}) {
  const photo = photos[index];
  const isAbcNews = source === "abcnews";
  const pk = getPhotoKey(photo);
  const count = likes[pk] ?? 0;
  const isLiking = liking[pk] ?? false;

  const goPrev = useCallback(() => {
    onNavigate(index > 0 ? index - 1 : photos.length - 1);
  }, [index, photos.length, onNavigate]);

  const goNext = useCallback(() => {
    onNavigate(index < photos.length - 1 ? index + 1 : 0);
  }, [index, photos.length, onNavigate]);

  // 键盘导航
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goPrev, goNext]);

  // 触摸滑动
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart == null) return;
    const dx = e.changedTouches[0].clientX - touchStart;
    if (Math.abs(dx) > 50) { dx > 0 ? goPrev() : goNext(); }
    setTouchStart(null);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* 左右导航箭头 */}
      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-2 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white md:left-4"
            aria-label="上一张"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-2 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white md:right-4"
            aria-label="下一张"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      <AnimatePresence mode="wait">
        <motion.img
          key={photo.id}
          src={photo.src.large}
          alt={photo.alt}
          className="max-h-[85dvh] max-w-full rounded-2xl object-contain shadow-2xl"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          draggable={false}
        />
      </AnimatePresence>

      {/* 底部信息栏 */}
      <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/70 px-4 py-2 text-sm text-white/80 backdrop-blur" onClick={(e) => e.stopPropagation()}>
        {/* 点赞按钮 */}
        <button
          onClick={() => onLike(photo)}
          disabled={isLiking}
          className={cn(
            "inline-flex items-center gap-1 transition-colors",
            count > 0 ? "text-red-400" : "text-white/50 hover:text-red-300",
          )}
        >
          <Heart className={cn("h-4 w-4 transition-all", count > 0 && "fill-current")} />
          {count > 0 && <span className="text-xs font-medium">{count}</span>}
        </button>
        <span className="text-white/20">|</span>
        {/* 照片计数 */}
        {photos.length > 1 && (
          <>
            <span className="text-xs font-medium tabular-nums text-white/60">
              {index + 1} / {photos.length}
            </span>
            <span className="text-white/20">|</span>
          </>
        )}
        <span>
          {isAbcNews ? `🏟️ ${photo.photographer}` : `📰 ${photo.photographer}`}
        </span>
        <a
          href={photo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary-bright hover:underline"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          {isAbcNews ? "ABC News 图集" : "阅读原文"} <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </motion.div>
  );
}

/** 照片卡片 —— 带悬停效果、摄影师信息和点赞按钮 */
function PhotoCard({ photo, onClick, priority, likes, onLike, liking }: {
  photo: GalleryPhoto;
  onClick: () => void;
  priority?: boolean;
  likes: Record<string, number>;
  onLike: (p: GalleryPhoto) => void;
  liking: Record<string, boolean>;
}) {
  const [loaded, setLoaded] = useState(false);
  const ratio = photo.width / photo.height;
  const pk = getPhotoKey(photo);
  const count = likes[pk] ?? 0;
  const isLiking = liking[pk] ?? false;

  return (
    <div
      className={cn(
        "group relative w-full cursor-pointer overflow-hidden rounded-2xl border border-line/50 bg-surface-2",
        "transition-transform duration-300 hover:scale-[1.02] hover:shadow-xl hover:border-primary/30",
      )}
      style={{ aspectRatio: ratio < 1 ? "3/4" : "16/10" }}
    >
      {/* 点击查看大图 */}
      <button onClick={onClick} className="absolute inset-0 z-10">
        <span className="sr-only">查看大图</span>
      </button>

      {/* 加载占位 */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      )}
      <img
        src={photo.src.medium}
        alt={photo.alt}
        loading={priority ? "eager" : "lazy"}
        onLoad={() => setLoaded(true)}
        className={cn(
          "h-full w-full object-cover transition-all duration-500",
          "group-hover:scale-110 group-hover:brightness-110",
          loaded ? "opacity-100" : "opacity-0",
        )}
      />

      {/* 点赞按钮（右上角浮动，始终可见） */}
      <button
        onClick={(e) => { e.stopPropagation(); onLike(photo); }}
        disabled={isLiking}
        className={cn(
          "absolute right-2 top-2 z-20 flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium backdrop-blur-md transition-all duration-200 active:scale-90",
          count > 0
            ? "bg-red-500/80 text-white"
            : "bg-black/45 text-white/80 hover:bg-black/70 hover:text-red-300",
        )}
      >
        <Heart className={cn("h-3.5 w-3.5 transition-transform", isLiking && "animate-ping")} fill={count > 0 ? "currentColor" : "none"} />
        {count > 0 && <span>{count}</span>}
      </button>

      {/* 底部遮罩 + 摄影师信息（始终可见） */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 pb-3 pt-8">
        <Camera className="h-3.5 w-3.5 text-white/70" />
        <span className="text-[11px] font-medium text-white/80 truncate">
          {photo.photographer}
        </span>
      </div>

      {/* 悬停高亮边框 */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 transition-colors group-hover:ring-primary/40" />
    </div>
  );
}

/** 滚动加载触发器 */
function InfiniteScrollTrigger({ onInView, loading }: { onInView: () => void; loading: boolean }) {
  return (
    <div className="flex justify-center py-8">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          加载中…
        </div>
      ) : (
        <button
          onClick={onInView}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line/60 bg-surface/60 px-5 py-2.5 text-sm text-muted transition-colors hover:border-primary/50 hover:text-ink"
        >
          <ChevronDown className="h-4 w-4" />
          加载更多
        </button>
      )}
    </div>
  );
}

export default function Gallery() {
  const { photos, loading, error, loadMore, hasMore, reload, source, likes, likePhoto, liking } = useGallery();
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (loading) return <Loader label="加载精彩瞬间…" />;

  if (error) {
    return (
      <Card className="p-10 text-center">
        <div className="mb-3 text-sm text-primary-bright">加载失败：{error}</div>
        <button
          onClick={reload}
          className="rounded-xl border border-line/60 bg-surface/60 px-4 py-2 text-sm text-muted transition-colors hover:border-primary/50 hover:text-ink"
        >
          重试
        </button>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      <SectionHeading
        kicker="GALLERY"
        title="精彩瞬间"
        right={
          <button
            onClick={reload}
            className="text-xs text-muted hover:text-ink transition-colors"
          >
            刷新
          </button>
        }
      />

      {photos.length === 0 ? (
        <Card className="p-12 text-center">
          <Camera className="mx-auto mb-3 h-10 w-10 text-muted" />
          <p className="text-sm text-muted">
            暂无精彩照片。在环境变量中配置 <code className="mx-1 rounded bg-surface px-1">NEWSAPI_KEY</code> 即可加载。
          </p>
        </Card>
      ) : (
        <>
          {/* 自适应网格：移动端 1-2 列 → 桌面端 3 列 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo, i) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                priority={i < 6}
                onClick={() => setSelectedIdx(i)}
                likes={likes}
                onLike={likePhoto}
                liking={liking}
              />
            ))}
          </div>

          {/* 加载更多按钮 */}
          {hasMore && (
            <InfiniteScrollTrigger onInView={loadMore} loading={loading} />
          )}

          {/* 底部署名 */}
          <p className="text-center text-[10px] text-muted">
            {source === "abcnews"
              ? "照片来源于 ABC News 最佳比赛图集（Reuters / Getty Images / AP），版权归原作者所有"
              : "照片来源于 NewsAPI 新闻媒体，版权归原作者所有"}
          </p>
        </>
      )}

      {/* 灯箱 */}
      <AnimatePresence>
        {selectedIdx != null && photos[selectedIdx] && (
          <Lightbox
            photos={photos}
            index={selectedIdx}
            onClose={() => setSelectedIdx(null)}
            onNavigate={setSelectedIdx}
            source={source ?? undefined}
            likes={likes}
            onLike={likePhoto}
            liking={liking}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
