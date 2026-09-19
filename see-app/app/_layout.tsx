import "@/global.css";

import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "react-native";
import type { Session } from "@supabase/supabase-js";
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold
} from "@expo-google-fonts/space-grotesk";
import { SpaceMono_400Regular, SpaceMono_700Bold } from "@expo-google-fonts/space-mono";

import { supabase } from "@/lib/supabase";
import BootScreen from "@/components/ui/BootScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const queryClient = new QueryClient();

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

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const [bootDone, setBootDone] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setBootDone(true), 10_000);
    return () => clearTimeout(timer);
  }, []);

  const fontsReady = fontsLoaded || fontError;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={client}>
          <BottomSheetModalProvider>
            {!bootDone || !fontsReady ? (
              <BootScreen />
            ) : (
              <ErrorBoundary>
                <AppNavigator session={session} authLoading={authLoading} />
              </ErrorBoundary>
            )}
          </BottomSheetModalProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppNavigator({ session, authLoading }: { session: Session | null; authLoading: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#000000", paddingTop: insets.top } as any
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
      <StatusBar barStyle="light-content" />
    </>
  );
}
