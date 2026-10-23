import { useContext, useMemo, useState } from "react";
import { Alert, Linking, Platform, RefreshControl, View } from "react-native";
import * as Calendar from "expo-calendar";
import { useQuery } from "@tanstack/react-query";
import { AccountContext } from "@/lib/session";
import { api } from "@/lib/api";
import { GlassCard } from "@/components/glass/GlassCard";
import { DateTimeField } from "@/components/ui/DateTimeField";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import { ScreenState } from "@/components/ui/ScreenState";
import { AppText, Badge, Button, Chip, Screen, ScreenHeader, styles } from "@/components/ui/primitives";
import { formatFullDateTime, localTimeZone } from "@/lib/format";
import { type Event, useInfiniteEvents } from "@/lib/queries";
import { syncLocalNotifications } from "@/lib/notifications";
import { theme } from "@/constants/theme";
import { FilterBar } from "@/components/ui/FilterBar";
import { QueryFeedback } from "@/components/ui/QueryFeedback";

const filters = [{ label: "All events", value: undefined }, { label: "Online", value: true }, { label: "In person", value: false }] as const;
export default function EventsScreen() {
  const userId = useContext(AccountContext);
  const saved = useQuery({ queryKey: [userId, "saved-events"], enabled: !!userId, queryFn: async ({ signal }) => (await api.get<{ event_id: string; registration_deadline: string | null }[]>("/notifications/saved-events", { signal })).data });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<boolean | undefined>(undefined);
  const { data, isLoading, isRefetching, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteEvents(filter);
  const events = useMemo(() => data?.pages.flatMap(page => page.items) ?? [], [data]);
  const saveEvent = async (id: string, remove = false, deadline?: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      if (remove) await api.delete(`/notifications/saved-events/${id}`);
      else await api.put(`/notifications/saved-events/${id}`, deadline === undefined ? {} : { registration_deadline: deadline || null });
      await saved.refetch();
      setDrafts(current => { const next = { ...current }; delete next[id]; return next; });
      if (userId) await syncLocalNotifications(userId);
      if (deadline !== undefined) Alert.alert("Deadline saved", deadline ? "Your registration deadline has been updated." : "Registration deadline removed.");
    } catch (e) { Alert.alert("Couldn’t update event", e instanceof Error ? e.message : "Please try again."); }
    finally { setBusyId(null); }
  };
  const openEvent = async (event: Event) => {
    try {
      if (!/^https?:\/\//i.test(event.url.trim())) throw new Error("This event doesn’t have a valid source link.");
      await Linking.openURL(event.url.trim());
    } catch (e) { Alert.alert("Couldn’t open event", e instanceof Error ? e.message : "Please try again."); }
  };
  const syncCalendar = async (event: Event) => {
    try {
      if (Platform.OS === "web") throw new Error("Open SEE on your phone to add an event to your calendar.");
      const permission = await Calendar.requestCalendarPermissions();
      if (!permission.granted) throw new Error("Allow calendar access in your device settings to add events.");
      const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
      const calendar = calendars.find(item => item.allowsModifications);
      if (!calendar) throw new Error("Add a writable calendar account on this device first.");
      const start = new Date(event.start_date);
      const end = event.end_date ? new Date(event.end_date) : new Date(start.getTime() + 3_600_000);
      if (Number.isNaN(start.getTime()) || end <= start) throw new Error("This event’s schedule is incomplete. Check the source for details.");
      await calendar.createEvent({ title: event.title, startDate: start, endDate: end, timeZone: localTimeZone(), location: event.location ?? undefined, notes: `Source: ${event.url}`, allDay: false, availability: Calendar.Availability.BUSY });
      Alert.alert("Added to calendar", event.title);
    } catch (e) { Alert.alert("Couldn’t add to calendar", e instanceof Error ? e.message : "Please try again."); }
  };
  return <Screen refreshControl={<RefreshControl refreshing={isRefetching && !isLoading} onRefresh={() => { void refetch(); void saved.refetch(); }} tintColor={theme.colors.primary} />}>
    <ScreenHeader title="Events" subtitle="Hackathons, meetups, and new connections." addMode="reminder" />
    <FilterBar label="Event format">{filters.map(item => <Chip key={item.label} label={item.label} selected={filter === item.value} onPress={() => setFilter(item.value)} />)}</FilterBar>
    <QueryFeedback hasData={!!data} refreshing={isRefetching} error={error} onRetry={() => void refetch()} />
    {saved.error ? <ScreenState title="Saved events unavailable" message="Event discovery is available. Retry to manage saved reminders." label="Retry saved events" onPress={() => void saved.refetch()} /> : null}
    {error && !data ? <ScreenState title="Events unavailable" message="We couldn’t load the event feed." label="Retry" onPress={() => void refetch()} /> : isLoading ? <ScreenState loading title="Loading" message="" /> : !events.length ? <ScreenState title="No events found" message="Try a different filter or check back for new opportunities." /> : events.map(event => {
      const entry = saved.data?.find(item => item.event_id === event.id);
      const isExpanded = expanded === event.id;
      const deadline = drafts[event.id] ?? entry?.registration_deadline ?? "";
      return <GlassCard key={event.id}>
        <View style={styles.row}><Badge label={event.source} /><AppText variant="meta" muted>{event.is_virtual ? "Online" : event.location ?? "In person"}</AppText>{entry ? <Badge label="Saved" /> : null}</View>
        <AppText variant="heading">{event.title}</AppText>
        <View style={{ gap: 4 }}>
          <AppText variant="label">Starts {formatFullDateTime(event.start_date)}</AppText>
          {event.end_date ? <AppText variant="meta" muted>Ends {formatFullDateTime(event.end_date)}</AppText> : null}
          {event.prize_pool ? <AppText variant="meta" muted>Prizes: {event.prize_pool}</AppText> : null}
        </View>
        {event.description ? <><AppText muted numberOfLines={isExpanded ? undefined : 3}>{event.description}</AppText><Button variant="ghost" label={isExpanded ? "Show less" : "Read more"} onPress={() => setExpanded(isExpanded ? null : event.id)} style={{ alignSelf: "flex-start", paddingHorizontal: 0 }} /></> : null}
        {isExpanded && event.categories?.length ? <View style={styles.row}>{event.categories.map(category => <Badge key={category} label={category} />)}</View> : null}
        <View style={styles.row}>
          <Button label="View event" icon="external-link" variant="secondary" onPress={() => void openEvent(event)} />
          <Button label="Add to calendar" icon="calendar" variant="secondary" onPress={() => void syncCalendar(event)} />
          <Button label={entry ? "Unsave" : "Save event"} icon="bookmark" variant="ghost" busy={busyId === event.id} disabled={saved.isPending || !!saved.error || !!busyId} onPress={() => void saveEvent(event.id, !!entry)} />
        </View>
        {entry ? <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 16 }}>
          <DateTimeField label="Registration deadline" value={deadline} onChange={value => setDrafts(current => ({ ...current, [event.id]: value }))} disabled={!!busyId} />
          <AppText variant="meta" muted>Local time · {localTimeZone()}</AppText>
          <Button label="Save deadline" variant="secondary" busy={busyId === event.id} disabled={drafts[event.id] === undefined || !!busyId} onPress={() => void saveEvent(event.id, false, deadline)} />
        </View> : null}
      </GlassCard>;
    })}
    {!error && hasNextPage ? <LoadMoreButton busy={isFetchingNextPage} onPress={() => void fetchNextPage()} /> : null}
  </Screen>;
}
