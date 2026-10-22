import { useMemo, useState } from "react";
import { router } from "expo-router";
import { FlatList, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassCard } from "@/components/glass/GlassCard";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ScreenState } from "@/components/ui/ScreenState";
import { AppText, Badge, Chip, Icon, ScreenHeader, styles } from "@/components/ui/primitives";
import { formatProgress, formatRelativePast, formatShortDateTime } from "@/lib/format";
import { type JobStatus, useInfiniteJobs } from "@/lib/queries";
import { theme } from "@/constants/theme";

const filters: { label: string; value: JobStatus | "all" }[] = [
  { label: "All", value: "all" }, { label: "Saved", value: "bookmarked" },
  { label: "Applied", value: "applied" }, { label: "Assessment", value: "assessment" },
  { label: "Interview", value: "interviewing" }, { label: "Offer", value: "offer" },
  { label: "Rejected", value: "rejected" }, { label: "Archived", value: "archived" }
];
export default function JobsScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<JobStatus | "all">("all");
  const { data, isLoading, isRefetching, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteJobs(filter === "all" ? undefined : filter);
  const jobs = useMemo(() => data?.pages.flatMap(page => page) ?? [], [data]);
  return <FlatList data={isLoading || error ? [] : jobs} keyExtractor={job => job.id} style={styles.screen}
    contentContainerStyle={[styles.content, { paddingBottom: 96 + insets.bottom }]} initialNumToRender={8} windowSize={5}
    refreshControl={<RefreshControl refreshing={isRefetching && !isLoading} onRefresh={() => void refetch()} tintColor={theme.colors.primary} />}
    onEndReached={() => { if (hasNextPage && !isFetchingNextPage) void fetchNextPage(); }} onEndReachedThreshold={0.5}
    ListHeaderComponent={<View style={{ gap: 16 }}>
      <ScreenHeader title="Applications" subtitle="Keep your next move in sight." />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {filters.map(item => <Chip key={item.value} label={item.label} selected={filter === item.value} onPress={() => setFilter(item.value)} />)}
      </ScrollView>
      {isLoading ? <ScreenState loading title="Loading" message="" /> : error ? <ScreenState title="Applications unavailable" message="We couldn’t load your applications." label="Retry" onPress={() => void refetch()} /> : !jobs.length ? <ScreenState title={filter === "all" ? "Your next opportunity starts here" : "No applications in this stage"} message="Save a role and track your preparation, deadlines, and interviews." label="Add application" onPress={() => router.push({ pathname: "/modal/quick-add", params: { mode: "job" } })} /> : null}
    </View>}
    renderItem={({ item: job }) => {
      const completed = job.checklists.filter(item => item.is_completed).length;
      const next = job.checklists.find(item => !item.is_completed);
      return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${job.company}, ${job.role}`} onPress={() => router.push(`/jobs/${job.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
        <GlassCard>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: theme.colors.surfaceHighest, alignItems: "center", justifyContent: "center" }}><AppText variant="heading">{job.company.charAt(0).toUpperCase()}</AppText></View>
            <AppText variant="cardTitle" style={{ flex: 1 }}>{job.company}</AppText><Icon name="chevron-right" size={18} />
          </View>
          <AppText variant="heading">{job.role}</AppText>
          <View style={styles.row}><Badge label={filters.find(item => item.value === job.status)?.label ?? job.status} />{job.location ? <AppText variant="meta" muted>{job.location}</AppText> : null}</View>
          {job.salary_range ? <AppText muted>{job.salary_range}</AppText> : null}
          <AppText variant="meta" muted={!job.deadline || new Date(job.deadline) >= new Date()} danger={!!job.deadline && new Date(job.deadline) < new Date()}>{job.deadline ? `Due ${formatShortDateTime(job.deadline)}` : `Applied ${formatRelativePast(job.applied_at)}`}</AppText>
          {job.checklists.length ? <ProgressBar value={formatProgress(completed, job.checklists.length)} label={`Preparation · ${completed}/${job.checklists.length}`} /> : null}
          {next ? <AppText variant="meta" muted numberOfLines={2}>Next: {next.title}</AppText> : null}
        </GlassCard>
      </Pressable>;
    }}
    ListFooterComponent={!error && hasNextPage ? <LoadMoreButton onPress={() => void fetchNextPage()} busy={isFetchingNextPage} /> : null}
  />;
}
