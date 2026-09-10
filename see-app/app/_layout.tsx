import "@/global.css";

import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "react-native";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

const queryClient = new QueryClient();

export default function RootLayout() {
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={client}>
          <BottomSheetModalProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#000000" } as any
              }}
            >
              {authLoading ? <Stack.Screen name="auth" /> : null}
              {!authLoading && !session ? <Stack.Screen name="auth" /> : null}
              {!authLoading && session ? <Stack.Screen name="(tabs)" /> : null}
              {!authLoading && session ? (
                <Stack.Screen
                  name="modal/quick-add"
                  options={{
                    presentation: "modal"
                  }}
                />
              ) : null}
              {!authLoading && session ? <Stack.Screen name="jobs/[id]" /> : null}
            </Stack>
            <StatusBar barStyle="light-content" />
          </BottomSheetModalProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
