import { forwardRef, useState } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";

type Props = TextInputProps & {
  label?: string;
  /** When true, renders a trailing monospace "_" block cursor affordance. */
  trailingCursor?: boolean;
};

export const GlassInput = forwardRef<any, Props>(function GlassInput(
  { label, maxLength = 5000, trailingCursor = false, className = "", onFocus, onBlur, style, ...props },
  ref
) {
  const [focused, setFocused] = useState(false);
  return (
    <View className="gap-2">
      {label ? <TextInputLabel label={label} /> : null}
      <View className="relative justify-center">
        <TextInput
          ref={ref}
          maxLength={maxLength}
          className={`rounded border border-white/[0.12] bg-zinc-950/70 px-3 py-3 pr-8 font-mono text-white placeholder:text-[#52525B] focus:border-white/40 ${className}`}
          placeholderTextColor="#52525B"
          style={[{ borderColor: focused ? "rgba(255, 255, 255, 0.40)" : "rgba(255, 255, 255, 0.12)" }, style]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
        {trailingCursor ? (
          <Text pointerEvents="none" className="absolute right-3 font-mono text-white">
            _
          </Text>
        ) : null}
      </View>
    </View>
  );
});

function TextInputLabel({ label }: { label: string }) {
  return (
    <View className="px-1">
      <Text className="font-mono-bold text-[10px] leading-[12px] tracking-[0.08em] text-[#8f9194]">{label}</Text>
    </View>
  );
}
