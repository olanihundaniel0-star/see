import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from "react";
import { Alert, Platform, Pressable, Text, TextInput, type TextInputProps, View } from "react-native";
import { router, Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput
} from "@gorhom/bottom-sheet";

import { useQuickAdd, type JobStatus } from "@/lib/queries";

type Mode = "job" | "note" | "reminder";

const modes: { id: Mode; label: string }[] = [
  { id: "job", label: "[01: JOB]" },
  { id: "note", label: "[02: NOTE]" },
  { id: "reminder", label: "[03: REMIND]" }
];

const jobStatusOptions: { id: JobStatus; label: string }[] = [
  { id: "bookmarked", label: "[BOOKMARKED]" },
  { id: "applied", label: "[APPLIED]" },
  { id: "interviewing", label: "[INTERVIEW]" }
];

const priorityOptions = ["low", "medium", "high"] as const;

type SheetInputRef = NonNullable<ComponentRef<typeof BottomSheetTextInput>>;
type SheetInputProps = TextInputProps & { inputRef?: RefObject<SheetInputRef | null> };

const sheetInputClassName = "flex-1 bg-transparent font-mono text-sm text-white";

function SheetInput({ inputRef, ...props }: SheetInputProps) {
  if (Platform.OS === "ios") {
    return (
      <BottomSheetTextInput
        ref={inputRef}
        className={sheetInputClassName}
        placeholderTextColor="#52525B"
        {...props}
      />
    );
  }
  return (
    <TextInput
      ref={inputRef}
      className={sheetInputClassName}
      placeholderTextColor="#52525B"
      {...props}
    />
  );
}

function FieldBox({
  label,
  req,
  focused,
  children
}: {
  label: string;
  req?: boolean;
  focused?: boolean;
  children: ReactNode;
}) {
  return (
    <View className="gap-1">
      <View className="flex-row items-center justify-between px-1">
        <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">{`> ${label}`}</Text>
        <Text className="font-mono text-[10px] tracking-[0.08em] text-[#52525B]">{req ? "[REQ]" : "[OPT]"}</Text>
      </View>
      <View
        className={`flex-row items-center rounded border px-3 py-3 ${
          focused ? "border-white/[0.40] bg-[rgba(9,9,11,0.70)]" : "border-white/[0.12] bg-[rgba(9,9,11,0.70)]"
        }`}
      >
        {children}
      </View>
    </View>
  );
}

function Adornment() {
  return <Text className="ml-2 shrink-0 font-mono text-[10px] text-[#8f9194]">_</Text>;
}

