import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import { supabase, supabaseRedirectUrl } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

function readAuthParams(url: string) {
  const parsed = new URL(url);
  const searchParams = parsed.searchParams;
  const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  return { searchParams, hashParams };
}

async function completeOAuth(url: string) {
  if (!supabase) {
    return;
  }

  const { searchParams, hashParams } = readAuthParams(url);
  const code = searchParams.get("code") ?? hashParams.get("code");
  const flowId = searchParams.get("sb_flow_id") ?? hashParams.get("sb_flow_id") ?? undefined;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    if (error) {
      throw error;
    }
    return;
  }

  const accessToken = hashParams.get("access_token") ?? searchParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token") ?? searchParams.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) {
      throw error;
    }
  }
}

export default function AuthScreen() {
  const [pendingProvider, setPendingProvider] = useState<"google" | "github" | null>(null);
  const [callbackReady, setCallbackReady] = useState(false);

  useEffect(() => {
    const handleUrl = (url: string | null | undefined) => {
      if (!url) return;
      void completeOAuth(url)
        .catch((error) => Alert.alert("Authentication failed", error instanceof Error ? error.message : "Unable to complete sign in."))
        .finally(() => setCallbackReady(true));
    };

    void Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);

  const signIn = async (provider: "google" | "github") => {
    if (!supabase) {
      Alert.alert("Supabase is not configured", "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to see-app/.env.");
      return;
    }

    try {
      setPendingProvider(provider);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: supabaseRedirectUrl,
          skipBrowserRedirect: true
        }
      });
      if (error) throw error;
      if (!data.url) throw new Error("Unable to start OAuth sign in.");

      const result = await WebBrowser.openAuthSessionAsync(data.url, supabaseRedirectUrl);
      if (result.type === "success" && result.url) {
        await completeOAuth(result.url);
      }
    } catch (error) {
      Alert.alert("Authentication failed", error instanceof Error ? error.message : "Unable to start OAuth sign in.");
    } finally {
      setPendingProvider(null);
    }
  };

  const hudMessage =
    pendingProvider === "google"
      ? "HANDSHAKE_INITIATED // GOOGLE_ID"
      : pendingProvider === "github"
        ? "OAUTH2_DISPATCH // GITHUB_NET"
        : null;

  return (
    <>
      <Stack.Screen options={{ title: "Secure Gateway", headerShown: false }} />
      <ScrollView className="flex-1 bg-black" contentContainerClassName="min-h-full px-4 pb-10 pt-16">
        <View className="flex-1 gap-5">
          {/* Telemetry strip */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Text className="font-mono-bold text-[10px] text-white">{"\u25CF"}</Text>
              <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-white">[SYS_ACTIVE]</Text>
            </View>
            <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#8f9194]">{"// PORT_ESTABLISHED"}</Text>
          </View>

          {/* Wordmark block */}
          <View className="items-center gap-2">
            <View className="flex-row items-center gap-2">
              <Text className="font-mono-bold text-[10px] text-white">{"\u25CF"}</Text>
              <Text className="font-mono-bold text-[12px] tracking-[0.05em] text-[#c5c6ca]">[SYS_INITIALIZE]</Text>
              <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#8f9194]">:: REV_4.09</Text>
            </View>
            <Text className="font-sans-bold text-[36px] leading-[40px] tracking-[-1.4px] text-white">SEE</Text>
            <View className="rounded-lg bg-[#1b1b1b] px-3 py-1">
              <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-white">SINGLE_PANE_ORGANIZER</Text>
            </View>
            <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#8f9194]">{"<-- [\u25A0\u25A0\u25A0\u25A1\u25A1] RADAR_SYNC -->"}</Text>
          </View>

          {/* Auth slab */}
          <View className="gap-4 rounded-xl bg-[#1b1b1b]/90 p-5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Text className="font-mono-bold text-[12px] tracking-[0.05em] text-white">{"terminal>"}</Text>
                <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-white">SECURE_GATEWAY_AUTH</Text>
              </View>
              <View className="rounded bg-[#2a2a2a] px-2 py-1">
                <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#c5c6ca]">ID: 04-98A</Text>
              </View>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#8f9194]">{"// OAUTH2"}</Text>
              <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#8f9194]">
                {callbackReady ? "[READY]" : "[WAITING]"}
              </Text>
            </View>

            <Pressable
              disabled={Boolean(pendingProvider)}
              onPress={() => void signIn("google")}
              className="flex-row items-center justify-center gap-2 rounded bg-white px-4 py-4 disabled:opacity-60 active:scale-[0.98]"
            >
              <Text className="font-mono-bold text-[14px] text-[#2f3033]">G</Text>
              <Text className="font-mono-bold text-[12px] tracking-[0.05em] text-[#2f3033]">
                {pendingProvider === "google" ? "[ AUTHENTICATING... ]" : "[ SIGN IN WITH GOOGLE ]"}
              </Text>
            </Pressable>
            <Pressable
              disabled={Boolean(pendingProvider)}
              onPress={() => void signIn("github")}
              className="flex-row items-center justify-center gap-2 rounded bg-[#1f1f1f] px-4 py-4 disabled:opacity-60 active:scale-[0.98]"
            >
              <Text className="font-mono-bold text-[14px] text-[#e2e2e2]">{"{}"}</Text>
              <Text className="font-mono-bold text-[12px] tracking-[0.05em] text-[#e2e2e2]">
                {pendingProvider === "github" ? "[ DISPATCHING... ]" : "CONTINUE_WITH_GITHUB"}
              </Text>
            </Pressable>
          </View>

          {/* HUD toast (pending state) */}
          {hudMessage ? (
            <View className="flex-row items-center justify-between rounded-xl bg-[#2a2a2a]/95 px-4 py-3">
              <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-white">{hudMessage}</Text>
              <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#8f9194]">[PENDING]</Text>
            </View>
          ) : null}

          {/* Deco pod */}
          <View className="items-center rounded-xl bg-[#0e0e0e]/80 p-4">
            <View className="w-full flex-row items-center justify-between">
              <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#8f9194]">{"// ARCHIVE"}</Text>
              <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#c5c6ca]">[ANSI]</Text>
            </View>
            <Text className="mt-4 text-center font-mono text-[9px] leading-[10px] text-zinc-700">
              {"     ____________________\n    | > ./see_os --gate  |\n    | > gw ........ [OK]  |\n    | > radar ... [SWEEP] |\n    | > _                  |\n     \\____________________/"}
            </Text>
            <Text className="mt-4 text-center font-mono text-[11px] text-zinc-600">Gateway online. Sweeping career signals from the dark.</Text>
          </View>

          {/* Footer */}
          <View className="mt-auto gap-2">
            <View className="flex-row items-center justify-between rounded-lg bg-[#1b1b1b] px-3 py-2">
              <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#c5c6ca]">EXPO_SECURE_STORE</Text>
              <View className="flex-row items-center gap-1">
                <Text className="font-mono-bold text-[10px] text-white">{"\u25CF"}</Text>
                <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-white">[ACTIVE]</Text>
              </View>
            </View>
            <View className="flex-row items-center justify-between rounded-lg bg-[#0e0e0e] px-3 py-2">
              <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#8f9194]">PROTOCOL</Text>
              <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#c5c6ca]">{"// RSA_256"}</Text>
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1 items-center rounded-lg bg-[#0e0e0e] px-2 py-2">
                <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#8f9194]">NODE</Text>
                <Text className="mt-1 font-mono-bold text-[12px] tracking-[0.05em] text-white">US-EAST</Text>
              </View>
              <View className="flex-1 items-center rounded-lg bg-[#0e0e0e] px-2 py-2">
                <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#8f9194]">LATENCY</Text>
                <Text className="mt-1 font-mono-bold text-[12px] tracking-[0.05em] text-white">14ms</Text>
              </View>
              <View className="flex-1 items-center rounded-lg bg-[#0e0e0e] px-2 py-2">
                <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#8f9194]">SESSION</Text>
                <Text className="mt-1 font-mono-bold text-[12px] tracking-[0.05em] text-white">SEALED</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
