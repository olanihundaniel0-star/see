import { View } from "react-native";
import { AppText } from "./primitives";
/** A restrained terminal accent for legacy callers. Prefer ScreenHeader for screens. */
export function AsciiBanner({ title, subtitle }: { title: string; subtitle?: string; right?: string }) {
  return <View style={{ gap: 8 }}><AppText variant="code" muted>{title}</AppText>{subtitle ? <AppText>{subtitle}</AppText> : null}</View>;
}
