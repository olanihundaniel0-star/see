import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import { GlassCard } from "@/components/glass/GlassCard";
import { GlassPill } from "@/components/glass/GlassPill";
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

  return (
    <>
      <Stack.Screen options={{ title: "Secure Gateway", headerShown: false }} />
      <ScrollView className="flex-1 bg-black" contentContainerClassName="min-h-full px-4 pb-10 pt-16">
        <View className="flex-1 gap-5">
          <View className="gap-2">
            <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">{"// SEE_OS"}</Text>
            <Text className="text-4xl font-sans-bold tracking-[-1px] text-white">SECURE_GATEWAY_AUTH</Text>
            <Text className="font-mono text-[11px] leading-5 text-[#c5c6ca]">
              Authenticate to access the career operations console.
            </Text>
          </View>

          <GlassCard className="gap-4">
            <View className="flex-row items-center justify-between">
              <GlassPill label="PROTOCOL" value="OAUTH2" tone="active" />
              <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">{callbackReady ? "[READY]" : "[WAITING]"}</Text>
            </View>
            <Pressable
              disabled={Boolean(pendingProvider)}
              onPress={() => void signIn("google")}
              className="rounded-xl bg-white px-4 py-4 disabled:opacity-60"
            >
              <Text className="text-center font-mono-bold text-[12px] tracking-[0.08em] text-black">
                {pendingProvider === "google" ? "[ AUTHENTICATING... ]" : "[ SIGN IN WITH GOOGLE ]"}
              </Text>
            </Pressable>
            <Pressable
              disabled={Boolean(pendingProvider)}
              onPress={() => void signIn("github")}
              className="rounded-xl border border-white/10 bg-zinc-900 px-4 py-4 disabled:opacity-60"
            >
              <Text className="text-center font-mono-bold text-[12px] tracking-[0.08em] text-white">
                {pendingProvider === "github" ? "[ DISPATCHING... ]" : "CONTINUE_WITH_GITHUB"}
              </Text>
            </Pressable>
          </GlassCard>

<View className="rounded-xl bg-zinc-950/80 p-4">
            <Text className="font-mono text-[9px] tracking-[0.08em] text-zinc-600">{"// ARCHIVE_FRAGMENT_0x0"}</Text>
            <Text className="mt-4 text-center font-mono text-[9px] leading-[10px] text-zinc-700">
              {"     ____________________\n    | > ./see_os --gate  |\n    | > gw ........ [OK]  |\n    | > radar ... [SWEEP] |\n    | > _                  |\n     \\____________________/"}
            </Text>
            <Text className="mt-4 text-center font-mono text-[11px] text-zinc-600">Gateway online. Sweeping career signals from the dark.</Text>
          </View>

          <View className="mt-auto gap-2">
            <View className="flex-row items-center justify-between rounded-lg bg-zinc-900 px-3 py-2">
              <Text className="font-mono text-[10px] text-[#c5c6ca]">EXPO_SECURE_STORE</Text>
              <Text className="font-mono text-[10px] text-white">[ACTIVE]</Text>
            </View>
            <Text className="text-center font-mono text-[10px] text-zinc-600">SECURED BY SUPABASE_AUTH</Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
