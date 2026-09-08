import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import { GlassCard } from "@/components/glass/GlassCard";
import { GlassInput } from "@/components/glass/GlassInput";
import { GlassPill } from "@/components/glass/GlassPill";
import { Checkbox } from "@/components/ui/Checkbox";
import { AsciiBanner } from "@/components/ui/AsciiBanner";
import { ScreenState } from "@/components/ui/ScreenState";
import { theme } from "@/constants/theme";
import { formatShortDateTime } from "@/lib/format";
import { ReminderPriority, useDeleteReminder, useReminder, useUpdateReminder } from "@/lib/queries";

const priorityOptions: ReminderPriority[] = ["low", "medium", "high"];

export default function ReminderDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const reminderId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : undefined;
  const { data: reminder, isLoading, error, refetch } = useReminder(reminderId);
  const updateReminder = useUpdateReminder();
  const deleteReminder = useDeleteReminder();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<ReminderPriority>("medium");
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (reminder) {
      setTitle(reminder.title);
      setDueDate(reminder.due_date);
      setPriority(reminder.priority);
      setIsCompleted(reminder.is_completed);
    }
  }, [reminder]);

  return (
    <>
      <Stack.Screen options={{ title: "Reminder Detail" }} />
      <ScrollView className="flex-1 bg-black" contentContainerClassName="px-4 pb-28 pt-4">
        <View className="gap-4">
          <AsciiBanner title={theme.ascii.pipeline} subtitle="Reminder edit and completion control" right="[REMINDER]" />

          {error ? (
            <ScreenState title="// REMINDER_ERROR" message="Unable to load this reminder." label="[ RETRY ]" onPress={() => void refetch()} />
          ) : null}

          {!error && isLoading ? <ScreenState title="// REMINDER_BOOT" message="Loading reminder record." /> : null}

          {reminder ? (
            <GlassCard className="gap-3">
              <View className="flex-row items-start justify-between gap-3">
                <View className="gap-1">
                  <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">{formatShortDateTime(reminder.created_at)}</Text>
                  <Text className="text-xl font-bold text-white">{reminder.title}</Text>
                </View>
                <GlassPill label="PRIORITY" value={reminder.priority.toUpperCase()} tone={reminder.priority === "high" ? "danger" : "active"} />
              </View>

              <GlassInput label="TITLE" value={title} onChangeText={setTitle} />
              <GlassInput label="DUE_DATE" value={dueDate} onChangeText={setDueDate} placeholder="2026-09-08T10:00:00Z" />

              <View className="gap-2">
                <Text className="px-1 font-mono text-[10px] tracking-[0.18em] text-zinc-500">PRIORITY</Text>
                <View className="flex-row gap-2">
                  {priorityOptions.map((value) => {
                    const active = value === priority;
                    return (
                      <Pressable
                        key={value}
                        onPress={async () => {
                          await Haptics.selectionAsync();
                          setPriority(value);
                        }}
                        className={`flex-1 rounded-lg border px-3 py-3 ${active ? "border-white/20 bg-white" : "border-white/10 bg-zinc-950/70"}`}
                      >
                        <Text className={`text-center font-mono text-[10px] font-bold ${active ? "text-black" : "text-white"}`}>
                          {value.toUpperCase()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Checkbox checked={isCompleted} label="Completed" onChange={setIsCompleted} />

              <View className="flex-row gap-2">
                <Pressable
                  disabled={updateReminder.isPending || !title.trim() || !dueDate.trim()}
                  onPress={async () => {
                    await Haptics.selectionAsync();
                    await updateReminder.mutateAsync({
                      id: reminder.id,
                      data: {
                        title: title.trim(),
                        due_date: new Date(dueDate).toISOString(),
                        priority,
                        is_completed: isCompleted
                      }
                    });
                  }}
                  className="flex-1 rounded-lg border border-white/20 bg-white px-3 py-3 disabled:opacity-60"
                >
                  <Text className="text-center font-mono text-[10px] font-bold text-black">
                    {updateReminder.isPending ? "[SAVING]" : "[SAVE REMINDER]"}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={deleteReminder.isPending}
                  onPress={async () => {
                    await Haptics.selectionAsync();
                    Alert.alert("Delete reminder?", reminder.title, [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => {
                          void deleteReminder.mutateAsync(reminder.id).then(() => router.back());
                        }
                      }
                    ]);
                  }}
                  className="rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-3 disabled:opacity-60"
                >
                  <Text className="text-center font-mono text-[10px] text-white">[DELETE]</Text>
                </Pressable>
              </View>
            </GlassCard>
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}
