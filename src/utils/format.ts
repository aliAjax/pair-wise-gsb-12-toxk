// 展示层通用格式化
export function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatSlot(value: string): string {
  if (!value) return "—";
  return value.replace("T", " ");
}

export function formatTons(value: number): string {
  return `${value.toFixed(2).replace(/\.?0+$/, "")} t`;
}

/** datetime-local 默认值：当前时刻取整到分钟 */
export function nowLocal(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/** datetime-local 默认值：若干小时后 */
export function hoursLaterLocal(hours: number): string {
  const d = new Date(Date.now() + hours * 3600_000);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
