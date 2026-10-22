import { ActivityIndicator, View } from "react-native";
import { theme } from "@/constants/theme";
import { AppText } from "./primitives";
export default function BootScreen() {
  return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: theme.colors.background }}>
    <AppText variant="title">SEE</AppText><ActivityIndicator color={theme.colors.primary} accessibilityLabel="Opening SEE" /><AppText muted>Getting things ready…</AppText>
  </View>;
}
