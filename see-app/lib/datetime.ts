export type PickerMode = "date" | "time" | "datetime";
const pad = (value: number) => String(value).padStart(2, "0");

export function dateOnly(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
export function timeOnly(date: Date, hourOnly = false): string {
  return `${pad(date.getHours())}:${hourOnly ? "00" : pad(date.getMinutes())}`;
}
export function pickerDate(value: string | null | undefined, mode: PickerMode): Date | null {
  if (!value) return null;
  if (mode === "time") {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
    const [hour, minute] = value.split(":").map(Number);
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return date;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day, 12);
    return dateOnly(date) === value ? date : null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
export function pickerValue(date: Date, mode: PickerMode, hourOnly = false): string {
  if (mode === "date") return dateOnly(date);
  if (mode === "time") return timeOnly(date, hourOnly);
  const result = new Date(date);
  result.setSeconds(0, 0);
  return result.toISOString();
}
export function toDateTimeInput(value: string | null | undefined): string {
  const date = pickerDate(value, "datetime");
  return date ? `${dateOnly(date)}T${timeOnly(date)}` : "";
}
export function parseDateTimeInput(value: string): string | null {
  if (!value.trim()) return null;
  const date = pickerDate(value, "datetime");
  if (!date) throw new Error("Choose a valid date and time.");
  return date.toISOString();
}
