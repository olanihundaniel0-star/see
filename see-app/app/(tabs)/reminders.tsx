import { useMemo, useState } from "react";
import { router } from "expo-router";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { GlassCard } from "@/components/glass/GlassCard";
import { Checkbox } from "@/components/ui/Checkbox";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import { ScreenState } from "@/components/ui/ScreenState";
import { AppText, Badge, Chip, Icon, Screen, ScreenHeader, styles } from "@/components/ui/primitives";
import { formatCountdown, formatShortDateTime } from "@/lib/format";
import { useInfiniteReminders, useUpdateReminder } from "@/lib/queries";
import { theme } from "@/constants/theme";
type Filter = "open" | "overdue" | "completed" | "all";
export default function RemindersScreen() {
  const [filter, setFilter] = useState<Filter>("open");
  const { data, isLoading, isRefetching, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteReminders();
  const update = useUpdateReminder();
  const reminders = useMemo(() => data?.pages.flatMap(page => page) ?? [], [data]);
  const visible = reminders.filter(item => filter === "all" || (filter === "completed" ? item.is_completed : !item.is_completed && (filter !== "overdue" || new Date(item.due_date) < new Date()))).sort((a, b) => Number(a.is_completed) - Number(b.is_completed) || new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  return <Screen refreshControl={<RefreshControl refreshing={isRefetching && !isLoading} onRefresh={() => void refetch()} tintColor={theme.colors.primary} />}>
    <ScreenHeader title="Tasks" subtitle="Your reminders, in order." />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {(["open", "overdue", "completed", "all"] as const).map(value => <Chip key={value} label={value.charAt(0).toUpperCase() + value.slice(1)} selected={filter === value} onPress={() => setFilter(value)} />)}
    </ScrollView>
    {isLoading ? <ScreenState loading title="Loading" message="" /> : error ? <ScreenState title="Tasks unavailable" message="We couldn’t load your reminders." label="Retry" onPress={() => void refetch()} /> : !visible.length ? <ScreenState title={filter === "overdue" ? hasNextPage ? "No overdue tasks on this page" : "You’re all caught up" : "No tasks here"} message={hasNextPage ? "Load more to check the rest of your reminders." : "Add a reminder for something you want to get done."} label="Add reminder" onPress={() => router.push({ pathname: "/modal/quick-add", params: { mode: "reminder" } })} /> : visible.map(item => <GlassCard key={item.id}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}><Checkbox checked={item.is_completed} label={item.title} disabled={update.isPending} onChange={is_completed => update.mutate({ id: item.id, data: { is_completed } })} /></View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${item.title}`} onPress={() => router.push(`/reminders/${item.id}`)} style={{ minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" }}><Icon name="chevron-right" /></Pressable>
      </View>
      <AppText variant="meta" muted>{formatShortDateTime(item.due_date)}</AppText>
      <View style={styles.row}><Badge label={item.is_completed ? "Completed" : formatCountdown(item.due_date)} danger={!item.is_completed && new Date(item.due_date) < new Date()} /><AppText variant="meta" muted>{item.priority.charAt(0).toUpperCase() + item.priority.slice(1)} priority</AppText></View>
    </GlassCard>)}
    {!error && hasNextPage ? <LoadMoreButton onPress={() => void fetchNextPage()} busy={isFetchingNextPage} /> : null}
  </Screen>;
}
