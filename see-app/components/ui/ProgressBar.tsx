import { Text, View } from "react-native";

type Props = {
  value: number;
  segments?: number;
  label?: string;
};

export function ProgressBar({ value, segments = 20, label }: Props) {
  const clamped = Math.max(0, Math.min(100, value));
  const filled = Math.round((clamped / 100) * segments);
  const bar = `${"■".repeat(filled)}${"□".repeat(segments - filled)}`;

  return (
    <View className="gap-1">
      {label ? <Text className="font-mono text-[10px] tracking-[0.16em] text-zinc-400">{label}</Text> : null}
      <Text className="font-mono text-[11px] tracking-[0.18em] text-white">
        [{bar}] {clamped}%
      </Text>
    </View>
  );
}
