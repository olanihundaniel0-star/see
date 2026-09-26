import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import { GlassCard } from "@/components/glass/GlassCard";
import { GlassInput } from "@/components/glass/GlassInput";
import { Checkbox } from "@/components/ui/Checkbox";
import { AsciiBanner } from "@/components/ui/AsciiBanner";
import { theme } from "@/constants/theme";
import { formatProgress, formatShortDateTime } from "@/lib/format";
import {
  JobStatus,
  useCreateChecklist,
  useDeleteJob,
  useJob,
  useJobChecklists,
  useToggleChecklist,
  useUpdateJob
} from "@/lib/queries";

const stageNodes: JobStatus[] = ["bookmarked", "applied", "assessment", "interviewing", "offer"];
const terminalStatuses: JobStatus[] = ["rejected", "archived"];

function isTerminal(status: JobStatus): boolean {
  return terminalStatuses.includes(status);
}

function nextStage(status: JobStatus): JobStatus {
  if (isTerminal(status)) {
    return status;
  }
  const index = stageNodes.indexOf(status);
  return stageNodes[Math.min(index + 1, stageNodes.length - 1)];
}

function stageIndex(status: JobStatus) {
  return stageNodes.indexOf(status);
}

const OPENABLE_URL_RE = /^https?:\/\//i;

function isOpenableUrl(value: unknown): value is string {
  return typeof value === "string" && OPENABLE_URL_RE.test(value.trim());
}

async function openExternalUrl(url: string, failureTitle: string) {
  if (!isOpenableUrl(url)) {
    Alert.alert(failureTitle, "The link for this item is invalid.");
    return;
  }
  const trimmed = url.trim();
  try {
    const supported = await Linking.canOpenURL(trimmed);
    if (!supported) {
      Alert.alert(failureTitle, "No app can open this link on this device.");
      return;
    }
    await Linking.openURL(trimmed);
  } catch (error) {
    Alert.alert(failureTitle, error instanceof Error ? error.message : "The link could not be opened.");
  }
}

