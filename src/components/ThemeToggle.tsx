import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "./ui";
import type { ThemePref } from "../lib/theme";

const OPTIONS: { key: ThemePref; Icon: typeof Sun; label: string }[] = [
  { key: "light", Icon: Sun, label: "浅色" },
  { key: "dark", Icon: Moon, label: "深色" },
  { key: "auto", Icon: Monitor, label: "跟随系统" },
];

/** 三态主题切换：浅色 / 深色 / 跟随系统 */
export function ThemeToggle({ pref, onChange }: { pref: ThemePref; onChange: (p: ThemePref) => void }) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-full border border-line/60 bg-surface/60 p-0.5"
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
  );
}
