import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import { GlassCard } from "@/components/glass/GlassCard";
import { GlassInput } from "@/components/glass/GlassInput";
import { GlassPill } from "@/components/glass/GlassPill";
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

const stageNodes: JobStatus[] = ["bookmarked", "applied", "interviewing", "offer", "rejected"];

function nextStage(status: JobStatus): JobStatus {
  const index = stageNodes.indexOf(status);
  return stageNodes[Math.min(index + 1, stageNodes.length - 1)];
}

function stageIndex(status: JobStatus) {
  return stageNodes.indexOf(status);
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
  const activeStage = job ? stageIndex(job.status) : 0;
  const deadline = job?.deadline ? formatShortDateTime(job.deadline) : "NO DEADLINE";

  const summaryRows = useMemo(
    () => [
      { label: "LOCATION", value: job?.location ?? "REMOTE" },
      { label: "SALARY", value: job?.salary_range ?? "N/A" },
      { label: "APPLIED", value: job?.applied_at ? formatShortDateTime(job.applied_at) : "N/A" },
      { label: "UPDATED", value: job?.updated_at ? formatShortDateTime(job.updated_at) : "N/A" },
      { label: "JOB_URL", value: job?.job_url ?? "N/A" }
    ],
    [job]
  );

  return (
    <>
      <Stack.Screen options={{ title: "Application Dossier" }} />
      <ScrollView className="flex-1 bg-black" contentContainerClassName="px-4 pb-28 pt-4">
        <View className="gap-4">
          <AsciiBanner title={theme.ascii.dossier} subtitle={job ? `Application ${job.company}` : "Application dossier"} right="[DOSSIER]" />

          {error ? (
            <GlassCard className="gap-3">
              <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">// DOSSIER_ERROR</Text>
              <Text className="text-xl font-bold text-white">Unable to load this job.</Text>
              <Text className="font-mono text-[11px] text-zinc-400">The backend did not return a dossier for this id.</Text>
            </GlassCard>
          ) : null}

          {job ? (
            <>
              <GlassCard className="gap-3">
                <View className="flex-row items-start justify-between">
                  <View className="gap-1">
                    <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">{job.company.toUpperCase()}</Text>
                    <Text className="text-2xl font-bold text-white">{job.role}</Text>
                  </View>
                  <GlassPill label="STAGE" value={job.status.toUpperCase()} tone={job.status === "offer" ? "active" : "default"} />
                </View>

                <View className="flex-row gap-2">
                  {stageNodes.map((stage, index) => {
                    const active = index <= activeStage;
                    return (
                      <View
                        key={stage}
                        className={`flex-1 rounded-lg border px-2 py-2 ${
                          active ? "border-white/20 bg-zinc-900/70" : "border-white/10 bg-zinc-950/50"
                        }`}
                      >
                        <Text className="text-center font-mono text-[9px] tracking-[0.18em] text-white">{stage.toUpperCase()}</Text>
                      </View>
                    );
                  })}
                </View>

                <View className="gap-1">
                  <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">CHECKLIST_PROGRESS</Text>
                  <Text className="font-mono text-[11px] tracking-[0.18em] text-white">
                    [{Math.min(completed, items.length).toString().padStart(2, "0")}/{items.length.toString().padStart(2, "0")}] {progress}%
                  </Text>
                </View>
              </GlassCard>

              <GlassCard className="gap-3">
                <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">// METADATA_MATRIX</Text>
                <View className="flex-row flex-wrap gap-2">
                  {summaryRows.map((row) => (
                    <GlassPill key={row.label} label={row.label} value={row.value} className="basis-[48%] flex-1" />
                  ))}
                  <GlassPill label="DEADLINE" value={deadline} className="basis-[48%] flex-1" />
                </View>
                {job.job_url ? (
                  <Pressable
                    onPress={async () => {
                      await Haptics.selectionAsync();
                      await Linking.openURL(job.job_url ?? "");
                    }}
                    className="rounded-lg border border-white/20 bg-white px-3 py-2"
                  >
                    <Text className="text-center font-mono text-[10px] font-bold text-black">[OPEN JOB POSTING]</Text>
                  </Pressable>
                ) : null}
              </GlassCard>

              <GlassCard className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">// CHECKLIST</Text>
                  <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-400">
                    [{completed}/{items.length}]
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
                    className="rounded-lg border border-white/20 bg-white px-3 py-2 disabled:opacity-60"
                  >
                    <Text className="text-center font-mono text-[10px] font-bold text-black">
                      {createChecklist.isPending ? "[ADDING]" : "[+ ADD TASK]"}
                    </Text>
                  </Pressable>
                </View>
              </GlassCard>

              <GlassCard className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">// SCRATCHPAD</Text>
                  <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-400">INTERVIEW_NOTES</Text>
                </View>
                <TextInput
                  multiline
                  value={scratchpad}
                  onChangeText={setScratchpad}
                  className="min-h-[180px] rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-3 font-mono text-sm text-white"
                  textAlignVertical="top"
                  placeholderTextColor="#52525B"
                />
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
                  className="rounded-lg border border-white/20 bg-white px-3 py-2 disabled:opacity-60"
                >
                  <Text className="text-center font-mono text-[10px] font-bold text-black">
                    {updateJob.isPending ? "[SAVING]" : "[SAVE NOTES]"}
                  </Text>
                </Pressable>
              </GlassCard>

              <GlassCard className="gap-2">
                <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">// ACTION_STACK</Text>
                <View className="flex-row gap-2">
                  <Pressable
                    disabled={updateJob.isPending}
                    onPress={async () => {
                      await Haptics.selectionAsync();
                      await updateJob.mutateAsync({
                        id: job.id,
                        data: { status: nextStage(job.status) }
                      });
                    }}
                    className="flex-1 rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-3 disabled:opacity-60"
                  >
                    <Text className="text-center font-mono text-[10px] text-white">[MOVE FORWARD]</Text>
                  </Pressable>
                  <Pressable
                    disabled={updateJob.isPending}
                    onPress={async () => {
                      await Haptics.selectionAsync();
                      await updateJob.mutateAsync({
                        id: job.id,
                        data: { status: "rejected" }
                      });
                    }}
                    className="flex-1 rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-3 disabled:opacity-60"
                  >
                    <Text className="text-center font-mono text-[10px] text-white">[MARK ARCHIVED]</Text>
                  </Pressable>
                </View>
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
                  className="rounded-lg border border-white/20 bg-white px-3 py-3 disabled:opacity-60"
                >
                  <Text className="text-center font-mono text-[10px] font-bold text-black">[DELETE DOSSIER]</Text>
                </Pressable>
              </GlassCard>
            </>
          ) : null}

          {!job && !isLoading && !error ? (
            <GlassCard className="gap-3">
              <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">// NOT_FOUND</Text>
              <Text className="text-xl font-bold text-white">This dossier no longer exists.</Text>
              <Pressable onPress={() => router.back()} className="rounded-lg border border-white/20 bg-white px-3 py-2">
                <Text className="text-center font-mono text-[10px] font-bold text-black">[RETURN]</Text>
              </Pressable>
            </GlassCard>
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}
