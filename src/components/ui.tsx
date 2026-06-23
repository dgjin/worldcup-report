import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ReactNode } from "react";
import { flagUrl, teamZh } from "../lib/teams";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** 国旗（flagcdn SVG），无映射/未定时回退为带缩写的占位块 */
export function Flag({ name, className }: { name: string | null | undefined; className?: string }) {
  const url = flagUrl(name);
  if (!url) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-[3px] bg-surface-2 text-[8px] font-bold text-muted",
          className,
        )}
        style={{ width: "1.7em", height: "1.2em" }}
      >
        {(name || "?").slice(0, 3).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      className={cn("inline-block rounded-[3px] object-cover shadow-sm ring-1 ring-black/30", className)}
      style={{ width: "1.7em", height: "1.2em" }}
    />
  );
}

/** 国旗 + 中文队名 */
export function TeamName({
  name,
  className,
  bold,
  tla,
}: {
  name: string | null | undefined;
  className?: string;
  bold?: boolean;
  tla?: string | null;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap", className)}>
      <Flag name={name} />
      <span className={cn(bold && "font-semibold")}>{teamZh(name)}</span>
      {tla ? <span className="text-[10px] font-medium text-muted">{tla}</span> : null}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line/70 bg-surface/70 shadow-[0_2px_24px_-12px_rgba(0,0,0,0.6)] backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Tag({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "hot" | "gold" | "cool" }) {
  const tones: Record<string, string> = {
    default: "bg-surface-2 text-muted ring-line",
    hot: "bg-primary/15 text-primary-bright ring-primary/40",
    gold: "bg-gold/15 text-gold ring-gold/40",
    cool: "bg-pitch/15 text-pitch ring-pitch/40",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", tones[tone])}>
      {children}
    </span>
  );
}

export function SectionHeading({ kicker, title, right }: { kicker?: string; title: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        {kicker ? <div className="text-[11px] font-semibold uppercase tracking-widest text-primary-bright">{kicker}</div> : null}
        <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">{title}</h2>
      </div>
      {right}
    </div>
  );
}

export function Loader({ label = "加载中…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-20 text-muted">
      <span className="h-3 w-3 animate-ping rounded-full bg-primary" />
      {label}
    </div>
  );
}
