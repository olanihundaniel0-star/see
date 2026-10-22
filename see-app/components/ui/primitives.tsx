import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ColorValue, type ScrollViewProps, type TextProps, type ViewStyle } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/constants/theme";

export type IconName = ComponentProps<typeof Feather>["name"];
export function Icon({ name, size = 20, color = theme.colors.text }: { name: IconName; size?: number; color?: ColorValue }) {
  return <Feather name={name} size={size} color={color} accessible={false} />;
}
export function AppText({ variant = "body", muted, danger, style, ...props }: TextProps & { variant?: keyof typeof theme.type; muted?: boolean; danger?: boolean }) {
  return <Text {...props} style={[theme.type[variant], { color: danger ? theme.colors.error : muted ? theme.colors.onSurfaceVariant : theme.colors.text, flexShrink: 1 }, style]} />;
}
export function Button({ label, onPress, variant = "primary", busy = false, disabled = false, icon, style }: {
  label: string; onPress: () => void; variant?: "primary" | "secondary" | "ghost" | "danger"; busy?: boolean; disabled?: boolean; icon?: IconName; style?: ViewStyle;
}) {
  const color = variant === "primary" ? theme.colors.background : variant === "danger" ? theme.colors.error : theme.colors.text;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress}
    style={({ pressed }) => [styles.button, { backgroundColor: variant === "primary" ? theme.colors.primary : variant === "ghost" ? "transparent" : theme.colors.surfaceHigh, opacity: disabled || busy ? 0.5 : pressed ? 0.75 : 1 }, style]}>
    {busy ? <ActivityIndicator size="small" color={color} /> : icon ? <Icon name={icon} color={color} size={18} /> : null}
    <AppText variant="label" style={{ color, textAlign: "center" }}>{label}</AppText>
  </Pressable>;
}
export function IconButton({ name, label, onPress, disabled }: { name: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ minWidth: 48, minHeight: 48, justifyContent: "center", alignItems: "center", borderRadius: 8, opacity: disabled ? 0.4 : pressed ? 0.6 : 1 })}><Icon name={name} /></Pressable>;
}
export function Screen({ children, form = false, contentContainerStyle, ...props }: ScrollViewProps & { form?: boolean }) {
  const insets = useSafeAreaInsets();
  const scroll = <ScrollView {...props} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
    style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: 96 + insets.bottom }, contentContainerStyle]}>{children}</ScrollView>;
  return form ? <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>{scroll}</KeyboardAvoidingView> : scroll;
}
export function ScreenHeader({ title, subtitle, back = false, account = true, action }: { title: string; subtitle?: string; back?: boolean; account?: boolean; action?: ReactNode }) {
  return <View style={{ gap: 4, marginBottom: 8 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {back ? <IconButton name="arrow-left" label="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace("/")} /> : null}
      <AppText variant="title" accessibilityRole="header" style={{ flex: 1 }}>{title}</AppText>
      {action ?? (account ? <IconButton name="user" label="Account and settings" onPress={() => router.push("/(tabs)/account")} /> : null)}
    </View>
    {subtitle ? <AppText muted style={back ? { paddingLeft: 56 } : undefined}>{subtitle}</AppText> : null}
  </View>;
}
export function SectionHeading({ title, detail }: { title: string; detail?: string }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8 }}><AppText variant="heading" accessibilityRole="header">{title}</AppText>{detail ? <AppText variant="meta" muted>{detail}</AppText> : null}</View>;
}
export function Chip({ label, selected, onPress, disabled = false }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 4, justifyContent: "center", backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceHigh, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 })}><AppText variant="label" style={{ color: selected ? theme.colors.background : theme.colors.text }}>{label}</AppText></Pressable>;
}
export function Badge({ label, danger = false }: { label: string; danger?: boolean }) {
  return <View style={{ alignSelf: "flex-start", maxWidth: "100%", borderRadius: 4, backgroundColor: danger ? theme.colors.errorSurface : theme.colors.surfaceHigh, paddingHorizontal: 8, paddingVertical: 4 }}><AppText variant="meta" danger={danger}>{label}</AppText></View>;
}
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.layout.screenPadding, gap: 16, width: "100%", maxWidth: theme.layout.maxWidth, alignSelf: "center" },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  button: { minHeight: theme.layout.touchTarget, borderRadius: theme.radius.controls, paddingVertical: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  section: { gap: 12 },
  divider: { height: 1, backgroundColor: theme.colors.border }
});
