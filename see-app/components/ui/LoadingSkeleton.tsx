import { View } from "react-native";
import { theme } from "@/constants/theme";
import { AppText } from "./primitives";
export function LoadingSkeleton() {
  return <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={{ gap: 16, paddingVertical: 16 }}>
    <AppText variant="meta" muted>Loading…</AppText>
    {[0, 1, 2].map(i => <View key={i} style={{ gap: 12, padding: 16, backgroundColor: theme.colors.surface, borderRadius: 8 }}><View style={{ height: 18, width: "65%", backgroundColor: theme.colors.surfaceHighest, borderRadius: 4 }} /><View style={{ height: 12, width: "85%", backgroundColor: theme.colors.surfaceHigh, borderRadius: 4 }} /></View>)}
  </View>;
}
