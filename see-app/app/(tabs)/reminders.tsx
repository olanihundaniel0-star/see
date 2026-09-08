import { useMemo, useState } from "react";
import { Link, router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Pressable, ScrollView, Text, View } from "react-native";

import { GlassCard } from "@/components/glass/GlassCard";
import { GlassPill } from "@/components/glass/GlassPill";
import { AsciiBanner } from "@/components/ui/AsciiBanner";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import { ScreenState } from "@/components/ui/ScreenState";
import { theme } from "@/constants/theme";
import { formatCountdown, formatShortDateTime } from "@/lib/format";
import { Reminder, useInfiniteReminders, useUpdateReminder } from "@/lib/queries";

const filters: Array<{ label: string; value: "all" | "open" | "completed" }> = [
  { label: "ALL", value: "all" },
  { label: "OPEN", value: "open" },
  { label: "DONE", value: "completed" }
];

export default function RemindersScreen() {
  const [activeFilter, setActiveFilter] = useState<"all" | "open" | "completed">("all");
  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteReminders();
  const updateReminder = useUpdateReminder();

  const reminders = useMemo(() => data?.pages.flatMap((page) => page) ?? [], [data]);
  const filteredReminders = useMemo(() => {
    if (activeFilter === "all") return reminders;
    return reminders.filter((reminder) => (activeFilter === "open" ? !reminder.is_completed : reminder.is_completed));
  }, [activeFilter, reminders]);

  const counts = useMemo(
    () => ({
      all: reminders.length,
      open: reminders.filter((item) => !item.is_completed).length,
      completed: reminders.filter((item) => item.is_completed).length
    }),
    [reminders]
  );

  return (
    <ScrollView className="flex-1 bg-black" contentContainerClassName="px-4 pb-28 pt-4">
      <View className="gap-4">
        <AsciiBanner title={theme.ascii.pipeline} subtitle="Reminder inbox and completion queue" right={isLoading ? "[SYNC]" : "[REMINDERS]"} />

        <GlassCard className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">// FILTERS</Text>
            <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-400">[{counts.all}] ITEMS</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {filters.map((filter) => {
              const active = filter.value === activeFilter;
              const count = counts[filter.value];
              return (
                <Pressable
                  key={filter.value}
                  onPress={async () => {
                    await Haptics.selectionAsync();
                    setActiveFilter(filter.value);
                  }}
                  className={`rounded-lg border px-4 py-2 ${active ? "border-white/20 bg-zinc-900/70" : "border-white/10 bg-zinc-950/50"}`}
                >
                  <Text className="font-mono text-[10px] tracking-[0.18em] text-white">
                    {filter.label} {count}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </GlassCard>

        {error ? (
          <ScreenState
            title="// REMINDERS_ERROR"
            message="Unable to load reminders."
            label="[ RETRY ]"
            onPress={() => void refetch()}
          />
        ) : null}

        {!error && isLoading ? <ScreenState title="// REMINDERS_BOOT" message="Loading reminders." /> : null}

        <View className="gap-3">
          {!error && !isLoading
            ? filteredReminders.map((reminder) => (
                <GlassCard key={reminder.id} className="gap-3">
                  <Pressable onPress={() => router.push(`/reminders/${reminder.id}`)} className="gap-3">
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1 gap-1">
                        <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">
                          {reminder.is_completed ? "COMPLETED" : "PENDING"}
                        </Text>
                        <Text className={`text-xl font-bold ${reminder.is_completed ? "text-zinc-500 line-through" : "text-white"}`}>
                          {reminder.title}
                        </Text>
                      </View>
                      <GlassPill label="COUNTDOWN" value={formatCountdown(reminder.due_date)} tone={reminder.priority === "high" ? "danger" : "active"} />
                    </View>

                    <View className="flex-row gap-2">
                      <GlassPill label="DUE" value={formatShortDateTime(reminder.due_date)} className="flex-1" />
                      <GlassPill label="PRIORITY" value={reminder.priority.toUpperCase()} className="flex-1" tone="active" />
                    </View>
                  </Pressable>

                  <View className="flex-row gap-2">
                    <Pressable
                      disabled={updateReminder.isPending}
                      onPress={async () => {
                        await Haptics.selectionAsync();
                        await updateReminder.mutateAsync({
                          id: reminder.id,
                          data: { is_completed: !reminder.is_completed }
                        });
                      }}
                      className="flex-1 rounded-lg border border-white/20 bg-white px-3 py-2 disabled:opacity-60"
                    >
                      <Text className="text-center font-mono text-[10px] font-bold text-black">
                        {reminder.is_completed ? "[ MARK OPEN ]" : "[ MARK DONE ]"}
                      </Text>
                    </Pressable>
                    <Link href={`/reminders/${reminder.id}`} asChild>
                      <Pressable className="flex-1 rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-2 active:scale-[0.99]">
                        <Text className="text-center font-mono text-[10px] text-white">[OPEN]</Text>
                      </Pressable>
                    </Link>
                  </View>
                </GlassCard>
              ))
            : null}
        </View>

        {!error && !isLoading && !filteredReminders.length ? (
          <ScreenState title="// EMPTY_REMINDERS" message="No reminders match this filter." />
        ) : null}

        {!error && hasNextPage ? <LoadMoreButton onPress={() => void fetchNextPage()} busy={isFetchingNextPage} /> : null}
      </View>
    </ScrollView>
  );
}
