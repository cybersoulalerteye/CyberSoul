export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remaining = whole % 60;
  if (hours) return `${hours}h ${minutes}m ${remaining}s`;
  if (minutes) return `${minutes}m ${remaining}s`;
  return `${remaining}s`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1000) return `${bytes} B`;
  const units = ["kB", "MB", "GB", "TB"];
  let size = bytes / 1000;
  let unit = 0;
  while (size >= 1000 && unit < units.length - 1) { size /= 1000; unit += 1; }
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(size)} ${units[unit]}`;
}

export function formatId(id: string, visible = 8): string {
  if (id.length <= visible) return id;
  return `${id.slice(0, Math.max(3, visible - 1))}…`;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return "—";
  const delta = Math.round((time - now) / 1000);
  const abs = Math.abs(delta);
  const phrase = abs < 60 ? `${abs}s` : abs < 3600 ? `${Math.round(abs / 60)}m` : abs < 86400 ? `${Math.round(abs / 3600)}h` : `${Math.round(abs / 86400)}d`;
  return delta <= 0 ? `${phrase} ago` : `in ${phrase}`;
}
