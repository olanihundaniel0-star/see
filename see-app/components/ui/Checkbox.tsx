import { Pressable, View } from "react-native";
import { theme } from "@/constants/theme";
import { AppText, Icon } from "./primitives";
export function Checkbox({ checked, label, onChange, disabled }: { checked: boolean; label: string; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked, disabled }} disabled={disabled} onPress={() => onChange(!checked)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", minHeight: 48, gap: 12, paddingVertical: 12, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 })}>
    <View style={{ width: 22, height: 22, borderWidth: 1, borderColor: theme.colors.outline, borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: checked ? theme.colors.primary : "transparent" }}>{checked ? <Icon name="check" size={16} color={theme.colors.background} /> : null}</View>
    <AppText style={{ flex: 1, textDecorationLine: checked ? "line-through" : "none" }} muted={checked}>{label}</AppText>
  </Pressable>;
}
