import { View, type ViewProps } from "react-native";
import { theme } from "@/constants/theme";
export function GlassCard({ style, variant: _variant, ...props }: ViewProps & { variant?: "default" | "blur" }) {
  return <View {...props} style={[{ padding: theme.spacing.lg, gap: theme.spacing.md, borderRadius: theme.radius.cards, backgroundColor: theme.colors.surface }, style]} />;
}
