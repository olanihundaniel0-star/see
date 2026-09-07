import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function NotFound() {
  return (
    <View className="flex-1 items-center justify-center bg-black px-6">
      <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">// 404</Text>
      <Text className="mt-2 text-center text-2xl font-bold text-white">Route not found</Text>
      <Link href="/" asChild>
        <Pressable className="mt-6 rounded-lg border border-white/10 bg-zinc-950/70 px-4 py-3">
          <Text className="font-mono text-[10px] text-white">[ RETURN TO SYSTEM ]</Text>
        </Pressable>
      </Link>
    </View>
  );
}
