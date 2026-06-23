const WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${WEEK[d.getDay()]}`;
}

export function timeLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
