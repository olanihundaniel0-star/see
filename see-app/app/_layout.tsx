import "@/global.css";

import { useEffect, useRef, useState } from "react";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { View, StatusBar } from "react-native";
import type { Session } from "@supabase/supabase-js";
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold
} from "@expo-google-fonts/space-grotesk";
import { SpaceMono_400Regular, SpaceMono_700Bold } from "@expo-google-fonts/space-mono";

import { NotificationBridge } from "@/components/NotificationBridge";
import { AccountContext } from "@/lib/session";
import { transientRetry } from "@/lib/queryPolicy";
import { supabase } from "@/lib/supabase";
import BootScreen from "@/components/ui/BootScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { theme } from "@/constants/theme";
import { AppText, Button } from "@/components/ui/primitives";

const queryClient = new QueryClient({ defaultOptions: { queries: {
  staleTime: 60_000,
  gcTime: 5 * 60_000,
  // One retry owner: only transient transport/server failures get a second
  // attempt. Permanent 4xx responses and cancellations never retry.
  retry: transientRetry,
  retryDelay: 1500,
  refetchOnWindowFocus: false
} } });

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold
  });
  const [client] = useState(queryClient);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const identity = useRef<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    const acceptSession = (nextSession: Session | null) => {
      const nextId = nextSession?.user.id ?? null;
      if (nextId !== identity.current) {
        void client.cancelQueries();
        client.clear();
        identity.current = nextId;
      }
      setSession(nextSession);
      setAuthLoading(false);
    };
    void supabase.auth.getSession().then(({ data }) => acceptSession(data.session)).catch(() => setAuthLoading(false));

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      acceptSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, [client]);

  const [bootDone, setBootDone] = useState(false);
  const [mountedAt] = useState(() => Date.now());
  const fontsReady = fontsLoaded || !!fontError;

  // Ready-gate: boot completes when fonts are ready AND auth has resolved.
  useEffect(() => {
    if (!fontsReady || authLoading) return;
    const elapsed = Date.now() - mountedAt;
    const remaining = Math.max(0, 600 - elapsed);
    const timer = setTimeout(() => setBootDone(true), remaining);
    return () => clearTimeout(timer);
  }, [fontsReady, authLoading, mountedAt]);

  // Max fallback: never trap the user on the splash screen.
  useEffect(() => {
    const timer = setTimeout(() => setBootDone(true), 10_000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={client}>
            <AccountContext.Provider value={session?.user.id ?? null}>
            <BottomSheetModalProvider>
              {!bootDone ? (
                <BootScreen />
              ) : authLoading ? (
                <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 16, backgroundColor: theme.colors.background }}>
                  <AppText>Restoring your session is taking longer than expected.</AppText>
                  <Button label="Retry connection" onPress={() => { void supabase?.auth.getSession().then(({ data }) => { setSession(data.session); setAuthLoading(false); }).catch(() => setAuthLoading(false)); }} />
                </View>
              ) : (
                <AppNavigator session={session} authLoading={authLoading} />
              )}
            </BottomSheetModalProvider>
          </AccountContext.Provider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

function AppNavigator({ session, authLoading }: { session: Session | null; authLoading: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background, paddingTop: insets.top }
        }}
      >
        <Stack.Protected guard={!authLoading && !session}>
          <Stack.Screen name="auth" />
        </Stack.Protected>
        <Stack.Protected guard={!authLoading && !!session}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="modal/quick-add"
            options={{
              presentation: "modal"
            }}
          />
          <Stack.Screen name="jobs/[id]" />
          <Stack.Screen name="notes/[id]" />
          <Stack.Screen name="reminders/[id]" />
        </Stack.Protected>
      </Stack>
      <NotificationBridge userId={session?.user.id ?? null} />
      <StatusBar barStyle="light-content" />
    </>
  );
}
