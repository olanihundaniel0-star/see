import { Text, View } from "react-native";

type Props = {
  value: number;
  segments?: number;
  label?: string;
};

export function ProgressBar({ value, segments = 4, label }: Props) {
  const clamped = Math.max(0, Math.min(100, value));
  const safeSegments = Math.max(1, Math.floor(segments));
  const filled = Math.round((clamped / 100) * safeSegments);
  const glyph = `${"■".repeat(filled)}${"□".repeat(safeSegments - filled)}`;

  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <Text className="font-mono text-[11px] tracking-[0.08em] text-[#e2e2e2]">
          {label ? `${label} [${glyph}]` : `[${glyph}]`}
        </Text>
        <Text className="font-mono text-[11px] tracking-[0.08em] text-white">{clamped}%</Text>
      </View>
      <View className="h-1.5 flex-row gap-[2px] rounded-full bg-black/60 p-[1px]">
        {Array.from({ length: safeSegments }).map((_, index) => (
          <View
            key={index}
            className={`h-full flex-1 rounded-full ${index < filled ? "bg-white" : "bg-[#353535]"}`}
          />
        ))}
      </View>
    </View>
  );
}
