import { useEffect, useState } from "react";
import { router } from "expo-router";
import { RefreshControl, View } from "react-native";
import { GlassCard } from "@/components/glass/GlassCard";
import { Checkbox } from "@/components/ui/Checkbox";
import { ScreenState } from "@/components/ui/ScreenState";
import { AppText, Badge, Button, Screen, ScreenHeader, SectionHeading, styles } from "@/components/ui/primitives";
import { formatCountdown, formatShortDate, formatShortDateTime } from "@/lib/format";
import { useToday, useUpdateReminder } from "@/lib/queries";
import { theme } from "@/constants/theme";

export default function TodayScreen() {
  const { data, isLoading, isRefetching, error, refetch } = useToday();
  const updateReminder = useUpdateReminder();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(timer); }, []);
  const items = [...(data?.items ?? [])].sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
  const jobs = items.filter(item => item.kind === "job");
  const reminders = items.filter(item => item.kind === "reminder");
  const overdue = items.filter(item => new Date(item.due_at) < now).length;
  return <Screen refreshControl={<RefreshControl refreshing={isRefetching && !isLoading} onRefresh={() => void refetch()} tintColor={theme.colors.primary} />}>
    <ScreenHeader title="Today" subtitle={formatShortDate(now)} />
    {isLoading ? <ScreenState loading title="Loading" message="" /> : error ? <ScreenState title="Today is unavailable" message="Check your connection and try again. Your saved work is safe." label="Retry" onPress={() => void refetch()} /> : <>
      <View style={styles.row}>
        <Badge label={`${items.length} due in the next ${data?.window_hours ?? 48} hours`} />
        {overdue > 0 ? <Badge label={`${overdue} overdue`} danger /> : null}
      </View>
      {!items.length ? <ScreenState title="A little room to focus" message="Nothing is due in the next 48 hours. Capture a task or prepare for your next opportunity." label="Add a task" onPress={() => router.push({ pathname: "/modal/quick-add", params: { mode: "reminder" } })} /> : null}
      {jobs.length ? <>
        <SectionHeading title="Coming up" detail={`${jobs.length} job milestones`} />
        {jobs.map(item => <GlassCard key={item.id}>
          <View style={styles.row}><Badge label={item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : "Application"} /><Badge label={formatCountdown(item.due_at)} danger={new Date(item.due_at) < now} /></View>
          <AppText variant="cardTitle">{item.title}</AppText>
          {item.subtitle ? <AppText muted>{item.subtitle}</AppText> : null}
          <AppText variant="meta" muted>{formatShortDateTime(item.due_at)}</AppText>
          <Button label="View application" variant="secondary" icon="arrow-up-right" onPress={() => router.push(`/jobs/${item.id}`)} />
        </GlassCard>)}
      </> : null}
      {reminders.length ? <>
        <SectionHeading title="Your tasks" detail={`${reminders.length} remaining`} />
        {reminders.map(item => <View key={item.id} style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingBottom: 12 }}>
          <Checkbox checked={false} label={item.title} disabled={updateReminder.isPending} onChange={() => updateReminder.mutate({ id: item.id, data: { is_completed: true } })} />
          <View style={{ ...styles.row, marginLeft: 34 }}><AppText variant="meta" danger={new Date(item.due_at) < now} muted={new Date(item.due_at) >= now}>{formatShortDateTime(item.due_at)}</AppText>{item.priority === "high" ? <Badge label="High priority" /> : null}</View>
          <Button label="Edit task" variant="ghost" onPress={() => router.push(`/reminders/${item.id}`)} style={{ alignSelf: "flex-start", marginLeft: 18 }} />
        </View>)}
      </> : null}
      {data?.truncated ? <AppText muted>More items are available in Jobs and Tasks.</AppText> : null}
      <View style={styles.row}><Button label="All applications" variant="ghost" onPress={() => router.push("/(tabs)/jobs")} /><Button label="All tasks" variant="ghost" onPress={() => router.push("/(tabs)/reminders")} /></View>
    </>}
  </Screen>;
}
