import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";
import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

declare const __DEV__: boolean | undefined;

// Fail loud when the API URL is missing. Localhost fallback is only for web dev.
const ENV_URL = process.env.EXPO_PUBLIC_API_URL;
const IS_DEV = typeof __DEV__ !== "undefined" ? __DEV__ : process.env.NODE_ENV !== "production";

function resolveBaseURL(): string {
  if (ENV_URL) {
    const url = new URL(ENV_URL);
    const privateHost = /^(localhost$|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|\[::1\]$)/.test(url.hostname);
    if (!IS_DEV && (url.protocol !== "https:" || privateHost)) {
      throw new Error("Release builds require a public HTTPS EXPO_PUBLIC_API_URL.");
    }
    return ENV_URL.replace(/\/$/, "");
  }
  console.error(
    "[api] EXPO_PUBLIC_API_URL is missing. Set it in .env / EAS env (e.g. EXPO_PUBLIC_API_URL=https://api.example.com/api/v1)."
  );
  if (IS_DEV && Platform.OS === "web") {
    return "http://localhost:8000/api/v1";
  }
  throw new Error(
    "[api] EXPO_PUBLIC_API_URL is missing. Set it in .env / EAS env (e.g. EXPO_PUBLIC_API_URL=https://api.example.com/api/v1)."
  );
}

const baseURL = resolveBaseURL();

/** Start waking a sleeping API while fonts/session/cache restore in parallel. */
export async function warmBackend(signal: AbortSignal): Promise<boolean> {
  for (let attempt = 0; attempt < 10 && !signal.aborted; attempt++) {
    try {
      await axios.get(new URL("/health", baseURL).toString(), { timeout: 6_000, signal });
      return true;
    } catch {
      if (signal.aborted) return false;
      await new Promise<void>(resolve => {
        const finish = () => { clearTimeout(timer); signal.removeEventListener("abort", finish); resolve(); };
        const timer = setTimeout(finish, 2_000);
        signal.addEventListener("abort", finish, { once: true });
      });
    }
  }
  return false;
}

export const api = axios.create({
  baseURL,
  timeout: 10000
});

// Cache the access token via subscription so we don't call getSession() on every request.
let cachedAccessToken: string | null = null;
let authCachePrimed = false;

if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedAccessToken = session?.access_token ?? null;
    authCachePrimed = true;
  });
}

api.interceptors.request.use(async (config) => {
  if (supabase) {
    let token = cachedAccessToken;
    if (!authCachePrimed) {
      // Cache miss: fall back to a one-time getSession() and prime the cache.
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token ?? null;
      cachedAccessToken = token;
      authCachePrimed = true;
    }
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean; _networkRetry?: boolean };

function isTransientRefreshError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "AuthRetryableFetchError"
  );
}

function messageOf(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const maybe = error as { message?: unknown; code?: unknown; error?: unknown };
    const parts: string[] = [];
    if (typeof maybe.message === "string") parts.push(maybe.message);
    if (typeof maybe.code === "string") parts.push(maybe.code);
    if (typeof maybe.error === "string") parts.push(maybe.error);
    return parts.join(" ");
  }
  return String(error ?? "");
}

// Network TypeErrors, timeouts, aborts, and no-response errors are transient:
// they must never trigger a sign-out.
function isTransientNetworkError(error: unknown): boolean {
  if (isTransientRefreshError(error)) return true;
  if (error instanceof TypeError) return true;
  if (!axios.isAxiosError(error)) return false;
  if (error.response) return false;
  const code = (error.code ?? "").toUpperCase();
  if (
    ["ECONNABORTED", "ETIMEDOUT", "ERR_NETWORK", "ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "ECONNREFUSED"].includes(
      code
    ) ||
    code.includes("ERR_INTERNET_DISCONNECTED") ||
    code.includes("ERR_CONNECTION")
  ) {
    return true;
  }
  const msg = (error.message ?? "").toLowerCase();
  if (
    msg.includes("network error") ||
    msg.includes("timeout") ||
    msg.includes("econnaborted") ||
    msg.includes("fetch failed") ||
    msg.includes("network request failed") ||
    msg.includes("load failed")
  ) {
    return true;
  }
  if ((error as { name?: string }).name === "TypeError") return true;
  // No response received at all -> treat as transient, never sign out.
  return error.request != null || error.code == null;
}

// Explicit refresh-token rejection (invalid_grant and friends).
function isInvalidGrantError(error: unknown): boolean {
  const msg = messageOf(error).toLowerCase();
  return (
    msg.includes("invalid_grant") ||
    msg.includes("invalid refresh") ||
    msg.includes("refresh_token_not_found") ||
    msg.includes("refresh token not found") ||
    /refresh token.*(expired|revoked|invalid|not found)/.test(msg)
  );
}


let refreshPromise: Promise<boolean> | null = null;

function refreshSessionOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      if (!supabase) return false;
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (!error && data.session) {
          return true;
        }
        if (!error) return false;
        // Transient/network failure must not log the user out.
        if (isTransientNetworkError(error) || isTransientRefreshError(error)) {
          return false;
        }
        // Only an explicit invalid-grant means the refresh token is unusable.
        if (isInvalidGrantError(error)) {
          await supabase.auth.signOut().catch(() => undefined);
        }
        return false;
      } catch (error) {
        // Thrown errors (e.g. network TypeError): never sign out unless invalid-grant.
        if (isInvalidGrantError(error)) {
          await supabase?.auth.signOut().catch(() => undefined);
        }
        return false;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function handleUnauthorized(config: RetryableConfig | undefined, error: AxiosError) {
  if (config && !config._retry) {
    config._retry = true;
    if (await refreshSessionOnce()) {
      return api(config);
    }
    return Promise.reject(error);
  }

  // 401 after retry: session cannot authenticate this API -> sign out.
  // Never sign out on transient network failures.
  if (isTransientNetworkError(error)) {
    return Promise.reject(error);
  }
  await supabase?.auth.signOut().catch(() => undefined);
  return Promise.reject(error);
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      return handleUnauthorized(error.config as RetryableConfig | undefined, error);
    }
    return Promise.reject(error);
  }
);
