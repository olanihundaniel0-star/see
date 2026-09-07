import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { GlassCard } from "@/components/glass/GlassCard";
import { GlassPill } from "@/components/glass/GlassPill";
import { AsciiBanner } from "@/components/ui/AsciiBanner";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { theme } from "@/constants/theme";

const filters = ["ALL", "APPLIED", "INTERVIEWING", "OFFERS"] as const;

const jobs = [
  {
    id: "1",
    company: "Moniepoint",
    role: "Senior Backend Engineer",
    salary: "COMP: ₦450k-550k/mo",
    status: "INTERVIEWING",
    progress: 75,
    elapsed: "4D AGO"
  },
  {
    id: "2",
    company: "Flutterwave",
    role: "Platform Engineer",
    salary: "COMP: ₦500k-700k/mo",
    status: "APPLIED",
    progress: 40,
    elapsed: "11D AGO"
  },
  {
    id: "3",
    company: "Paystack",
    role: "Backend Engineer",
    salary: "COMP: ₦550k-650k/mo",
    status: "OFFER",
    progress: 90,
    elapsed: "19D AGO"
  }
];

export default function JobsScreen() {
  return (
    <ScrollView className="flex-1 bg-black" contentContainerClassName="px-4 pb-28 pt-4">
      <View className="gap-4">
        <AsciiBanner title={theme.ascii.pipeline} subtitle="Status filters and dossier cards" right="[PIPELINE]" />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {filters.map((filter, index) => (
            <Pressable
              key={filter}
              onPress={() => void Haptics.selectionAsync()}
              className={`rounded-lg border px-4 py-2 ${
                index === 0 ? "border-white/20 bg-zinc-900/70" : "border-white/10 bg-zinc-950/50"
              }`}
            >
              <Text className="font-mono text-[10px] tracking-[0.18em] text-white">{filter}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View className="gap-3">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              asChild
            >
              <Pressable className="active:scale-[0.99]">
                <GlassCard className="gap-3">
                  <View className="flex-row items-start justify-between gap-4">
                    <View className="flex-1 gap-1">
                      <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">{job.company.toUpperCase()}</Text>
                      <Text className="text-xl font-bold text-white">{job.role}</Text>
                      <Text className="font-mono text-[11px] text-zinc-400">{job.salary}</Text>
                    </View>
                    <GlassPill label="STAGE" value={job.status} tone="active" />
                  </View>
                  <ProgressBar value={job.progress} label="CHECKLIST" />
                  <View className="flex-row items-center justify-between">
                    <Text className="font-mono text-[10px] text-zinc-500">[{job.elapsed}]</Text>
                    <Text className="font-mono text-[10px] text-zinc-300">[■■■□] {job.progress}%</Text>
                  </View>
                  <View className="flex-row gap-2">
                    <Pressable className="flex-1 rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-2">
                      <Text className="text-center font-mono text-[10px] text-white">[+ ADVANCE]</Text>
                    </Pressable>
                    <Pressable className="flex-1 rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-2">
                      <Text className="text-center font-mono text-[10px] text-white">[x ARCHIVE]</Text>
                    </Pressable>
                  </View>
                </GlassCard>
              </Pressable>
            </Link>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
