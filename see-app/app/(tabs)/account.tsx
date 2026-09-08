import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import type { Session } from "@supabase/supabase-js";

import { GlassCard } from "@/components/glass/GlassCard";
import { GlassPill } from "@/components/glass/GlassPill";
import { AsciiBanner } from "@/components/ui/AsciiBanner";
import { formatShortDateTime } from "@/lib/format";
import { supabase } from "@/lib/supabase";

function describeProvider(session: Session | null) {
  const provider = session?.user.app_metadata?.provider;
  if (typeof provider === "string" && provider.trim()) {
    return provider.toUpperCase();
  }
  return "LOCAL";
}

export default function AccountScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const onSignOut = async () => {
    if (!supabase) {
      Alert.alert("Supabase is not configured", "Set the app environment variables before signing out.");
      return;
    }

    try {
      await Haptics.selectionAsync();
      setSigningOut(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
    } catch (error) {
      Alert.alert("Sign out failed", error instanceof Error ? error.message : "Unable to clear the session.");
    } finally {
      setSigningOut(false);
    }
  };

  const user = session?.user ?? null;
  const provider = describeProvider(session);

  return (
    <ScrollView className="flex-1 bg-black" contentContainerClassName="px-4 pb-28 pt-4">
      <View className="gap-4">
        <AsciiBanner title="// ACCESS_NODE" subtitle="Session controls and identity details" right={loading ? "[SYNCING]" : "[ONLINE]"} />

        <GlassCard className="gap-4">
          <View className="flex-row items-start justify-between gap-3">
            <View className="gap-1">
              <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">// AUTH_SUBJECT</Text>
              <Text className="text-xl font-bold text-white">{user?.email ?? "Unknown account"}</Text>
              <Text className="font-mono text-[11px] text-zinc-400">{user?.id ?? "No active session"}</Text>
            </View>
            <GlassPill label="PROVIDER" value={provider} tone="active" />
          </View>

          <View className="flex-row gap-2">
            <GlassPill label="SESSION" value={session ? "ACTIVE" : "SIGNED OUT"} className="flex-1" />
            <GlassPill label="USER ROLE" value={user?.role?.toUpperCase() ?? "UNKNOWN"} className="flex-1" />
          </View>

          <View className="rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-3">
            <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">// TIMESTAMPS</Text>
            <Text className="mt-2 font-mono text-[11px] leading-5 text-zinc-300">
              {user?.created_at ? `Created: ${formatShortDateTime(user.created_at)}` : "Created: unknown"}
              {"\n"}
              {session?.expires_at ? `Expires: ${formatShortDateTime(new Date(session.expires_at * 1000).toISOString())}` : "Expires: unknown"}
            </Text>
          </View>

          <Pressable
            disabled={!session || signingOut}
            onPress={() => void onSignOut()}
            className="rounded-xl border border-white/20 bg-white px-4 py-4 disabled:opacity-50"
          >
            <Text className="text-center font-mono text-[12px] font-bold tracking-[0.08em] text-black">
              {signingOut ? "[ SIGNING OUT... ]" : "[ SIGN OUT ]"}
            </Text>
          </Pressable>
        </GlassCard>

        <GlassCard className="gap-3">
          <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">// SESSION_NOTES</Text>
          <Text className="font-mono text-[11px] leading-5 text-zinc-400">
            This screen exists so the app has a clear exit path from the authenticated shell. Signing out clears the Supabase
            session and returns you to the login gateway.
          </Text>
        </GlassCard>
      </View>
    </ScrollView>
  );
}
