import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

const storage =
  Platform.OS === "web"
    ? {
        getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
        setItem: (key: string, value: string) => {
          localStorage.setItem(key, value);
          return Promise.resolve();
        },
        removeItem: (key: string) => {
          localStorage.removeItem(key);
          return Promise.resolve();
        }
      }
    : {
        async getItem(key: string) {
          return SecureStore.getItemAsync(key);
        },
        async setItem(key: string, value: string) {
          await SecureStore.setItemAsync(key, value);
        },
        async removeItem(key: string) {
          await SecureStore.deleteItemAsync(key);
        }
      };

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: "pkce"
        }
      })
    : null;

// OAuth callback URL. Built with expo-linking so it works in Expo Go
// (exp://<host>:8081/--/auth) AND in development/production builds (see://auth).
// Add the resolved URL to Supabase: Auth -> URL Configuration -> Redirect URLs.
export const supabaseRedirectUrl = Linking.createURL("/auth");
