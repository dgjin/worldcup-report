import React, { useState } from "react";
import { Camera, ChevronDown, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useGallery, type GalleryPhoto } from "../api/gallery";
import { cn, Card, SectionHeading, Loader } from "../components/ui";

/** 灯箱 —— 全屏查看单张照片 */
function Lightbox({ photo, onClose, source }: { photo: GalleryPhoto; onClose: () => void; source?: string }) {
  const isAbcNews = source === "abcnews";
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.img
        src={photo.src.large}
        alt={photo.alt}
        className="max-h-[90dvh] max-w-full rounded-2xl object-contain shadow-2xl"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      />
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-full bg-black/70 px-4 py-2 text-sm text-white/80 backdrop-blur">
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

/** 照片卡片 —— 带悬停效果和摄影师信息 */
function PhotoCard({ photo, onClick, priority }: { photo: GalleryPhoto; onClick: () => void; priority?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const ratio = photo.width / photo.height;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative w-full cursor-pointer overflow-hidden rounded-2xl border border-line/50 bg-surface-2",
        "transition-transform duration-300 hover:scale-[1.02] hover:shadow-xl hover:border-primary/30",
      )}
      style={{ aspectRatio: ratio < 1 ? "3/4" : "16/10" }}
    >
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
      {/* 底部遮罩 + 摄影师信息 */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-3 pt-8",
          "translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100",
        )}
      >
        <Camera className="h-3.5 w-3.5 text-white/70" />
        <span className="text-[11px] font-medium text-white/80 truncate">
          {photo.photographer}
        </span>
      </div>
      {/* 悬停高亮边框 */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 transition-colors group-hover:ring-primary/40" />
    </button>
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
  const { photos, loading, error, loadMore, hasMore, reload, source } = useGallery();
  const [selected, setSelected] = useState<GalleryPhoto | null>(null);

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
                onClick={() => setSelected(photo)}
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
        {selected && (
          <Lightbox photo={selected} onClose={() => setSelected(null)} source={source ?? undefined} />
        )}
      </AnimatePresence>
    </section>
  );
}
