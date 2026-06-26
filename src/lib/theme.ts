import { useCallback, useEffect, useState } from "react";

export type ThemePref = "light" | "dark" | "auto";
export type EffectiveTheme = "light" | "dark";

const STORAGE_KEY = "theme";
const DARK_MQ = "(prefers-color-scheme: dark)";

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia(DARK_MQ).matches;
}

/** 把用户偏好解析为实际生效的主题（auto → 跟随系统） */
export function resolveTheme(pref: ThemePref): EffectiveTheme {
  if (pref === "light" || pref === "dark") return pref;
  return systemPrefersDark() ? "dark" : "light";
}

function applyTheme(pref: ThemePref): void {
  document.documentElement.setAttribute("data-theme", resolveTheme(pref));
}

/** 三态主题：light / dark / auto（跟随系统），持久化到 localStorage */
export function useTheme() {
  const [pref, setPrefState] = useState<ThemePref>(() => {
    if (typeof localStorage === "undefined") return "auto";
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" || saved === "auto" ? saved : "auto";
  });

  const setPref = useCallback((next: ThemePref) => {
    setPrefState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* localStorage 不可用时忽略 */
    }
  }, []);

  // 应用到 <html data-theme>
  useEffect(() => {
    applyTheme(pref);
  }, [pref]);

  // auto 模式下跟随系统深/浅色实时变化
  useEffect(() => {
    if (pref !== "auto") return;
    const mq = window.matchMedia(DARK_MQ);
    const onChange = () => applyTheme("auto");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  return { pref, setPref, effective: resolveTheme(pref) };
}

/** 供图表使用：读取当前主题的 CSS 变量颜色值，主题切换时自动更新 */
const COLOR_KEYS = [
  "primary",
  "primary-bright",
  "gold",
  "pitch",
  "muted",
  "line",
  "surface",
  "surface-2",
  "ink",
  "bg",
] as const;
export type ThemeColorKey = (typeof COLOR_KEYS)[number];
export type ThemeColors = Record<ThemeColorKey, string>;

function readThemeColors(): ThemeColors {
  const cs = getComputedStyle(document.documentElement);
  const out = {} as ThemeColors;
  for (const k of COLOR_KEYS) out[k] = cs.getPropertyValue(`--color-${k}`).trim();
  return out;
}

/** 读取当前主题颜色，并在 <html data-theme> 变化时重新读取 */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(() =>
    typeof window === "undefined" ? ({} as ThemeColors) : readThemeColors(),
  );

  useEffect(() => {
    const update = () => setColors(readThemeColors());
    update(); // 挂载后读一次，确保拿到首帧后的真实值
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  return colors;
}
