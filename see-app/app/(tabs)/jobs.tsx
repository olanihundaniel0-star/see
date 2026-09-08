import { useMemo, useState } from "react";
import { Link } from "expo-router";
import * as Haptics from "expo-haptics";
import { Pressable, ScrollView, Text, View } from "react-native";

import { GlassCard } from "@/components/glass/GlassCard";
import { GlassPill } from "@/components/glass/GlassPill";
import { AsciiBanner } from "@/components/ui/AsciiBanner";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ScreenState } from "@/components/ui/ScreenState";
import { theme } from "@/constants/theme";
import { formatProgress, formatRelativePast, formatShortDateTime } from "@/lib/format";
import { Job, JobStatus, useInfiniteJobs, useUpdateJob } from "@/lib/queries";

const filters: Array<{ label: string; value: JobStatus | "all" }> = [
  { label: "ALL", value: "all" },
  { label: "BOOKMARKED", value: "bookmarked" },
  { label: "APPLIED", value: "applied" },
  { label: "INTERVIEWING", value: "interviewing" },
  { label: "OFFER", value: "offer" }
];

const statusOrder: JobStatus[] = ["bookmarked", "applied", "interviewing", "offer", "rejected"];

function nextStage(status: JobStatus): JobStatus {
  const index = statusOrder.indexOf(status);
  return statusOrder[Math.min(index + 1, statusOrder.length - 1)];
}

function completionCount(job: Job) {
  const completed = job.checklists.filter((item) => item.is_completed).length;
  return {
    completed,
    total: job.checklists.length,
    progress: formatProgress(completed, job.checklists.length)
  };
}

export default function JobsScreen() {
  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteJobs();
  const updateJob = useUpdateJob();
  const [activeFilter, setActiveFilter] = useState<JobStatus | "all">("all");
  const jobs = useMemo(() => data?.pages.flatMap((page) => page) ?? [], [data]);

  const filteredJobs = useMemo(() => {
    if (activeFilter === "all") {
      return jobs;
    }
    return jobs.filter((job) => job.status === activeFilter);
  }, [activeFilter, jobs]);

  const counts = useMemo(
    () =>
      statusOrder.reduce<Record<JobStatus, number>>((acc, status) => {
        acc[status] = jobs.filter((job) => job.status === status).length;
        return acc;
      }, { bookmarked: 0, applied: 0, interviewing: 0, offer: 0, rejected: 0 }),
    [jobs]
  );

  const summaryCompleted = jobs.reduce((acc, job) => acc + completionCount(job).completed, 0);
  const summaryTotal = jobs.reduce((acc, job) => acc + completionCount(job).total, 0);

  return (
    <ScrollView className="flex-1 bg-black" contentContainerClassName="px-4 pb-28 pt-4">
      <View className="gap-4">
        <AsciiBanner title={theme.ascii.pipeline} subtitle="Status filters and dossier cards" right={isLoading ? "[SYNC]" : "[PIPELINE]"} />

        <View className="flex-row gap-2">
          <GlassPill label="TOTAL" value={jobs.length} className="flex-1" />
          <GlassPill label="CHECKPOINTS" value={`${summaryCompleted}/${summaryTotal}`} tone="active" className="flex-1" />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {filters.map((filter) => {
            const active = filter.value === activeFilter;
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
                  {filter.label}
                  {filter.value !== "all" ? ` ${counts[filter.value]}` : ""}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="gap-3">
          {error ? (
            <ScreenState
              title="// PIPELINE_ERROR"
              message="Unable to load your applications."
              label="[ RETRY ]"
              onPress={() => void refetch()}
            />
          ) : null}

          {!error && isLoading ? (
            <ScreenState title="// PIPELINE_BOOT" message="Loading your application dossiers." />
          ) : null}

          {!error && !isLoading
            ? filteredJobs.map((job) => {
                const stats = completionCount(job);
                const stageLabel = job.status.toUpperCase();
                const deadline = job.deadline ? formatShortDateTime(job.deadline) : "NO DEADLINE";

                return (
                  <GlassCard key={job.id} className="gap-3">
                    <View className="flex-row items-start justify-between gap-4">
                      <View className="flex-1 gap-1">
                        <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">{job.company.toUpperCase()}</Text>
                        <Text className="text-xl font-bold text-white">{job.role}</Text>
                        <Text className="font-mono text-[11px] text-zinc-400">
                          {job.location ?? "REMOTE"} · {job.salary_range ?? "SALARY N/A"}
                        </Text>
                      </View>
                      <GlassPill label="STAGE" value={stageLabel} tone={job.status === "offer" ? "active" : "default"} />
                    </View>

                    <ProgressBar value={stats.progress} label="CHECKLIST" />

                    <View className="flex-row items-center justify-between">
                      <Text className="font-mono text-[10px] text-zinc-500">{job.deadline ? `DUE ${deadline}` : formatRelativePast(job.applied_at)}</Text>
                      <Text className="font-mono text-[10px] text-zinc-300">
                        [{stats.completed}/{stats.total}] {stats.progress}%
                      </Text>
                    </View>

                    <View className="flex-row gap-2">
                      <Link href={`/jobs/${job.id}`} asChild>
                        <Pressable className="flex-1 rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-2 active:scale-[0.99]">
                          <Text className="text-center font-mono text-[10px] text-white">[OPEN DOSSIER]</Text>
                        </Pressable>
                      </Link>
                      <Pressable
                        disabled={updateJob.isPending}
                        onPress={async () => {
                          await Haptics.selectionAsync();
                          await updateJob.mutateAsync({
                            id: job.id,
                            data: {
                              status: nextStage(job.status)
                            }
                          });
                        }}
                        className="flex-1 rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-2 disabled:opacity-60"
                      >
                        <Text className="text-center font-mono text-[10px] text-white">
                          {updateJob.isPending ? "[UPDATING]" : `[ADVANCE -> ${nextStage(job.status).toUpperCase()}]`}
                        </Text>
                      </Pressable>
                    </View>

                    <Pressable
                      disabled={updateJob.isPending}
                      onPress={async () => {
                        await Haptics.selectionAsync();
                        await updateJob.mutateAsync({
                          id: job.id,
                          data: {
                            status: "rejected"
                          }
                        });
                      }}
                      className="rounded-lg border border-white/20 bg-white px-3 py-2 disabled:opacity-60"
                    >
                      <Text className="text-center font-mono text-[10px] font-bold text-black">[ARCHIVE]</Text>
                    </Pressable>
                  </GlassCard>
                );
              })
            : null}
        </View>

        {!error && !isLoading && !filteredJobs.length ? (
          <ScreenState
            title="// NO_MATCHES"
            message="No jobs are visible for this filter."
          />
        ) : null}

        {!error && hasNextPage ? (
          <LoadMoreButton onPress={() => void fetchNextPage()} busy={isFetchingNextPage} />
        ) : null}
      </View>
    </ScrollView>
  );
}
