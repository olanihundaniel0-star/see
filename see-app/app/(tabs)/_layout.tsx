import { Link, Tabs } from "expo-router";
import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

export default function TabsLayout() {
  return (
    <View className="flex-1 bg-black">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#FFFFFF",
          tabBarInactiveTintColor: "#71717A",
          tabBarStyle: {
            backgroundColor: "rgba(9, 9, 11, 0.96)",
            borderTopColor: "rgba(255,255,255,0.08)",
            height: 74
          },
          tabBarLabelStyle: {
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: 1.5
          }
        }}
        >
        <Tabs.Screen name="index" options={{ title: "TODAY" }} />
        <Tabs.Screen name="jobs" options={{ title: "PIPELINE" }} />
        <Tabs.Screen name="events" options={{ title: "RADAR" }} />
        <Tabs.Screen name="notes" options={{ title: "VAULT" }} />
        <Tabs.Screen name="reminders" options={{ title: "ALERTS" }} />
        <Tabs.Screen name="account" options={{ title: "ACCOUNT" }} />
      </Tabs>

      <Link href="/modal/quick-add" asChild>
        <Pressable
          onPress={() => void Haptics.selectionAsync()}
          className="absolute bottom-5 right-5 h-14 w-14 items-center justify-center rounded-xl border border-white/20 bg-zinc-950/90 shadow-glass"
        >
          <Text className="font-mono text-lg text-white">[+]</Text>
        </Pressable>
      </Link>
    </View>
  );
}