export default function QuickAddModal() {
  const sheetRef = useRef<BottomSheetModal>(null);
  const firstFieldRef = useRef<SheetInputRef>(null);
  const closingRef = useRef(false);
  const snapPoints = useMemo(() => ["60%", "92%"], []);
  const quickAdd = useQuickAdd();
  const [mode, setMode] = useState<Mode>("job");
  const [saving, setSaving] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const closeModal = () => {
    if (closingRef.current) {
      return;
    }
    closingRef.current = true;
    router.back();
  };

  const [jobForm, setJobForm] = useState({
    company: "",
    role: "",
    location: "",
    salary_range: "",
    job_url: "",
    deadline: "",
    status: "applied" as JobStatus
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

  const focusProps = (key: string) => ({
    onFocus: () => setFocusedKey(key),
    onBlur: () => setFocusedKey((current) => (current === key ? null : current))
  });

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
            status: jobForm.status,
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
      closeModal();
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
        index={1}
        snapPoints={snapPoints}
        enablePanDownToClose
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        backdropComponent={(props) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />}
        backgroundStyle={{ backgroundColor: "rgba(24,24,27,0.85)", borderRadius: 12, borderColor: "rgba(255,255,255,0.25)", borderWidth: 1 } as any}
        handleIndicatorStyle={{ backgroundColor: "transparent", width: 0 } as any}
        onDismiss={closeModal}
      >
        <BottomSheetScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
          keyboardShouldPersistTaps="handled"
        >
              <View className="items-center pt-1">
                <View className="h-1 w-12 rounded-full bg-white/20" />
              </View>

              <View className="flex-row items-start justify-between">
                <View className="gap-1">
                  <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">{"// RAPID_CAPTURE_TERMINAL"}</Text>
                  <Text className="text-xl font-sans-bold uppercase tracking-tight text-white">Queue Record</Text>
                </View>
                <Pressable
                  onPress={closeModal}
                  className="h-8 w-8 items-center justify-center rounded border border-white/[0.08] bg-[#353535] active:scale-95"
                >
                  <Text className="font-mono text-[10px] text-white">[X]</Text>
                </Pressable>
              </View>

              <View className="flex-row gap-2 rounded-lg bg-[#0e0e0e] p-1">
                {modes.map((entry) => {
                  const active = entry.id === mode;
                  return (
                    <Pressable
                      key={entry.id}
                      onPress={async () => {
                        await Haptics.selectionAsync();
                        setMode(entry.id);
                      }}
                      className={`flex-1 rounded border-0 px-3 py-3 active:scale-95 ${
                        active ? "bg-white" : "bg-transparent"
                      }`}
                    >
                      <Text className={`text-center font-mono text-[10px] tracking-[0.08em] ${active ? "font-mono-bold text-black" : "text-white"}`}>
                        {entry.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {mode === "job" ? (
                <View className="gap-3">
                  <FieldBox label="TARGET_COMPANY" req focused={focusedKey === "job-company"}>
                    <SheetInput
                      inputRef={firstFieldRef}
                      placeholder="e.g. Anthropic, Moniepoint"
                      maxLength={150}
                      value={jobForm.company}
                      onChangeText={(company) => setJobForm((current) => ({ ...current, company }))}
                      {...focusProps("job-company")}
                    />
                    <Adornment />
                  </FieldBox>
                  <FieldBox label="ROLE_TITLE" req focused={focusedKey === "job-role"}>
                    <SheetInput
                      placeholder="e.g. Distributed Systems Engineer"
                      maxLength={150}
                      value={jobForm.role}
                      onChangeText={(role) => setJobForm((current) => ({ ...current, role }))}
                      {...focusProps("job-role")}
                    />
                    <Adornment />
                  </FieldBox>
                  <View className="gap-1">
                    <Text className="px-1 font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">{"> PIPELINE_STATE"}</Text>
                    <View className="flex-row gap-2">
                      {jobStatusOptions.map((option) => {
                        const active = jobForm.status === option.id;
                        return (
                          <Pressable
                            key={option.id}
                            onPress={async () => {
                              await Haptics.selectionAsync();
                              setJobForm((current) => ({ ...current, status: option.id }));
                            }}
                            className={`flex-1 rounded border-0 px-2 py-2 active:scale-95 ${
                              active ? "bg-white" : "bg-[#1f1f1f]"
                            }`}
                          >
                            <Text
                              className={`text-center font-mono text-[10px] tracking-[0.08em] ${active ? "font-mono-bold text-black" : "text-white"}`}
                              numberOfLines={1}
                            >
                              {active ? option.label.replace("]", " *]") : option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <FieldBox label="LOCATION" focused={focusedKey === "job-location"}>
                    <SheetInput
                      placeholder="Lagos / Remote"
                      maxLength={150}
                      value={jobForm.location}
                      onChangeText={(location) => setJobForm((current) => ({ ...current, location }))}
                      {...focusProps("job-location")}
                    />
                    <Adornment />
                  </FieldBox>
                  <FieldBox label="EST_COMP" focused={focusedKey === "job-salary"}>
                    <SheetInput
                      placeholder="$150k - $210k"
                      maxLength={100}
                      value={jobForm.salary_range}
                      onChangeText={(salary_range) => setJobForm((current) => ({ ...current, salary_range }))}
                      {...focusProps("job-salary")}
                    />
                    <Adornment />
                  </FieldBox>
                  <FieldBox label="JOB_URL" focused={focusedKey === "job-url"}>
                    <SheetInput
                      placeholder="https://..."
                      autoCapitalize="none"
                      keyboardType="url"
                      maxLength={2048}
                      value={jobForm.job_url}
                      onChangeText={(job_url) => setJobForm((current) => ({ ...current, job_url }))}
                      {...focusProps("job-url")}
                    />
                    <Adornment />
                  </FieldBox>
                  <FieldBox label="DEADLINE" focused={focusedKey === "job-deadline"}>
                    <SheetInput
                      placeholder="2026-09-20 // 23:59"
                      autoCapitalize="none"
                      maxLength={100}
                      value={jobForm.deadline}
                      onChangeText={(deadline) => setJobForm((current) => ({ ...current, deadline }))}
                      {...focusProps("job-deadline")}
                    />
                    <Adornment />
                  </FieldBox>
                </View>
              ) : null}

              {mode === "note" ? (
                <View className="gap-3">
                  <FieldBox label="NOTE_TITLE" req focused={focusedKey === "note-title"}>
                    <SheetInput
                      inputRef={firstFieldRef}
                      placeholder="Note title"
                      maxLength={255}
                      value={noteForm.title}
                      onChangeText={(title) => setNoteForm((current) => ({ ...current, title }))}
                      {...focusProps("note-title")}
                    />
                    <Adornment />
                  </FieldBox>
                  <View className="gap-1">
                    <View className="flex-row items-center justify-between px-1">
                      <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">{"> MARKDOWN_BODY"}</Text>
                      <Text className="font-mono text-[10px] tracking-[0.08em] text-[#52525B]">[REQ]</Text>
                    </View>
                    <View
                      className={`rounded border px-3 py-3 ${
                        focusedKey === "note-content" ? "border-white/[0.40] bg-[rgba(9,9,11,0.70)]" : "border-white/[0.12] bg-[rgba(9,9,11,0.70)]"
                      }`}
                    >
                      <SheetInput
                        placeholder="Markdown content"
                        multiline
                        numberOfLines={6}
                        textAlignVertical="top"
                        className="min-h-[140px] flex-1 bg-transparent font-mono text-sm text-white"
                        maxLength={20000}
                        value={noteForm.content}
                        onChangeText={(content) => setNoteForm((current) => ({ ...current, content }))}
                        {...focusProps("note-content")}
                      />
                    </View>
                  </View>
                  <FieldBox label="TAGS" focused={focusedKey === "note-tags"}>
                    <SheetInput
                      placeholder="#tags, comma separated"
                      maxLength={255}
                      value={noteForm.tags}
                      onChangeText={(tags) => setNoteForm((current) => ({ ...current, tags }))}
                      {...focusProps("note-tags")}
                    />
                    <Adornment />
                  </FieldBox>
                </View>
              ) : null}

              {mode === "reminder" ? (
                <View className="gap-3">
                  <FieldBox label="REMINDER_TITLE" req focused={focusedKey === "reminder-title"}>
                    <SheetInput
                      inputRef={firstFieldRef}
                      placeholder="Reminder title"
                      maxLength={255}
                      value={reminderForm.title}
                      onChangeText={(title) => setReminderForm((current) => ({ ...current, title }))}
                      {...focusProps("reminder-title")}
                    />
                    <Adornment />
                  </FieldBox>
                  <FieldBox label="DUE_DATE" req focused={focusedKey === "reminder-due"}>
                    <SheetInput
                      placeholder="2026-09-20T23:59:00Z"
                      autoCapitalize="none"
                      maxLength={100}
                      value={reminderForm.due_date}
                      onChangeText={(due_date) => setReminderForm((current) => ({ ...current, due_date }))}
                      {...focusProps("reminder-due")}
                    />
                    <Adornment />
                  </FieldBox>
                  <View className="gap-1">
                    <Text className="px-1 font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">{"> PRIORITY"}</Text>
                    <View className="flex-row gap-2">
                      {priorityOptions.map((priority) => {
                        const active = reminderForm.priority === priority;
                        return (
                          <Pressable
                            key={priority}
                            onPress={async () => {
                              await Haptics.selectionAsync();
                              setReminderForm((current) => ({ ...current, priority }));
                            }}
                            className={`flex-1 rounded border-0 px-2 py-2 active:scale-95 ${
                              active ? "bg-white" : "bg-[#1f1f1f]"
                            }`}
                          >
                            <Text className={`text-center font-mono text-[10px] tracking-[0.08em] ${active ? "font-mono-bold text-black" : "text-white"}`}>
                              [{priority.toUpperCase()}]
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </View>
              ) : null}

              <View className="flex-row items-center justify-between rounded border border-white/[0.12] bg-[rgba(9,9,11,0.70)] px-3 py-3">
                <Pressable
                  onPress={async () => {
                    await Haptics.selectionAsync();
                    setSyncEnabled((current) => !current);
                  }}
                  className="flex-row items-center gap-2"
                >
                  <View
                    className={`h-4 w-4 items-center justify-center rounded-[2px] border ${
                      syncEnabled ? "border-transparent bg-white" : "border-white/20 bg-transparent"
                    }`}
                  >
                    {syncEnabled ? <Text className="font-mono text-[10px] leading-[12px] text-black">■</Text> : null}
                  </View>
                  <Text className="font-mono text-[11px] text-[#e2e2e2]">Auto-sync to backend queue</Text>
                </Pressable>
                <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">
                  {syncEnabled ? "[CRON_ON]" : "[CRON_OFF]"}
                </Text>
              </View>

              <Pressable
                onPress={submit}
                disabled={saving}
                className="flex-row items-center justify-center gap-2 rounded border-0 bg-white px-4 py-4 disabled:opacity-60 active:scale-[0.98]"
              >
                <Text className="text-center font-mono-bold text-[10px] tracking-[0.08em] text-black">
                  {saving ? "[ SYNCING RECORD... ]" : `[ CAPTURE -> ${mode.toUpperCase()} ]`}
                </Text>
                <Text className="font-mono-bold text-[12px] text-black">→</Text>
              </Pressable>

              <Pressable
                onPress={closeModal}
                className="rounded border border-white/[0.10] bg-transparent px-4 py-3 active:scale-[0.99]"
              >
                <Text className="text-center font-mono text-[10px] tracking-[0.08em] text-white">[ CANCEL ]</Text>
              </Pressable>

              <View className="flex-row items-center justify-between px-1">
                <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]" numberOfLines={1}>
                  OPTIMISTIC_SYNC: LOCAL_CACHE -&gt; CELERY_QUEUE
                </Text>
                <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-white">
                  {saving ? "[SYNCING]" : "[READY]"}
                </Text>
              </View>
        </BottomSheetScrollView>
      </BottomSheetModal>
    </>
  );
}
