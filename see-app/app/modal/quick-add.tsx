import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, type TextInputProps, View } from "react-native";
import { router, Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView
} from "@gorhom/bottom-sheet";

import { GlassCard } from "@/components/glass/GlassCard";
import { GlassInput } from "@/components/glass/GlassInput";
import { GlassPill } from "@/components/glass/GlassPill";
import { useQuickAdd } from "@/lib/queries";

type Mode = "job" | "note" | "reminder";

const modes: { id: Mode; label: string }[] = [
  { id: "job", label: "[ 01: JOB ]" },
  { id: "note", label: "[ 02: NOTE ]" },
  { id: "reminder", label: "[ 03: ALERT ]" }
];

const priorityOptions = ["low", "medium", "high"] as const;

function SheetInput({ inputRef, ...props }: TextInputProps & { inputRef?: RefObject<any> }) {
  return (
    <BottomSheetTextInput
      ref={inputRef}
      className="rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-3 font-mono text-white placeholder:text-zinc-600"
      placeholderTextColor="#52525B"
      {...props}
    />
  );
}

export default function QuickAddModal() {
  const sheetRef = useRef<BottomSheetModal>(null);
  const firstFieldRef = useRef<any>(null);
  const snapPoints = useMemo(() => ["84%"], []);
  const quickAdd = useQuickAdd();
  const [mode, setMode] = useState<Mode>("job");
  const [saving, setSaving] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(true);

  const [jobForm, setJobForm] = useState({
    company: "",
    role: "",
    location: "",
    salary_range: "",
    job_url: "",
    deadline: ""
  });
  const [noteForm, setNoteForm] = useState({
    title: "",
    content: "",
    tags: ""
  });
  const [reminderForm, setReminderForm] = useState({
    title: "",
    due_date: "",
    priority: "medium"
  });

  useEffect(() => {
    sheetRef.current?.present();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => firstFieldRef.current?.focus(), 180);
    return () => clearTimeout(timer);
  }, [mode]);

  const submit = async () => {
    if (saving) {
      return;
    }

    try {
      setSaving(true);

      if (!syncEnabled) {
        throw new Error("Sync must be enabled to capture to the backend.");
      }

      if (mode === "job") {
        if (!jobForm.company.trim() || !jobForm.role.trim()) {
          throw new Error("Company and role are required.");
        }

        await quickAdd.mutateAsync({
          type: "job",
          title: jobForm.company.trim(),
          data: {
            company: jobForm.company.trim(),
            role: jobForm.role.trim(),
            location: jobForm.location.trim() || null,
            salary_range: jobForm.salary_range.trim() || null,
            job_url: jobForm.job_url.trim() || null,
            status: "applied",
            interview_notes: null,
            deadline: jobForm.deadline ? new Date(jobForm.deadline).toISOString() : null
          }
        });
      }

      if (mode === "note") {
        if (!noteForm.title.trim() || !noteForm.content.trim()) {
          throw new Error("Title and content are required.");
        }

        await quickAdd.mutateAsync({
          type: "note",
          title: noteForm.title.trim(),
          data: {
            title: noteForm.title.trim(),
            content: noteForm.content.trim(),
            tags: noteForm.tags.trim() || null
          }
        });
      }

      if (mode === "reminder") {
        if (!reminderForm.title.trim() || !reminderForm.due_date.trim()) {
          throw new Error("Title and due date are required.");
        }

        const priority = priorityOptions.includes(reminderForm.priority as (typeof priorityOptions)[number])
          ? reminderForm.priority
          : "medium";

        const dueDate = new Date(reminderForm.due_date);
        if (Number.isNaN(dueDate.getTime())) {
          throw new Error("Due date must be a valid ISO 8601 timestamp.");
        }

        await quickAdd.mutateAsync({
          type: "reminder",
          title: reminderForm.title.trim(),
          data: {
            title: reminderForm.title.trim(),
            due_date: dueDate.toISOString(),
            priority
          }
        });
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Capture failed", error instanceof Error ? error.message : "Unable to submit quick add.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Quick Add" }} />
      <BottomSheetModal
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={(props) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />}
        backgroundStyle={{ backgroundColor: "rgba(9, 9, 11, 0.96)" }}
        handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.25)" }}
        onDismiss={() => router.back()}
      >
        <BottomSheetView className="flex-1 px-4 pb-6">
          <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: undefined })} className="flex-1">
            <View className="flex-1 gap-4">
              <View className="flex-row items-center justify-between">
                <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">// QUICK_ADD</Text>
                <Pressable onPress={() => router.back()}>
                  <Text className="font-mono text-[10px] tracking-[0.18em] text-white">[x CLOSE]</Text>
                </Pressable>
              </View>

              <View className="flex-row gap-2">
                {modes.map((entry) => {
                  const active = entry.id === mode;
                  return (
                    <Pressable
                      key={entry.id}
                      onPress={async () => {
                        await Haptics.selectionAsync();
                        setMode(entry.id);
                      }}
                      className={`flex-1 rounded-lg border px-3 py-3 ${
                        active ? "border-white/20 bg-zinc-900/70" : "border-white/10 bg-zinc-950/50"
                      }`}
                    >
                      <Text className="text-center font-mono text-[10px] tracking-[0.18em] text-white">{entry.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <GlassCard className="gap-3">
                <View className="flex-row items-center justify-between">
                  <GlassPill label="SYNC" value={syncEnabled ? "ONLINE" : "PAUSED"} tone={syncEnabled ? "active" : "default"} />
                  <Pressable
                    onPress={async () => {
                      await Haptics.selectionAsync();
                      setSyncEnabled((current) => !current);
                    }}
                    className="rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-2"
                  >
                    <Text className="font-mono text-[10px] tracking-[0.16em] text-white">
                      {syncEnabled ? "[SYNC ENABLED]" : "[SYNC DISABLED]"}
                    </Text>
                  </Pressable>
                </View>
                <Text className="font-mono text-[11px] text-zinc-400">
                  Optimistic capture writes directly into the backend collections and refreshes dashboards after commit.
                </Text>
              </GlassCard>

              {mode === "job" ? (
                <View className="gap-3">
                  <SheetInput
                    inputRef={firstFieldRef}
                    autoFocus
                    placeholder="Company"
                    value={jobForm.company}
                    onChangeText={(company) => setJobForm((current) => ({ ...current, company }))}
                  />
                  <GlassInput
                    placeholder="Role"
                    value={jobForm.role}
                    onChangeText={(role) => setJobForm((current) => ({ ...current, role }))}
                  />
                  <GlassInput
                    placeholder="Location"
                    value={jobForm.location}
                    onChangeText={(location) => setJobForm((current) => ({ ...current, location }))}
                  />
                  <GlassInput
                    placeholder="Salary range"
                    value={jobForm.salary_range}
                    onChangeText={(salary_range) => setJobForm((current) => ({ ...current, salary_range }))}
                  />
                  <GlassInput
                    placeholder="Job URL"
                    autoCapitalize="none"
                    keyboardType="url"
                    value={jobForm.job_url}
                    onChangeText={(job_url) => setJobForm((current) => ({ ...current, job_url }))}
                  />
                  <GlassInput
                    placeholder="Deadline ISO 8601"
                    autoCapitalize="none"
                    value={jobForm.deadline}
                    onChangeText={(deadline) => setJobForm((current) => ({ ...current, deadline }))}
                  />
                </View>
              ) : null}

              {mode === "note" ? (
                <View className="gap-3">
                  <SheetInput
                    inputRef={firstFieldRef}
                    autoFocus
                    placeholder="Note title"
                    value={noteForm.title}
                    onChangeText={(title) => setNoteForm((current) => ({ ...current, title }))}
                  />
                  <GlassInput
                    placeholder="Markdown content"
                    multiline
                    numberOfLines={6}
                    className="min-h-[140px]"
                    value={noteForm.content}
                    onChangeText={(content) => setNoteForm((current) => ({ ...current, content }))}
                  />
                  <GlassInput
                    placeholder="#tags, comma separated"
                    value={noteForm.tags}
                    onChangeText={(tags) => setNoteForm((current) => ({ ...current, tags }))}
                  />
                </View>
              ) : null}

              {mode === "reminder" ? (
                <View className="gap-3">
                  <SheetInput
                    inputRef={firstFieldRef}
                    autoFocus
                    placeholder="Reminder title"
                    value={reminderForm.title}
                    onChangeText={(title) => setReminderForm((current) => ({ ...current, title }))}
                  />
                  <GlassInput
                    placeholder="Due date ISO 8601"
                    autoCapitalize="none"
                    value={reminderForm.due_date}
                    onChangeText={(due_date) => setReminderForm((current) => ({ ...current, due_date }))}
                  />
                  <GlassInput
                    placeholder="Priority: low | medium | high"
                    autoCapitalize="none"
                    value={reminderForm.priority}
                    onChangeText={(priority) => setReminderForm((current) => ({ ...current, priority }))}
                  />
                </View>
              ) : null}

              <Pressable
                onPress={submit}
                disabled={saving}
                className="mt-auto rounded-xl border border-white/20 bg-white px-4 py-4 disabled:opacity-60"
              >
                <Text className="text-center font-mono text-[10px] font-bold text-black">
                  {saving ? "[ CAPTURING... ]" : `[ CAPTURE -> ${mode.toUpperCase()} ]`}
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
}
