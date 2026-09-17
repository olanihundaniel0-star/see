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
        <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#c5c6ca]">{title}</Text>
        {right ? <Text className="font-mono text-[10px] text-[#e2e2e2]">{right}</Text> : null}
      </View>
      {subtitle ? <Text className="font-mono text-[11px] text-[#8f9194]">{subtitle}</Text> : null}
    </View>
  );
}
