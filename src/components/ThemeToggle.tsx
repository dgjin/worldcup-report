import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "./ui";
import type { ThemePref } from "../lib/theme";

const OPTIONS: { key: ThemePref; Icon: typeof Sun; label: string }[] = [
  { key: "light", Icon: Sun, label: "浅色" },
  { key: "dark", Icon: Moon, label: "深色" },
  { key: "auto", Icon: Monitor, label: "跟随系统" },
];

/** 三态主题切换：移动端单按钮循环，桌面端三态并排 */
export function ThemeToggle({ pref, onChange }: { pref: ThemePref; onChange: (p: ThemePref) => void }) {
  const idx = Math.max(0, OPTIONS.findIndex((o) => o.key === pref));
  const current = OPTIONS[idx];
  const next = OPTIONS[(idx + 1) % OPTIONS.length];
  const CurrentIcon = current.Icon;

  return (
    <>
      {/* 移动端：单按钮，显示当前主题，点击循环切换 */}
      <button
        onClick={() => onChange(next.key)}
        aria-label={`主题：${current.label}，点击切换到${next.label}`}
        title={`主题：${current.label}`}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line/60 bg-surface/60 text-muted transition-colors hover:border-primary/50 hover:text-ink sm:hidden"
      >
        <CurrentIcon className="h-4 w-4" />
      </button>

      {/* 桌面端：三态并排 */}
      <div
        className="hidden items-center gap-0.5 rounded-full border border-line/60 bg-surface/60 p-0.5 sm:flex"
        role="group"
        aria-label="主题切换"
      >
        {OPTIONS.map(({ key, Icon, label }) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            aria-label={label}
            aria-pressed={pref === key}
            title={label}
            className={cn(
              "grid h-7 w-7 place-items-center rounded-full transition-colors",
              pref === key ? "bg-primary text-white" : "text-muted hover:text-ink",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    </>
  );
}
