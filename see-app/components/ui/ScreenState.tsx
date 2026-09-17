import { Pressable, Text } from "react-native";

import { GlassCard } from "@/components/glass/GlassCard";

type Props = {
  title: string;
  message: string;
  label?: string;
  onPress?: () => void;
  busy?: boolean;
};

export function ScreenState({ title, message, label, onPress, busy }: Props) {
  return (
    <GlassCard className="gap-3">
      <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">{title}</Text>
      <Text className="text-xl font-sans-bold text-white">{message}</Text>
      {onPress && label ? (
        <Pressable
          disabled={busy}
          onPress={onPress}
          className="self-start rounded-lg border border-white/20 bg-white px-4 py-2 disabled:opacity-60"
        >
          <Text className="font-mono-bold text-[10px] text-black">{busy ? "[ WORKING ]" : label}</Text>
        </Pressable>
      ) : null}
    </GlassCard>
  );
}

