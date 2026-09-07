import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { GlassCard } from "@/components/glass/GlassCard";
import { AsciiBanner } from "@/components/ui/AsciiBanner";
import { theme } from "@/constants/theme";

const tags = ["#dsa", "#system-design", "#fastapi", "#postgres", "#redis"];

const notes = [
  {
    title: "FastAPI auth pattern",
    snippet: `from fastapi import Depends\n\nasync def current_user(...):\n    return verify_jwt(token)`,
    meta: "> python"
  },
  {
    title: "Redis queue note",
    snippet: `LPUSH see:jobs:ingest <payload>\nBRPOP see:jobs:ingest`,
    meta: "> shell"
  }
];

export default function NotesScreen() {
  return (
    <ScrollView className="flex-1 bg-black" contentContainerClassName="px-4 pb-28 pt-4">
      <View className="gap-4">
        <AsciiBanner title={theme.ascii.vault} subtitle="Searchable markdown snippets" right="[VAULT]" />

        <View className="rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3">
          <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">&gt; grep search notes...</Text>
          <TextInput
            placeholder="search notes..."
            placeholderTextColor="#52525B"
            className="mt-2 font-mono text-base text-white"
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {tags.map((tag) => (
            <Pressable key={tag} className="rounded-lg border border-white/10 bg-zinc-950/50 px-3 py-2">
              <Text className="font-mono text-[10px] tracking-[0.16em] text-white">{tag}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View className="gap-3">
          {notes.map((note) => (
            <GlassCard key={note.title} className="gap-3">
              <View className="gap-1">
                <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">{note.meta}</Text>
                <Text className="text-xl font-bold text-white">{note.title}</Text>
              </View>
              <View className="rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-3">
                <Text className="font-mono text-[11px] leading-5 text-zinc-200">{note.snippet}</Text>
              </View>
            </GlassCard>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
