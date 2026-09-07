import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { GlassCard } from "@/components/glass/GlassCard";
import { GlassPill } from "@/components/glass/GlassPill";
import { Checkbox } from "@/components/ui/Checkbox";
import { AsciiBanner } from "@/components/ui/AsciiBanner";

const stageNodes = ["BOOKMARKED", "APPLIED", "INTERVIEWING", "OFFER", "REJECTED"] as const;

const initialChecklist = [
  { id: "1", label: "Research team and product surface", done: true },
  { id: "2", label: "Prep behavioral story bank", done: false },
  { id: "3", label: "Draft recruiter follow-up note", done: false }
];

export default function JobDossierScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const [items, setItems] = useState(initialChecklist);
  const [notes, setNotes] = useState("Recruiter note scratchpad...");

  const progress = Math.round((items.filter((item) => item.done).length / items.length) * 100);

  return (
    <>
      <Stack.Screen options={{ title: "Application Dossier" }} />
      <ScrollView className="flex-1 bg-black" contentContainerClassName="px-4 pb-28 pt-4">
        <View className="gap-4">
          <AsciiBanner title="// DOSSIER" subtitle={`Application ${params.id ?? "N/A"}`} right="[DOSSIER]" />

          <GlassCard className="gap-3">
            <View className="flex-row items-start justify-between">
              <View className="gap-1">
                <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">MONIEPOINT</Text>
                <Text className="text-2xl font-bold text-white">Senior Backend Engineer</Text>
              </View>
              <GlassPill label="STAGE" value="INTERVIEWING" tone="active" />
            </View>

            <View className="flex-row gap-2">
              {stageNodes.map((stage, index) => (
                <View
                  key={stage}
                  className={`flex-1 rounded-lg border px-2 py-2 ${
                    index <= 2 ? "border-white/20 bg-zinc-900/70" : "border-white/10 bg-zinc-950/50"
                  }`}
                >
                  <Text className="text-center font-mono text-[9px] tracking-[0.18em] text-white">{stage}</Text>
                </View>
              ))}
            </View>

            <GlassPill label="PROGRESS" value={`${progress}%`} />
          </GlassCard>

          <GlassCard className="gap-3">
            <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">// CHECKLIST</Text>
            <View className="gap-2">
              {items.map((item) => (
                <Checkbox
                  key={item.id}
                  checked={item.done}
                  label={item.label}
                  onChange={(next) => setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, done: next } : entry)))}
                />
              ))}
            </View>
          </GlassCard>

          <GlassCard className="gap-3">
            <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">// RECRUITER_DEBRIEF</Text>
            <TextInput
              multiline
              value={notes}
              onChangeText={setNotes}
              className="min-h-[180px] rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-3 font-mono text-sm text-white"
              textAlignVertical="top"
              placeholderTextColor="#52525B"
            />
          </GlassCard>
        </View>
      </ScrollView>
    </>
  );
}
