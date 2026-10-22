import { View } from "react-native";
import { theme } from "@/constants/theme";
import { AppText } from "./primitives";
export function ProgressBar({ value, label = "Preparation" }: { value: number; segments?: number; label?: string }) {
  const progress = Math.max(0, Math.min(100, value));
  return <View style={{ gap: 8 }} accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: progress }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}><AppText variant="meta" muted>{label}</AppText><AppText variant="code">{progress}%</AppText></View>
    <View style={{ height: 4, backgroundColor: theme.colors.surfaceHighest, borderRadius: 2 }}><View style={{ height: 4, width: `${progress}%`, backgroundColor: theme.colors.primary, borderRadius: 2 }} /></View>
  </View>;
}
