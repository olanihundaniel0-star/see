import { Pressable, Text } from "react-native";

type Props = {
  onPress: () => void;
  busy?: boolean;
  label?: string;
};

export function LoadMoreButton({ onPress, busy, label = "[ LOAD MORE ]" }: Props) {
  return (
    <Pressable
      disabled={busy}
      onPress={onPress}
      className="rounded-xl border border-white/20 bg-white px-4 py-4 disabled:opacity-60"
    >
      <Text className="text-center font-mono text-[12px] font-bold tracking-[0.08em] text-black">
        {busy ? "[ LOADING MORE... ]" : label}
      </Text>
    </Pressable>
  );
}
