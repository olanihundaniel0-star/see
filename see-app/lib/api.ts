import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";

import { supabase } from "@/lib/supabase";

const baseURL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL,
  timeout: 15000
});

api.interceptors.request.use(async (config) => {
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

function isTransientRefreshError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "AuthRetryableFetchError"
  );
}

let refreshPromise: Promise<boolean> | null = null;

function refreshSessionOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      if (!supabase) return false;
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data.session) return true;

      // A transient/network failure must not log the user out; only a definitive
      // rejection means the refresh token is no longer usable.
      if (error && !isTransientRefreshError(error)) {
        await supabase.auth.signOut().catch(() => undefined);
      }
      return false;
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

  // Already retried (or unretryable): the session cannot authenticate this API.
  // Signing out flips the root guard and routes the user back to /auth.
  await supabase?.auth.signOut().catch(() => undefined);
  return Promise.reject(error);
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      return handleUnauthorized(error.config as RetryableConfig | undefined, error);
    }
    return Promise.reject(error);
  }
);
