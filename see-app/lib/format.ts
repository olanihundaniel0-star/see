import { pickerDate } from "./datetime";

function toDate(value: string | Date) {
  return value instanceof Date ? value : pickerDate(value, "datetime");
}
function format(value: string | Date, options: Intl.DateTimeFormatOptions) {
  const date = toDate(value);
  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat("en-GB", options).format(date) : "Date unavailable";
}
export function formatShortDateTime(value: string | Date) {
  return format(value, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}
export function formatFullDateTime(value: string | Date) {
  return format(value, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}
export function formatShortDate(value: string | Date) {
  return format(value, { weekday: "short", day: "numeric", month: "short" });
}
export function formatCountdown(value: string | Date) {
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) return "Date unavailable";
  const delta = date.getTime() - Date.now();
  if (delta < 0) return "Overdue";
  const minutes = Math.ceil(delta / 60_000);
  if (minutes < 1) return "Due now";
  if (minutes < 60) return `In ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours >= 24) return `In ${Math.floor(hours / 24)}d ${hours % 24}h`;
  return `In ${hours}h ${minutes % 60}m`;
}
export function formatRelativePast(value: string | Date) {
  const date = toDate(value);
  if (!date) return "Date unavailable";
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}
export function formatProgress(completed: number, total: number) {
  return total ? Math.round(completed / total * 100) : 0;
}
export function localTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
