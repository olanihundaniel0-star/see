import { isAxiosError, isCancel } from "axios";

function isTransientFailure(error: unknown): boolean {
  if (isCancel(error) || !isAxiosError(error)) return false;
  if (!error.response) return true;
  return [502, 503, 504].includes(error.response.status);
}

export function transientRetry(count: number, error: unknown): boolean {
  return count < 1 && isTransientFailure(error);
}

// The production API runs on a host that can take ~45s to wake from sleep.
// Only the first dashboard paint gets a bounded multi-attempt budget; every
// other query keeps the single-retry policy.
export function coldStartRetry(count: number, error: unknown): boolean {
  return count < 3 && isTransientFailure(error);
}

export function coldStartRetryDelay(attempt: number): number {
  return Math.min(1500 * 2 ** attempt, 5000);
}
