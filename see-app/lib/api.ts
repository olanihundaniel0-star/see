import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";
import { router } from "expo-router";

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

let redirectingToAuth = false;

async function handleUnauthorized(config: RetryableConfig | undefined, error: AxiosError) {
  if (config && !config._retry) {
    config._retry = true;

    if (supabase) {
      const { data, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && data.session) {
        return api(config);
      }
      await supabase.auth.signOut().catch(() => undefined);
    }
  }

  if (!redirectingToAuth) {
    redirectingToAuth = true;
    router.replace("/auth");
    setTimeout(() => {
      redirectingToAuth = false;
    }, 1000);
  }

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
