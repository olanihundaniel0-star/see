import * as Haptics from "expo-haptics";
import { Pressable, Text, View } from "react-native";

type Props = {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
};

export function Checkbox({ checked, label, onChange }: Props) {
  return (
    <Pressable
      onPress={async () => {
        await Haptics.selectionAsync();
        onChange(!checked);
      }}
      className="flex-row items-start gap-3 rounded-lg border border-white/10 bg-zinc-950/50 px-3 py-3 active:scale-[0.99]"
    >
      <View className="mt-0.5 h-4 w-4 items-center justify-center rounded border border-white/20 bg-zinc-900/80">
        <Text className="font-mono text-[10px] text-white">{checked ? "x" : " "}</Text>
      </View>
      <Text className={`flex-1 font-mono text-sm ${checked ? "text-zinc-500 line-through" : "text-white"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
