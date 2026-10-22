import { View, type ViewProps } from "react-native";
import { AppText } from "@/components/ui/primitives";
import { theme } from "@/constants/theme";
type Props = ViewProps & { label: string; value?: string | number; tone?: "default" | "active" | "danger" };
export function GlassPill({ label, value, tone = "default", children, style, ...props }: Props) {
  return <View {...props} style={[{ padding: 12, gap: 4, borderRadius: theme.radius.controls, backgroundColor: theme.colors.surfaceHigh }, style]}>
    <AppText variant="meta" muted>{label}</AppText>{value !== undefined ? <AppText variant="label" danger={tone === "danger"}>{value}</AppText> : null}{children}
  </View>;
}
