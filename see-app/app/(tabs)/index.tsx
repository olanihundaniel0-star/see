import { useEffect, useState } from "react";
import { Link, router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Pressable, ScrollView, Text, View } from "react-native";

import { GlassCard } from "@/components/glass/GlassCard";
import { GlassPill } from "@/components/glass/GlassPill";
import { AsciiBanner } from "@/components/ui/AsciiBanner";
import { Checkbox } from "@/components/ui/Checkbox";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { theme } from "@/constants/theme";
import { formatCountdown, formatLagosClock, formatShortDateTime } from "@/lib/format";
import { useToday, useUpdateReminder } from "@/lib/queries";

function itemTone(kind: "job" | "reminder", status?: string | null) {
  if (kind === "reminder") {
    if (status === "high") {
      return "danger" as const;
    }
    if (status === "medium") {
      return "active" as const;
    }
  }
  return "default" as const;
}

export default function TodayScreen() {
  const { data, isLoading, error, refetch } = useToday();
  const updateReminder = useUpdateReminder();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const { time, day } = formatLagosClock(now);
  const urgentItems = data?.items ?? [];
  const reminderItems = urgentItems.filter((item) => item.kind === "reminder");
  const jobItems = urgentItems.filter((item) => item.kind === "job");
  const latestGenerated = data?.generated_at ? formatShortDateTime(data.generated_at) : null;

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
          <AsciiBanner title="// PIPELINE" subtitle="Operational snapshot" right={isLoading ? "SYNCING" : "RUNNING"} />
          <View className="flex-row gap-3">
            <GlassPill label="REMINDERS" value={data?.reminder_count ?? 0} className="flex-1" />
            <GlassPill label="JOBS" value={data?.job_count ?? 0} tone="active" className="flex-1" />
            <GlassPill label="WINDOW" value={`${data?.window_hours ?? 48}H`} className="flex-1" />
          </View>
          <ProgressBar label="QUEUE SATURATION" value={Math.min(100, (urgentItems.length / 8) * 100)} />
        </GlassCard>

        <View className="flex-row items-center justify-between px-1">
          <Text className="font-mono text-[10px] tracking-[0.2em] text-white">// URGENT_HORIZON (&lt;= 48H)</Text>
          <Text className="font-mono text-[10px] tracking-[0.2em] text-zinc-400">[{urgentItems.length}] ITEMS</Text>
        </View>

        {error ? (
          <GlassCard className="gap-3">
            <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">// DASHBOARD_ERROR</Text>
            <Text className="text-lg text-white">Unable to load today&apos;s queue.</Text>
            <Pressable
              onPress={() => void refetch()}
              className="self-start rounded-lg border border-white/20 bg-white px-4 py-2"
            >
              <Text className="font-mono text-[10px] font-bold text-black">[ RETRY ]</Text>
            </Pressable>
          </GlassCard>
        ) : null}

        {!error && urgentItems.length === 0 ? (
          <GlassCard className="gap-3">
            <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">// EMPTY_QUEUE</Text>
            <Text className="text-xl font-bold text-white">No items due inside the next 48 hours.</Text>
            <Text className="font-mono text-[11px] text-zinc-400">Use quick add to capture a reminder or job application.</Text>
            <View className="flex-row gap-2">
              <Pressable
                onPress={async () => {
                  await Haptics.selectionAsync();
                  router.push("/modal/quick-add");
                }}
                className="rounded-lg border border-white/20 bg-white px-3 py-2"
              >
                <Text className="font-mono text-[10px] font-bold text-black">[+ QUICK ADD]</Text>
              </Pressable>
            </View>
          </GlassCard>
        ) : null}

        <View className="gap-3">
          {urgentItems.map((item) => (
            <GlassCard key={item.id} className="gap-3">
              <View className="flex-row items-start justify-between gap-4">
                <View className="flex-1 gap-1">
                  <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">
                    {item.kind === "job" ? "JOB" : "REMINDER"}
                  </Text>
                  <Text className="text-2xl font-bold text-white">{item.title}</Text>
                  {item.subtitle ? <Text className="font-mono text-[11px] text-zinc-400">{item.subtitle}</Text> : null}
                </View>
                <GlassPill
                  label="COUNTDOWN"
                  value={formatCountdown(item.due_at)}
                  tone={itemTone(item.kind, item.priority ?? item.status)}
                />
              </View>

              <View className="flex-row items-center justify-between gap-3">
                <Text className="font-mono text-[10px] text-zinc-500">
                  DUE {formatShortDateTime(item.due_at)}
                </Text>
                {item.kind === "job" ? (
                  <Link href={`/jobs/${item.id}`} asChild>
                    <Pressable className="rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-2 active:scale-[0.99]">
                      <Text className="font-mono text-[10px] text-white">[OPEN DOSSIER]</Text>
                    </Pressable>
                  </Link>
                ) : (
                  <Pressable
                    disabled={updateReminder.isPending}
                    onPress={async () => {
                      await Haptics.selectionAsync();
                      await updateReminder.mutateAsync({
                        id: item.id,
                        data: { is_completed: true }
                      });
                    }}
                    className="rounded-lg border border-white/20 bg-white px-3 py-2 disabled:opacity-60"
                  >
                    <Text className="font-mono text-[10px] font-bold text-black">
                      {updateReminder.isPending ? "[UPDATING]" : "[MARK DONE]"}
                    </Text>
                  </Pressable>
                )}
              </View>
            </GlassCard>
          ))}
        </View>

        <GlassCard className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">// SESSION_STATUS</Text>
            <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-400">
              {latestGenerated ? `GEN ${latestGenerated}` : "GEN WAITING"}
            </Text>
          </View>
          <View className="flex-row gap-2">
            <GlassPill label="REMINDER ITEMS" value={reminderItems.length} className="flex-1" />
            <GlassPill label="JOB ITEMS" value={jobItems.length} tone="active" className="flex-1" />
          </View>
          <Text className="font-mono text-[11px] leading-5 text-zinc-400">
            Today is fed by the backend dashboard window, so the items here always reflect the next 48 hours of reminders and
            job deadlines.
          </Text>
        </GlassCard>

        <View className="gap-3 px-1">
          <Text className="font-mono text-[10px] tracking-[0.2em] text-white">// DAILY_TASKS_QUEUE</Text>
          <View className="gap-2">
            <Checkbox checked label="Inbox sync is handled by the dashboard feed" onChange={() => undefined} />
            <Checkbox checked={Boolean(data?.items.length)} label="Open items are surfaced from backend state" onChange={() => undefined} />
            <Checkbox checked={Boolean(data?.generated_at)} label="Queue generation timestamp captured" onChange={() => undefined} />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
