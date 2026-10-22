import { Tabs, router, usePathname } from "expo-router";
import { Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/ui/primitives";
import { theme } from "@/constants/theme";

const tabs: { name: string; title: string; icon: IconName }[] = [
  { name: "index", title: "Today", icon: "target" },
  { name: "jobs", title: "Jobs", icon: "briefcase" },
  { name: "events", title: "Events", icon: "radio" },
  { name: "notes", title: "Notes", icon: "file-text" },
  { name: "reminders", title: "Tasks", icon: "check-square" }
];
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 840;
  const path = usePathname();
  const mode = path.includes("notes") ? "note" : path.includes("reminders") ? "reminder" : "job";
  return <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
    <Tabs screenOptions={{
      headerShown: false,
      tabBarPosition: wide ? "left" : "bottom",
      tabBarActiveTintColor: theme.colors.primary,
      tabBarInactiveTintColor: theme.colors.textMuted,
      tabBarHideOnKeyboard: true,
      tabBarStyle: { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border, borderRightColor: theme.colors.border, ...(wide ? { width: 160 } : { height: 64 + insets.bottom, paddingBottom: insets.bottom, paddingTop: 8 }) },
      tabBarLabelStyle: { fontFamily: "SpaceGrotesk_500Medium", fontSize: 12 },
      tabBarItemStyle: { minHeight: 48 }
    }}>
      {tabs.map(tab => <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title, tabBarIcon: ({ color, size }) => <Icon name={tab.icon} color={color} size={size} /> }} />)}
      <Tabs.Screen name="account" options={{ href: null }} />
    </Tabs>
    {!path.includes("account") ? <Pressable accessibilityRole="button" accessibilityLabel="Quick add" onPress={() => router.push({ pathname: "/modal/quick-add", params: { mode } })}
      style={({ pressed }) => ({ position: "absolute", right: 20, bottom: wide ? 24 + insets.bottom : 80 + insets.bottom, width: 56, height: 56, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.primary, opacity: pressed ? 0.75 : 1 })}>
      <Icon name="plus" color={theme.colors.background} size={24} />
    </Pressable> : null}
  </View>;
}
