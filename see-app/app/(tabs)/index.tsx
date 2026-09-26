import { useEffect, useState } from "react";
import { Link, router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Pressable, ScrollView, Text, View } from "react-native";

import { formatCountdown, formatLagosClock, formatShortDateTime } from "@/lib/format";
import { useToday, useUpdateReminder } from "@/lib/queries";

function gaugeBlocks(filled: number, total = 5) {
  const clamped = Math.max(0, Math.min(total, filled));
  return `[${"\u25A0".repeat(clamped)}${"\u25A1".repeat(total - clamped)}]`;
}

export default function TodayScreen() {
  const { data, isLoading, error, refetch } = useToday();
  const updateReminder = useUpdateReminder();
  const [now, setNow] = useState(() => new Date());
  const [doneIds, setDoneIds] = useState<string[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const { time, day } = formatLagosClock(now);
  const windowHours = data?.window_hours ?? 48;
  const urgentItems = data?.items ?? [];
  const reminderItems = urgentItems.filter((item) => item.kind === "reminder");
  const jobItems = urgentItems.filter((item) => item.kind === "job");
  const latestGenerated = data?.generated_at ? formatShortDateTime(data.generated_at) : null;

  const appliedCount = data?.job_count ?? 0;
  const interviewCount = jobItems.length;
  const offerCount = jobItems.filter((item) => (item.status ?? "").toLowerCase() === "offer").length;
  const activityTotal = appliedCount + (data?.reminder_count ?? 0);
  const activityFilled = activityTotal === 0 ? 0 : Math.max(1, Math.min(5, Math.round(activityTotal / 2)));
  const doneCount = reminderItems.filter((item) => doneIds.includes(item.id)).length;

  const toggleReminder = async (id: string) => {
    if (doneIds.includes(id) || updateReminder.isPending) return;
    await Haptics.selectionAsync();
    await updateReminder.mutateAsync({ id, data: { is_completed: true } });
    setDoneIds((prev) => [...prev, id]);
  };

  return (
    <ScrollView removeClippedSubviews className="flex-1 bg-black" contentContainerClassName="px-4 pb-28 pt-4">
      <View className="gap-4">
        {/* Telemetry strip */}
        <View className="gap-1 rounded-lg bg-[#1b1b1b]/90 p-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Text className="font-mono-bold text-[12px] tracking-[0.05em] text-white">{"[\u25CF SYS_ONLINE]"}</Text>
              <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#c5c6ca]">{`// CYCLE_${windowHours}H`}</Text>
            </View>
            <View className="items-end">
              <Text className="font-mono-bold text-[12px] tracking-[0.05em] text-white">{time} WAT</Text>
              <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#8f9194]">{day}</Text>
            </View>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#c5c6ca]">LOC: LAGOS_NODE_01</Text>
            <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-white">
              STATUS: {urgentItems.length > 0 ? "CRITICAL_PATH" : "NOMINAL"}
            </Text>
          </View>
        </View>

        {/* Pipeline snapshot */}
        <View className="gap-3 rounded-lg bg-[#1f1f1f]/80 p-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#c5c6ca]">{"// PIPELINE_METRICS"}</Text>
            <View className="rounded bg-[#2a2a2a]/60 px-2 py-1">
              <Text className="font-mono-bold text-[12px] tracking-[0.05em] text-white">
                {isLoading ? "SYNCING" : "RUNNING"}
              </Text>
            </View>
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1 items-center rounded bg-[#1b1b1b]/70 px-2 py-3">
              <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#c5c6ca]">APPLIED</Text>
              <Text className="mt-1 font-sans-bold text-[20px] leading-[24px] text-white">{appliedCount}</Text>
              <Text className="mt-1 font-mono-bold text-[10px] tracking-[0.08em] text-[#c5c6ca]">[SYS_LOG]</Text>
            </View>
            <View className="flex-1 items-center rounded bg-[#2a2a2a]/70 px-2 py-3">
              <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-white">INTERVIEW</Text>
              <Text className="mt-1 font-sans-bold text-[20px] leading-[24px] text-white">{interviewCount}</Text>
              <Text className="mt-1 font-mono-bold text-[10px] tracking-[0.08em] text-white">[ACTIVE]</Text>
            </View>
            <View className="flex-1 items-center rounded bg-[#1b1b1b]/70 px-2 py-3">
              <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#c5c6ca]">OFFER</Text>
              <Text className="mt-1 font-sans-bold text-[20px] leading-[24px] text-white">{offerCount}</Text>
              <Text className="mt-1 font-mono-bold text-[10px] tracking-[0.08em] text-[#c5c6ca]">[READY]</Text>
            </View>
          </View>
          <View className="gap-1">
            <View className="flex-row items-center justify-between">
              <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#c5c6ca]">RESPONSE RATE</Text>
              <Text className="font-mono-bold text-[12px] tracking-[0.05em] text-white">{activityFilled * 20}% OPTIMAL</Text>
            </View>
            <View className="rounded bg-[#0e0e0e]/80 px-2 py-2">
              <Text className="font-mono-bold text-[12px] tracking-[0.05em] text-white">
                ACTIVITY {gaugeBlocks(activityFilled)}
              </Text>
            </View>
          </View>
        </View>

        {/* Urgent horizon header */}
        <View className="flex-row items-center justify-between px-1">
          <View className="flex-row items-center gap-2">
            <Text className="font-mono-bold text-[12px] text-white">{"\u25D4"}</Text>
            <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-white">{`// URGENT_HORIZON (<= ${windowHours}H)`}</Text>
          </View>
          <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#ffb4ab]">
            {`[!] ${urgentItems.length} ITEMS`}
          </Text>
        </View>

        {error ? (
          <View className="gap-3 rounded-lg border border-white/[0.08] bg-zinc-950/60 px-4 py-4">
            <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#8f9194]">{"// DASHBOARD_ERROR"}</Text>
            <Text className="font-sans-bold text-[20px] leading-[24px] text-white">Unable to load today&apos;s queue.</Text>
            <Pressable onPress={() => void refetch()} className="self-start rounded bg-white px-4 py-2 active:scale-[0.98]">
              <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-black">[ RETRY ]</Text>
            </Pressable>
          </View>
        ) : null}

        {!error && urgentItems.length === 0 ? (
          <View className="gap-3 rounded-lg border border-white/[0.08] bg-zinc-950/60 px-4 py-4">
            <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#8f9194]">{"// EMPTY_QUEUE"}</Text>
            <Text className="font-sans-bold text-[20px] leading-[24px] text-white">No items due inside the next {windowHours} hours.</Text>
            <Text className="font-mono text-[11px] leading-4 text-[#c5c6ca]">Use quick add to capture a reminder or job application.</Text>
            <Pressable
              onPress={async () => {
                await Haptics.selectionAsync();
                router.push("/modal/quick-add");
              }}
              className="self-start rounded bg-white px-3 py-2 active:scale-[0.98]"
            >
              <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-black">[+ QUICK ADD]</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Job cards */}
        <View className="gap-3">
          {jobItems.map((item) => (
            <View key={item.id} className="gap-3 rounded-lg bg-[#1f1f1f]/90 p-4">
              <View className="flex-row items-start justify-between gap-2">
                <View className="min-w-0 flex-1 gap-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="font-mono-bold text-[12px] tracking-[0.05em] text-white">[!]</Text>
                    <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#c5c6ca]" numberOfLines={1}>
                      {`JOB${item.status ? ` // ${item.status.toUpperCase()}` : ""}`}
                    </Text>
                  </View>
                  <Text className="font-sans-bold text-[20px] leading-[24px] tracking-[-0.4px] text-white">
                    {item.title}
                  </Text>
                  {item.subtitle ? (
                    <Text className="font-mono text-[11px] leading-4 text-[#c5c6ca]">{item.subtitle}</Text>
                  ) : null}
                </View>
                <View className="shrink-0 rounded bg-[#2a2a2a]/80 px-2 py-1">
                  <Text className="font-mono-bold text-[12px] tracking-[0.05em] text-white">
                    {formatCountdown(item.due_at)}
                  </Text>
                </View>
              </View>

              <View className="flex-row flex-wrap gap-2">
                <View className="rounded border border-white/[0.15] bg-white/[0.05] px-2 py-1">
                  <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#c5c6ca]">
                    DUE {formatShortDateTime(item.due_at).toUpperCase()}
                  </Text>
                </View>
                {item.priority ? (
                  <View className="rounded border border-white/[0.15] bg-white/[0.05] px-2 py-1">
                    <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#c5c6ca]">
                      [PRIORITY: {item.priority.toUpperCase()}]
                    </Text>
                  </View>
                ) : null}
                {item.action ? (
                  <View className="rounded border border-white/[0.15] bg-white/[0.05] px-2 py-1">
                    <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-white">
                      [MEET_ID: {item.action.toUpperCase()}]
                    </Text>
                  </View>
                ) : null}
              </View>

              <Link href={`/jobs/${item.id}`} asChild>
                <Pressable className="items-center rounded bg-white px-4 py-2 active:scale-[0.98]">
                  <Text className="font-mono-bold text-[12px] tracking-[0.05em] text-black">[OPEN DOSSIER]</Text>
                </Pressable>
              </Link>
            </View>
          ))}
        </View>

        {/* Reminders checklist */}
        {reminderItems.length > 0 ? (
          <View className="gap-3">
            <View className="flex-row items-center justify-between px-1">
              <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-white">{"// DAILY_TASKS_QUEUE"}</Text>
              <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#c5c6ca]">
                {doneCount}/{reminderItems.length} COMPLETED
              </Text>
            </View>
            <View className="gap-2">
              {reminderItems.map((item) => {
                const done = doneIds.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    disabled={done || updateReminder.isPending}
                    onPress={() => void toggleReminder(item.id)}
                    className="flex-row items-start gap-3 rounded-lg bg-[#1f1f1f]/90 p-3 disabled:opacity-70 active:scale-[0.99]"
                  >
                    <View className="h-6 w-6 shrink-0 items-center justify-center rounded bg-[#353535]">
                      <Text className="font-mono-bold text-[12px] tracking-[0.05em] text-white">
                        {done ? "[x]" : "[ ]"}
                      </Text>
                    </View>
                    <View className="min-w-0 flex-1 gap-1">
                      <Text
                        className={`font-mono text-[13px] leading-[18px] ${done ? "text-[#8f9194] line-through" : "font-bold text-white"}`}
                      >
                        {item.title}
                      </Text>
                      <View className="flex-row items-center gap-2">
                        <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#c5c6ca]">
                          #{(item.priority ?? item.status ?? "reminder").toUpperCase()}
                        </Text>
                        <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#8f9194]">
                          DUE {formatShortDateTime(item.due_at).toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <View className="shrink-0 rounded bg-[#2a2a2a]/80 px-2 py-1">
                      <Text className="font-mono-bold text-[12px] tracking-[0.05em] text-white">
                        {formatCountdown(item.due_at)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Triage footer */}
        <View className="flex-row items-center justify-between rounded-lg bg-[#1b1b1b]/70 p-3">
          <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-[#c5c6ca]" numberOfLines={1}>
            NEXT_TRIAGE: {latestGenerated ?? "--"}{" // "}{urgentItems.length} URGENT ITEMS
          </Text>
          <Pressable onPress={() => void refetch()} className="shrink-0 active:scale-95">
            <Text className="font-mono-bold text-[12px] tracking-[0.05em] text-white">[SYNC]</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
