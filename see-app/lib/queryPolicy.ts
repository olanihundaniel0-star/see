import { isAxiosError, isCancel } from "axios";

export function isTransientFailure(error: unknown): boolean {
  if (isCancel(error) || !isAxiosError(error)) return false;
  if (!error.response) return true;
  return [502, 503, 504].includes(error.response.status);
}

// Fail visibly after ~21s rather than holding every screen in a minute-long
// skeleton. Startup readiness probing separately recovers a sleeping backend.
export function coldStartRetry(count: number, error: unknown): boolean {
  return count < 1 && isTransientFailure(error);
}

export function coldStartRetryDelay(attempt: number): number {
  return Math.min(750 * 2 ** attempt, 1500);
}
