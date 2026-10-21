import { Text, View } from "react-native";
export function LoadingSkeleton() {
  return <View accessibilityRole="progressbar" accessibilityLabel="Loading data" className="gap-3 rounded-lg border border-white/10 p-4">
    <Text className="font-mono text-zinc-300">LOADING YOUR DATA…</Text>
    {[0, 1, 2].map(i => <View key={i} className="h-10 rounded bg-zinc-800" />)}
  </View>;
}
