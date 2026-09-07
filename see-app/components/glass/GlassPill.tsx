import { ReactNode } from "react";
import { Text, View, type ViewProps } from "react-native";

type Props = ViewProps & {
  label: string;
  value?: string | number;
  tone?: "default" | "active" | "danger";
  children?: ReactNode;
};

const toneClasses = {
  default: "border-white/10 bg-zinc-950/50",
  active: "border-white/20 bg-zinc-900/60",
  danger: "border-white/20 bg-zinc-950/80"
} as const;

export function GlassPill({ label, value, tone = "default", children, className = "", ...props }: Props) {
  return (
    <View className={`rounded-lg border px-3 py-2 ${toneClasses[tone]} ${className}`} {...props}>
      <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-400">{label}</Text>
      {value !== undefined ? (
        <Text className="mt-1 font-mono text-sm font-bold text-white">{value}</Text>
      ) : null}
      {children}
    </View>
  );
}
