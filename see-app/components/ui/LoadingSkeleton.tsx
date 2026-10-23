import { View } from "react-native";
import { useEffect, useState } from "react";
import { theme } from "@/constants/theme";
import { AppText } from "./primitives";
export function LoadingSkeleton() {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setSlow(true), 8_000); return () => clearTimeout(timer); }, []);
  return <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={{ gap: 16, paddingVertical: 16 }}>
    <AppText variant="meta" muted accessibilityLiveRegion="polite">{slow ? "The service is taking longer to respond. You can still open Add and prepare a draft." : "Loading…"}</AppText>
    {[0, 1, 2].map(i => <View key={i} style={{ gap: 12, padding: 16, backgroundColor: theme.colors.surface, borderRadius: 8 }}><View style={{ height: 18, width: "65%", backgroundColor: theme.colors.surfaceHighest, borderRadius: 4 }} /><View style={{ height: 12, width: "85%", backgroundColor: theme.colors.surfaceHigh, borderRadius: 4 }} /></View>)}
  </View>;
}
