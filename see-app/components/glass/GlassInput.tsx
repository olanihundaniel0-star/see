import { forwardRef, useState } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { theme } from "@/constants/theme";
import { AppText } from "@/components/ui/primitives";

type Props = TextInputProps & { label?: string; helper?: string; error?: string; trailingCursor?: boolean };
export const GlassInput = forwardRef<TextInput, Props>(function GlassInput(
  { label, helper, error, maxLength = 5000, trailingCursor: _trailingCursor, onFocus, onBlur, style, ...props }, ref
) {
  const [focused, setFocused] = useState(false);
  return <View style={{ gap: 8 }}>
    {label ? <AppText variant="label">{label}</AppText> : null}
    <TextInput ref={ref} maxLength={maxLength} accessibilityLabel={label ?? props.placeholder} placeholderTextColor={theme.colors.placeholder} selectionColor={theme.colors.primary}
      {...props} style={[theme.type.body, { color: theme.colors.text, minHeight: 48, borderRadius: theme.radius.controls, borderWidth: 1, borderColor: error ? theme.colors.error : focused ? theme.colors.borderFocusStrong : theme.colors.borderInput, backgroundColor: theme.colors.surfaceLowest, paddingHorizontal: 12, paddingVertical: 12, textAlignVertical: props.multiline ? "top" : "center" }, style]}
      onFocus={e => { setFocused(true); onFocus?.(e); }} onBlur={e => { setFocused(false); onBlur?.(e); }} />
    {error || helper ? <AppText variant="meta" muted={!error} danger={!!error} accessibilityLiveRegion={error ? "polite" : undefined}>{error ?? helper}</AppText> : null}
  </View>;
});