export default function JobDossierScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const jobId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : undefined;
  const { data: job, isLoading, error } = useJob(jobId);
  const { data: checklistItems } = useJobChecklists(jobId);
  const updateJob = useUpdateJob();
  const toggleChecklist = useToggleChecklist(jobId);
  const createChecklist = useCreateChecklist(jobId);
  const deleteJob = useDeleteJob();
  const [newChecklist, setNewChecklist] = useState("");
  const [scratchpad, setScratchpad] = useState("");

  useEffect(() => {
    setScratchpad(job?.interview_notes ?? "");
  }, [job?.interview_notes]);

  const items = checklistItems ?? job?.checklists ?? [];
  const completed = items.filter((item) => item.is_completed).length;
  const progress = formatProgress(completed, items.length);
  const activeStage = job && !isTerminal(job.status) ? stageIndex(job.status) : -1;
  const deadline = job?.deadline ? formatShortDateTime(job.deadline).toUpperCase() : "NO DEADLINE";
  const syncEpoch = job?.updated_at ? Math.floor(new Date(job.updated_at).getTime() / 1000) : 0;

  const summaryRows = useMemo(
    () => [
      { label: "LOCATION", value: (job?.location ?? "REMOTE").toUpperCase() },
      { label: "COMP_BAND", value: (job?.salary_range ?? "N/A").toUpperCase() },
      { label: "APPLIED", value: job?.applied_at ? formatShortDateTime(job.applied_at).toUpperCase() : "N/A" },
      { label: "UPDATED", value: job?.updated_at ? formatShortDateTime(job.updated_at).toUpperCase() : "N/A" },
      { label: "PORTAL", value: (job?.job_url ?? "N/A").toUpperCase() },
      { label: "DEADLINE", value: deadline }
    ],
    [job, deadline]
  );

  return (
    <>
      <Stack.Screen options={{ title: "Application Dossier" }} />
      <ScrollView className="flex-1 bg-black" contentContainerClassName="px-4 pb-28 pt-4">
        <View className="gap-3">
          <AsciiBanner title={theme.ascii.dossier} subtitle={job ? `Application ${job.company}` : "Application dossier"} right="[DOSSIER]" />

          {job ? (
            <View className="flex-row items-center justify-between rounded-lg bg-[#0e0e0e] px-3 py-2">
              <View className="min-w-0 flex-1 flex-row items-center gap-2">
                <View className="h-2 w-2 shrink-0 rounded-full bg-white opacity-90" />
                <Text className="font-mono text-[10px] tracking-[0.08em] text-white" numberOfLines={1}>
                  {"// DOSSIER: "}
                  {job.company.toUpperCase()}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="font-mono text-[10px] tracking-[0.08em] text-[#c5c6ca]">
                  SYNC_EPOCH: {syncEpoch}
                </Text>
                <Text className="font-mono text-[10px] tracking-[0.08em] text-white">[LIVE]</Text>
              </View>
            </View>
          ) : null}

          {error ? (
            <GlassCard className="gap-3">
              <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">{"// DOSSIER_ERROR"}</Text>
              <Text className="text-xl font-sans-bold text-white">Unable to load this job.</Text>
              <Text className="font-mono text-[11px] text-[#c5c6ca]">The backend did not return a dossier for this id.</Text>
            </GlassCard>
          ) : null}

          {job ? (
            <>
              <GlassCard className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="font-mono text-[10px] tracking-[0.16em] text-[#8f9194]">{"// LIFECYCLE_STAGE"}</Text>
                  <Text className="font-mono text-[10px] tracking-[0.08em] text-white">
                    {isTerminal(job.status)
                      ? `[${job.status.toUpperCase()}]`
                      : `[STAGE ${activeStage + 1}/${stageNodes.length}]`}
                  </Text>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="min-w-full flex-row items-center">
                    {stageNodes.map((stage, index) => {
                      const isDone = index < activeStage;
                      const isActive = index === activeStage;
                      return (
                        <View key={stage} className="flex-row items-center">
                          <View className="items-center gap-1">
                            <Text
                              className={`font-mono text-[10px] tracking-[0.08em] ${
                                isActive
                                  ? "rounded bg-[#353535] px-2 py-0.5 text-white"
                                  : isDone
                                    ? "text-[#8f9194] line-through opacity-70"
                                    : "text-[#8f9194] opacity-40"
                              }`}
                            >
                              {isActive ? `● ${stage.toUpperCase()}` : `[${stage.toUpperCase()}]`}
                            </Text>
                            <View
                              className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-white" : isDone ? "bg-[#8f9194]" : "bg-[#353535]"}`}
                            />
                          </View>
                          {index < stageNodes.length - 1 ? (
                            <View className="mx-1 h-px w-6 bg-[#353535]" />
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>

                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 gap-1">
                    <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">{job.company.toUpperCase()}</Text>
                    <Text className="font-sans-bold text-2xl tracking-tight text-white">{job.role}</Text>
                  </View>
                  <View className="shrink-0 flex-row items-center gap-1.5 rounded-full bg-[#353535]/90 px-3 py-1">
                    <View className="h-1.5 w-1.5 rounded-full bg-white opacity-90" />
                    <Text className="font-mono text-[10px] tracking-[0.08em] text-white">
                      [ {job.status.toUpperCase()} ]
                    </Text>
                  </View>
                </View>

                <View className="gap-1">
                  <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">CHECKLIST_PROGRESS</Text>
                  <Text className="font-mono text-[11px] tracking-[0.08em] text-white">
                    [{Math.min(completed, items.length).toString().padStart(2, "0")}/{items.length.toString().padStart(2, "0")}] {progress}%
                  </Text>
                </View>
              </GlassCard>

              <GlassCard className="gap-3">
                <Text className="font-mono text-[10px] tracking-[0.16em] text-[#8f9194]">{"// METADATA_MATRIX"}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {summaryRows.map((row) => (
                    <View key={row.label} className="basis-[48%] flex-1 gap-1 rounded-lg bg-[#2a2a2a] p-3">
                      <Text className="font-mono text-[9px] tracking-[0.16em] text-[#8f9194]">{row.label}</Text>
                      <Text
                        className="font-mono text-[11px] tracking-[0.08em] text-white"
                        numberOfLines={1}
                      >
                        {row.value}
                      </Text>
                    </View>
                  ))}
                </View>
                {job.job_url ? (
                  <Pressable
                    disabled={!isOpenableUrl(job.job_url)}
                    onPress={async () => {
                      await Haptics.selectionAsync();
                      await openExternalUrl(job.job_url ?? "", "Unable to open job posting");
                    }}
                    className={`rounded-lg border border-white/10 bg-[#2a2a2a] px-3 py-2 ${isOpenableUrl(job.job_url) ? "" : "opacity-40"}`}
                  >
                    <Text className="text-center font-mono text-[10px] tracking-[0.08em] text-white">[OPEN JOB POSTING]</Text>
                  </Pressable>
                ) : null}
              </GlassCard>

              <GlassCard className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">{"// PREPARATION_CHECKLIST"}</Text>
                  <Text className="rounded bg-[#353535] px-2 py-0.5 font-mono text-[10px] tracking-[0.08em] text-white">
                    [{completed}/{items.length} COMPLETED]
                  </Text>
                </View>
                <View className="gap-2">
                  {items.map((item) => (
                    <Checkbox
                      key={item.id}
                      checked={item.is_completed}
                      label={item.title}
                      onChange={(next) => {
                        void toggleChecklist.mutateAsync({ checklistId: item.id, isCompleted: next });
                      }}
                    />
                  ))}
                </View>

                <View className="gap-2">
                  <GlassInput
                    placeholder="Add checklist item"
                    value={newChecklist}
                    onChangeText={setNewChecklist}
                  />
                  <Pressable
                    disabled={createChecklist.isPending || !newChecklist.trim()}
                    onPress={async () => {
                      await Haptics.selectionAsync();
                      await createChecklist.mutateAsync(newChecklist.trim());
                      setNewChecklist("");
                    }}
                    className="rounded-lg bg-[#353535] px-3 py-2 disabled:opacity-60 active:scale-[0.98]"
                  >
                    <Text className="text-center font-mono text-[10px] tracking-[0.08em] text-white">
                      {createChecklist.isPending ? "[ADDING]" : "[+ ADD SUBTASK]"}
                    </Text>
                  </Pressable>
                </View>
              </GlassCard>

              <GlassCard className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">{"// SCRATCHPAD"}</Text>
                  <Text className="rounded bg-[#353535] px-2 py-0.5 font-mono text-[10px] tracking-[0.08em] text-white">
                    [MD]
                  </Text>
                </View>
                <TextInput
                  multiline
                  value={scratchpad}
                  onChangeText={setScratchpad}
                  className="min-h-[180px] rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-3 font-mono text-sm text-white"
                  textAlignVertical="top"
                  placeholderTextColor="#52525B"
                />
                <View className="h-px bg-white/10" />
                <View className="flex-row items-center justify-between">
                  <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">
                    CHARS: {scratchpad.length}
                  </Text>
                  <Pressable
                    disabled={updateJob.isPending}
                    onPress={async () => {
                      await Haptics.selectionAsync();
                      await updateJob.mutateAsync({
                        id: job.id,
                        data: {
                          interview_notes: scratchpad
                        }
                      });
                    }}
                    className="rounded-full bg-[#2a2a2a] px-3 py-1 disabled:opacity-60 active:scale-95"
                  >
                    <Text className="text-center font-mono text-[10px] tracking-[0.08em] text-white">
                      {updateJob.isPending ? "[SAVING]" : "[SAVE_BUFFER]"}
                    </Text>
                  </Pressable>
                </View>
              </GlassCard>

              <GlassCard className="gap-2">
                <Text className="font-mono text-[10px] tracking-[0.16em] text-[#8f9194]">{"// ACTION_STACK"}</Text>
                <Pressable
                  disabled={updateJob.isPending}
                  onPress={async () => {
                    await Haptics.selectionAsync();
                    await updateJob.mutateAsync({
                      id: job.id,
                      data: { status: nextStage(job.status) }
                    });
                  }}
                  className="rounded-lg bg-white px-3 py-3 disabled:opacity-60 active:scale-[0.98]"
                >
                  <Text className="text-center font-mono-bold text-[11px] tracking-[0.08em] text-black">
                    [UPDATE STAGE -&gt; {nextStage(job.status).toUpperCase()}]
                  </Text>
                </Pressable>
                <Pressable
                  disabled={updateJob.isPending}
                  onPress={async () => {
                    await Haptics.selectionAsync();
                    await updateJob.mutateAsync({
                      id: job.id,
                      data: { status: "archived" }
                    });
                  }}
                  className="rounded-lg border border-[#ffb4ab]/30 bg-[#93000a]/30 px-3 py-3 disabled:opacity-60 active:scale-[0.98]"
                >
                  <Text className="text-center font-mono-bold text-[11px] tracking-[0.08em] text-[#ffb4ab]">
                    [ARCHIVE]
                  </Text>
                </Pressable>
                <Pressable
                  disabled={deleteJob.isPending}
                  onPress={async () => {
                    await Haptics.selectionAsync();
                    Alert.alert("Delete this job?", `${job.company} · ${job.role}`, [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => {
                          void deleteJob.mutateAsync(job.id).then(() => router.back());
                        }
                      }
                    ]);
                  }}
                  className="rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-3 disabled:opacity-60"
                >
                  <Text className="text-center font-mono text-[10px] tracking-[0.08em] text-white">
                    [DELETE DOSSIER]
                  </Text>
                </Pressable>
              </GlassCard>
            </>
          ) : null}

          {!job && !isLoading && !error ? (
            <GlassCard className="gap-3">
              <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">{"// NOT_FOUND"}</Text>
              <Text className="text-xl font-sans-bold text-white">This dossier no longer exists.</Text>
              <Pressable onPress={() => router.back()} className="rounded-lg border border-white/20 bg-white px-3 py-2">
                <Text className="text-center font-mono-bold text-[10px] text-black">[RETURN]</Text>
              </Pressable>
            </GlassCard>
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}
