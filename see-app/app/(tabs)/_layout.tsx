import { Link, Tabs } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-black">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#FFFFFF",
          tabBarInactiveTintColor: "#c5c6ca",
          tabBarStyle: {
            backgroundColor: "rgba(19, 19, 19, 0.8)",
            borderTopColor: "rgba(255,255,255,0.08)",
            borderTopWidth: 1,
            height: 64
          } as any,
          tabBarLabelStyle: {
            fontFamily: "SpaceMono_700Bold",
            fontSize: 10,
            letterSpacing: 0.8
          } as any
        }}
        >
        <Tabs.Screen name="index" options={{ title: "TODAY [\u25CF]" }} />
        <Tabs.Screen name="jobs" options={{ title: "PIPELINE" }} />
        <Tabs.Screen name="events" options={{ title: "RADAR" }} />
        <Tabs.Screen name="notes" options={{ title: "VAULT" }} />
        <Tabs.Screen name="reminders" options={{ title: "ALERTS" }} />
        <Tabs.Screen name="account" options={{ title: "ACCOUNT" }} />
      </Tabs>

      <Link href="/modal/quick-add" asChild>
        <Pressable
          onPress={() => void Haptics.selectionAsync()}
          style={{ bottom: insets.bottom + 96 }}
          className="absolute right-5 z-10 h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-[#2a2a2a]/90"
        >
          <Text className="font-mono-bold text-[16px] text-white">[+]</Text>
        </Pressable>
      </Link>
    </View>
  );
}
