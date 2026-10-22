import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { AppText, Button, Screen, ScreenHeader } from "@/components/ui/primitives";
import * as Haptics from "expo-haptics";
import type { Session } from "@supabase/supabase-js";

import { GlassCard } from "@/components/glass/GlassCard";
import { formatShortDateTime } from "@/lib/format";
import { NotificationSettings } from "@/components/NotificationSettings";
import { unregisterNotifications } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";

function describeProvider(session: Session | null) {
  const provider = session?.user.app_metadata?.provider;
  if (typeof provider === "string" && provider.trim()) {
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  }
  return "your account";
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
    }).catch(() => setLoading(false));

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

    let alertsRevoked = true;
    try {
      await Haptics.selectionAsync();
      setSigningOut(true);
      if (session?.user.id) {
        try {
          await unregisterNotifications(session.user.id);
        } catch {
          // Never trap the user in an account because token revocation is offline.
          alertsRevoked = false;
        }
      }
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      if (!alertsRevoked) {
        Alert.alert("Signed out", "This device could not reach SEE to revoke alerts. Alerts may continue until this device signs in again or the push token expires.");
      }
    } catch (error) {
      Alert.alert("Sign out failed", error instanceof Error ? error.message : "Unable to clear the session.");
    } finally {
      setSigningOut(false);
    }
  };

  const user = session?.user ?? null;
  const provider = describeProvider(session);

  return <Screen form>
    <ScreenHeader title="Account" back account={false} />
    <GlassCard>
      <AppText variant="heading">{loading ? "Loading account…" : user?.email ?? "Account unavailable"}</AppText>
      <AppText muted>Signed in with {provider}</AppText>
      {user?.created_at ? <AppText variant="meta" muted>Member since {formatShortDateTime(user.created_at)}</AppText> : null}
    </GlassCard>
    <NotificationSettings />
    <View style={{ gap: 12, paddingTop: 16 }}>
      <Button label="Sign out" variant="secondary" disabled={!session} busy={signingOut} onPress={() => Alert.alert("Sign out of SEE?", "You can sign in again to access your saved work.", [{ text: "Cancel", style: "cancel" }, { text: "Sign out", onPress: () => void onSignOut() }])} />
    </View>
  </Screen>;
}
