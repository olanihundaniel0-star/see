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
      className="flex-row items-start gap-3 rounded border border-white/[0.08] bg-[#2a2a2a]/60 px-3 py-3 active:scale-[0.99]"
    >
      <View
        className={`mt-0.5 h-4 w-4 items-center justify-center rounded-[2px] border ${
          checked ? "border-white bg-white" : "border-white/20 bg-black/60"
        }`}
      >
        {checked ? <Text className="font-mono text-[10px] leading-[12px] text-black">✓</Text> : null}
      </View>
      <Text className={`flex-1 font-mono text-sm ${checked ? "text-[#8f9194] line-through" : "text-white"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
