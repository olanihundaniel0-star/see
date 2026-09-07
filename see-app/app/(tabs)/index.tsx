import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { GlassCard } from "@/components/glass/GlassCard";
import { GlassPill } from "@/components/glass/GlassPill";
import { AsciiBanner } from "@/components/ui/AsciiBanner";
import { Checkbox } from "@/components/ui/Checkbox";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { theme } from "@/constants/theme";

const urgentItems = [
  {
    company: "Moniepoint",
    title: "Senior Backend Screen",
    detail: "ENDS IN 18H 30M",
    action: "[JOIN GOOGLE MEET]"
  },
  {
    company: "Devpost",
    title: "AI Engine Code Submission",
    detail: "ENDS IN 36H 15M",
    action: "[SUBMIT REPO]"
  }
];

const tasks = [
  { id: "1", label: "Review system design notes for the Moniepoint screen", done: true },
  { id: "2", label: "Complete the FastAPI take-home test", done: false },
  { id: "3", label: "Sync referral follow-up for Flutterwave", done: false }
];

function formatClock(date: Date) {
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Lagos"
  }).format(date);

  const day = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Africa/Lagos"
  }).format(date);

  return { time, day: day.toUpperCase() };
}

export default function TodayScreen() {
  const [now, setNow] = useState(() => new Date());
  const [taskState, setTaskState] = useState(tasks);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const completed = taskState.filter((item) => item.done).length;
  const { time, day } = formatClock(now);

  return (
    <ScrollView className="flex-1 bg-black" contentContainerClassName="px-4 pb-28 pt-4">
      <View className="gap-4">
        <View className="flex-row items-start justify-between">
          <View className="gap-1">
            <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">{theme.ascii.devHub}</Text>
            <Text className="font-mono text-[11px] text-white">{theme.ascii.online}</Text>
          </View>
          <View className="items-end">
            <Text className="font-mono text-lg text-white">{time} WAT</Text>
            <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">{day}</Text>
          </View>
        </View>

        <GlassCard className="gap-4">
          <AsciiBanner title="// PIPELINE" subtitle="Operational snapshot" right="RUNNING" />
          <View className="flex-row gap-3">
            <GlassPill label="APPLIED" value={14} className="flex-1" />
            <GlassPill label="INTERVIEW" value={3} tone="active" className="flex-1" />
            <GlassPill label="OFFER" value={1} className="flex-1" />
          </View>
          <ProgressBar label="RESPONSE RATE" value={65} />
        </GlassCard>

        <View className="flex-row items-center justify-between px-1">
          <Text className="font-mono text-[10px] tracking-[0.2em] text-white">// URGENT_HORIZON (&lt;= 48H)</Text>
          <Text className="font-mono text-[10px] tracking-[0.2em] text-zinc-400">[!] 2 EVENTS</Text>
        </View>

        {urgentItems.map((item) => (
          <GlassCard key={item.company} className="gap-3">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 gap-1">
                <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">{item.company.toUpperCase()}</Text>
                <Text className="text-2xl font-bold text-white">{item.title}</Text>
                <Text className="font-mono text-[11px] text-zinc-400">{item.detail}</Text>
              </View>
              <GlassPill label="COUNTDOWN" value="LIVE" tone="danger" />
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="font-mono text-[10px] text-zinc-500">[MEET_ID: 941-204-ENG]</Text>
              <Pressable className="rounded-lg border border-white/10 bg-white px-3 py-2 active:scale-[0.99]">
                <Text className="font-mono text-[10px] font-bold text-black">{item.action}</Text>
              </Pressable>
            </View>
          </GlassCard>
        ))}

        <View className="flex-row items-center justify-between px-1">
          <Text className="font-mono text-[10px] tracking-[0.2em] text-white">// DAILY_TASKS_QUEUE</Text>
          <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-400">
            {completed}/{taskState.length} COMPLETED
          </Text>
        </View>

        <View className="gap-3">
          {taskState.map((task) => (
            <Checkbox
              key={task.id}
              checked={task.done}
              label={task.label}
              onChange={(next) =>
                setTaskState((current) => current.map((entry) => (entry.id === task.id ? { ...entry, done: next } : entry)))
              }
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
