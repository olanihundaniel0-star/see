import { useMemo, useState } from "react";
import { Link } from "expo-router";
import * as Haptics from "expo-haptics";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { GlassCard } from "@/components/glass/GlassCard";
import { AsciiBanner } from "@/components/ui/AsciiBanner";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ScreenState } from "@/components/ui/ScreenState";
import { theme } from "@/constants/theme";
import { formatProgress, formatRelativePast, formatShortDateTime } from "@/lib/format";
import { Job, JobStatus, useInfiniteJobs, useUpdateJob } from "@/lib/queries";

const filters: { label: string; value: JobStatus | "all"; glyph: string }[] = [
  { label: "ALL", value: "all", glyph: "●" },
  { label: "BOOKMARKED", value: "bookmarked", glyph: "●" },
  { label: "APPLIED", value: "applied", glyph: "●" },
  { label: "ASSESSMENT", value: "assessment", glyph: "●" },
  { label: "INTERVIEWING", value: "interviewing", glyph: "●" },
  { label: "OFFER", value: "offer", glyph: "★" },
  { label: "ARCHIVED", value: "archived", glyph: "●" }
];

const statusOrder: JobStatus[] = ["bookmarked", "applied", "assessment", "interviewing", "offer", "rejected", "archived"];

function nextStage(status: JobStatus): JobStatus {
  if (status === "rejected" || status === "archived") {
    return status;
  }
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
  const [activeFilter, setActiveFilter] = useState<JobStatus | "all">("all");
  const { data, isLoading, isRefetching, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteJobs(
    activeFilter === "all" ? undefined : activeFilter
  );
  const updateJob = useUpdateJob();
  const jobs = useMemo(() => data?.pages.flatMap((page) => page) ?? [], [data]);

  // Client-side filter kept as fallback only (e.g. if the backend ignores `status`).
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
      }, { bookmarked: 0, applied: 0, assessment: 0, interviewing: 0, offer: 0, rejected: 0, archived: 0 }),
    [jobs]
  );

  const hotCount = counts.interviewing + counts.offer;

  return (
    <FlatList
      data={error || isLoading ? [] : filteredJobs}
      keyExtractor={(job) => job.id}
      className="flex-1 bg-black"
      contentContainerClassName="px-4 pb-28 pt-4 gap-3"
      removeClippedSubviews
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={5}
      updateCellsBatchingPeriod={50}
      refreshControl={<RefreshControl refreshing={isRefetching && !isLoading} onRefresh={() => void refetch()} tintColor="#fff" />}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={
        <View className="gap-3">
          <AsciiBanner title={theme.ascii.pipeline} subtitle="Status filters and dossier cards" right={isLoading ? "[SYNC]" : "[PIPELINE]"} />

          <View className="flex-row items-center justify-between py-1">
            <View className="flex-row items-center gap-2">
              <Text className="font-mono text-[10px] tracking-[0.16em] text-[#c5c6ca]">{"// PIPELINE_STATUS"}</Text>
              <Text className="rounded bg-[#2a2a2a]/90 px-2 py-0.5 font-mono text-[10px] tracking-[0.08em] text-white">
                [ACTIVE_SYNC]
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="font-mono text-[10px] tracking-[0.08em] text-[#c5c6ca]">{jobs.length} NODES</Text>
              <Text className="font-mono text-[10px] text-[#8f9194]">|</Text>
              <Text className="font-mono text-[10px] tracking-[0.08em] text-white">{hotCount} HOT</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {filters.map((filter) => {
              const active = filter.value === activeFilter;
              const count = filter.value === "all" ? jobs.length : counts[filter.value];
              return (
                <Pressable
                  key={filter.value}
                  onPress={async () => {
                    await Haptics.selectionAsync();
                    setActiveFilter(filter.value);
                  }}
                  className={`shrink-0 flex-row items-center gap-1.5 rounded-full px-4 py-2 active:scale-95 ${
                    active ? "bg-white" : "bg-[#2a2a2a]/80"
                  }`}
                >
                  <Text className={`font-mono text-[10px] ${active ? "text-black" : "text-[#c5c6ca]"}`}>
                    {filter.glyph}
                  </Text>
                  <Text
                    className={`font-mono text-[10px] tracking-[0.08em] ${active ? "text-black" : "text-white"}`}
                  >
                    {filter.label} ({count})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

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

          {!error && !isLoading && !filteredJobs.length ? (
            <ScreenState
              title="// NO_MATCHES"
              message="No jobs are visible for this filter."
            />
          ) : null}
        </View>
      }
      renderItem={({ item: job }) => {
        const stats = completionCount(job);
        const stageLabel = job.status.toUpperCase();
        const initial = (job.company.trim().charAt(0) || "?").toUpperCase();
        const timestampValue = job.deadline
          ? `DUE ${formatShortDateTime(job.deadline).toUpperCase()}`
          : `APPLIED ${formatRelativePast(job.applied_at).toUpperCase()}`;
        const nextTask =
          job.checklists.find((item) => !item.is_completed)?.title ??
          (stats.total > 0 ? "ALL CLEAR" : "NO TASKS");

        return (
          <GlassCard className="relative gap-3 overflow-hidden p-3">
            <View className="absolute inset-x-0 top-0 h-px bg-white/20" pointerEvents="none" />

            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1 flex-row items-center gap-2">
                <View className="h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#353535]">
                  <Text className="font-sans-bold text-[15px] text-white">{initial}</Text>
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="font-sans-bold text-[17px] tracking-tight text-white" numberOfLines={1}>
                    {job.company}
                  </Text>
                  <Text className="font-mono text-[10px] tracking-[0.08em] text-[#c5c6ca]" numberOfLines={1}>
                    {(job.location ?? "REMOTE").toUpperCase()}{" // "}{job.role.toUpperCase()}
                  </Text>
                </View>
              </View>
              <View className="shrink-0 flex-row items-center gap-1.5 rounded-full bg-[#353535]/90 px-3 py-1">
                <View className="h-1.5 w-1.5 rounded-full bg-white opacity-90" />
                <Text className="font-mono text-[10px] tracking-[0.08em] text-white">[ {stageLabel} ]</Text>
              </View>
            </View>

            <View className="flex-row gap-2">
              <View className="flex-1 gap-0.5 rounded-lg bg-black/60 p-2">
                <Text className="font-mono text-[9px] tracking-[0.08em] text-[#8f9194]">{"// COMP_BAND"}</Text>
                <Text className="font-mono text-[11px] tracking-[0.04em] text-white" numberOfLines={1}>
                  {(job.salary_range ?? "N/A").toUpperCase()}
                </Text>
              </View>
              <View className="flex-1 gap-0.5 rounded-lg bg-black/60 p-2">
                <Text className="font-mono text-[9px] tracking-[0.08em] text-[#8f9194]">{"// TIMESTAMP"}</Text>
                <Text className="font-mono text-[11px] tracking-[0.04em] text-white" numberOfLines={1}>
                  {timestampValue}
                </Text>
              </View>
            </View>

            <ProgressBar value={stats.progress} segments={4} label="PREPARATION" />

            <View className="flex-row items-center justify-between gap-2">
              <Text className="min-w-0 flex-1 font-mono text-[11px] text-[#e2e2e2]" numberOfLines={1}>
                Next: <Text className="text-white">{nextTask}</Text>
              </Text>
              <Link href={`/jobs/${job.id}`} asChild>
                <Pressable className="shrink-0 active:scale-95">
                  <Text className="font-mono text-[10px] tracking-[0.08em] text-white underline underline-offset-4">
                    [PREP_DOCS]
                  </Text>
                </Pressable>
              </Link>
            </View>

            <View className="flex-row gap-2">
              <Link href={`/jobs/${job.id}`} asChild>
                <Pressable className="flex-1 rounded bg-white px-3 py-2 active:scale-[0.99]">
                  <Text className="text-center font-mono-bold text-[10px] text-black">[OPEN DOSSIER]</Text>
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
                className="flex-1 rounded bg-white px-3 py-2 disabled:opacity-60"
              >
                <Text className="text-center font-mono-bold text-[10px] text-black">
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
                    status: "archived"
                  }
                });
              }}
              className="rounded border border-[#ffb4ab]/30 bg-[#93000a]/30 px-3 py-2 disabled:opacity-60"
            >
              <Text className="text-center font-mono-bold text-[10px] text-[#ffb4ab]">[ARCHIVE]</Text>
            </Pressable>
          </GlassCard>
        );
      }}
      ItemSeparatorComponent={() => <View className="h-3" />}
      ListFooterComponent={
        !error && hasNextPage ? (
          <LoadMoreButton onPress={() => void fetchNextPage()} busy={isFetchingNextPage} />
        ) : null
      }
    />
  );
}
