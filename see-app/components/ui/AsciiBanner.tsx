import { Text, View } from "react-native";

type Props = {
  title: string;
  subtitle?: string;
  right?: string;
};

export function AsciiBanner({ title, subtitle, right }: Props) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="font-mono text-[10px] font-bold tracking-[0.2em] text-zinc-400">{title}</Text>
        {right ? <Text className="font-mono text-[10px] text-zinc-300">{right}</Text> : null}
      </View>
      {subtitle ? <Text className="font-mono text-[11px] text-zinc-500">{subtitle}</Text> : null}
    </View>
  );
}
