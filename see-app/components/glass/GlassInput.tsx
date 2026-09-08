import { forwardRef } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";

type Props = TextInputProps & {
  label?: string;
};

export const GlassInput = forwardRef<any, Props>(function GlassInput(
  { label, className = "", ...props },
  ref
) {
  return (
    <View className="gap-2">
      {label ? <TextInputLabel label={label} /> : null}
      <TextInput
        ref={ref}
        className={`rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-3 font-mono text-white placeholder:text-zinc-600 ${className}`}
        placeholderTextColor="#52525B"
        {...props}
      />
    </View>
  );
});

function TextInputLabel({ label }: { label: string }) {
  return (
    <View className="px-1">
      <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">{label}</Text>
    </View>
  );
}
