const LAGOS_TIME_ZONE = "Africa/Lagos";

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

export function formatLagosClock(date: Date) {
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: LAGOS_TIME_ZONE
  }).format(date);

  const day = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: LAGOS_TIME_ZONE
  }).format(date);

  return { time, day: day.toUpperCase() };
}

export function formatShortDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: LAGOS_TIME_ZONE
  }).format(toDate(value));
}

export function formatShortDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: LAGOS_TIME_ZONE
  }).format(toDate(value));
}

export function formatCountdown(value: string | Date) {
  const target = toDate(value).getTime();
  const delta = target - Date.now();
  const past = delta <= 0;
  const remaining = Math.max(0, delta);
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining / (1000 * 60)) % 60);

  if (hours <= 0 && minutes <= 0) {
    return past ? "LIVE" : "NOW";
  }

  if (hours <= 0) {
    return `${minutes}M`;
  }

  return `${hours}H ${minutes.toString().padStart(2, "0")}M`;
}

export function formatRelativePast(value: string | Date) {
  const delta = Date.now() - toDate(value).getTime();
  const minutes = Math.floor(delta / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) {
    return "JUST NOW";
  }
  if (hours < 1) {
    return `${minutes}M AGO`;
  }
  if (days < 1) {
    return `${hours}H AGO`;
  }
  return `${days}D AGO`;
}

export function formatProgress(completed: number, total: number) {
  if (!total) {
    return 0;
  }

  return Math.round((completed / total) * 100);
}
