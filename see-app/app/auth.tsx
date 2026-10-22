import { useEffect, useState } from "react";
import { Alert, Linking, View } from "react-native";
import { AppText, Button, Screen } from "@/components/ui/primitives";
import { GlassCard } from "@/components/glass/GlassCard";
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

  useEffect(() => {
    const handleUrl = (url: string | null | undefined) => {
      if (!url) return;
      void completeOAuth(url)
        .catch((error) => Alert.alert("Authentication failed", error instanceof Error ? error.message : "Unable to complete sign in."));
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

  return <Screen contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingVertical: 48 }}>
    <Stack.Screen options={{ title: "Welcome to SEE", headerShown: false }} />
    <View style={{ gap: 16, marginBottom: 24 }}>
      <AppText variant="code" muted>{"// SEE"}</AppText>
      <AppText variant="title" style={{ fontSize: 36, lineHeight: 42 }}>Space for your next step.</AppText>
      <AppText muted>Applications, ideas, and the things you want to get done. Together in one place.</AppText>
    </View>
    <GlassCard style={{ gap: 16, padding: 24 }}>
      <AppText variant="heading">Welcome to SEE</AppText>
      <AppText muted>Sign in to keep your work with you.</AppText>
      <Button label={pendingProvider === "google" ? "Signing in…" : "Continue with Google"} busy={pendingProvider === "google"} disabled={!!pendingProvider} onPress={() => void signIn("google")} />
      <Button label={pendingProvider === "github" ? "Signing in…" : "Continue with GitHub"} icon="github" variant="secondary" busy={pendingProvider === "github"} disabled={!!pendingProvider} onPress={() => void signIn("github")} />
    </GlassCard>
    {pendingProvider ? <AppText variant="meta" muted accessibilityLiveRegion="polite">Complete sign-in in your browser to continue.</AppText> : null}
    <AppText variant="meta" muted style={{ textAlign: "center", marginTop: 16 }}>Your notes, applications, and reminders stay in your account.</AppText>
  </Screen>;
}
