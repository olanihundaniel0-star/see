import { Pressable, Text, View } from "react-native";

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
      <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">{title}</Text>
      <Text className="text-xl font-bold text-white">{message}</Text>
      {onPress && label ? (
        <Pressable
          disabled={busy}
          onPress={onPress}
          className="self-start rounded-lg border border-white/20 bg-white px-4 py-2 disabled:opacity-60"
        >
          <Text className="font-mono text-[10px] font-bold text-black">{busy ? "[ WORKING ]" : label}</Text>
        </Pressable>
      ) : null}
    </GlassCard>
  );
}

