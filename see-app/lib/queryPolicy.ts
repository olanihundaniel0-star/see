import { isAxiosError, isCancel } from "axios";

function isTransientFailure(error: unknown): boolean {
  if (isCancel(error) || !isAxiosError(error)) return false;
  if (!error.response) return true;
  return [502, 503, 504].includes(error.response.status);
}

// The production API cold-starts on Render in 45-55s. All initial queries
// must survive a full cold start: five attempts against the 10s client
// timeout plus capped delays give every query ~64.5s of total coverage.
export function coldStartRetry(count: number, error: unknown): boolean {
  return count < 4 && isTransientFailure(error);
}

export function coldStartRetryDelay(attempt: number): number {
  return Math.min(1500 * 2 ** attempt, 5000);
}
