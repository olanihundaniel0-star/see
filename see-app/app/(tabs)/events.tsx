import { useContext, useMemo, useState } from "react";
import { Alert, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import * as Calendar from "expo-calendar";
import * as Haptics from "expo-haptics";

import { useQuery } from "@tanstack/react-query";
import { AccountContext } from "@/lib/session";
import { api } from "@/lib/api";
import { GlassCard } from "@/components/glass/GlassCard";
import { GlassInput } from "@/components/glass/GlassInput";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import { ScreenState } from "@/components/ui/ScreenState";
import { DATETIME_INPUT_PLACEHOLDER, parseDateTimeInput, toDateTimeInput } from "@/lib/datetime";
import { formatCountdown, formatRelativePast, formatShortDate } from "@/lib/format";
import { useInfiniteEvents } from "@/lib/queries";
import { syncLocalNotifications } from "@/lib/notifications";

const filters = [
  { label: "ALL", value: undefined },
  { label: "VIRTUAL", value: true },
  { label: "IN-PERSON", value: false }
] as const;

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

export default function EventsScreen() {
  const userId = useContext(AccountContext);
  const saved = useQuery({ queryKey: [userId, "saved-events"], queryFn: async ({ signal }) => (await api.get<{ event_id: string; registration_deadline: string | null }[]>("/notifications/saved-events", { signal })).data });
  const [deadlineDrafts, setDeadlineDrafts] = useState<Record<string, string>>({});
  const toggleSaved = async (id: string) => {
    try {
      if (saved.data?.some(e => e.event_id === id)) await api.delete(`/notifications/saved-events/${id}`);
      else await api.put(`/notifications/saved-events/${id}`, {});
      await saved.refetch();
      if (userId) await syncLocalNotifications(userId);
    } catch (error) { Alert.alert("Event reminder failed", error instanceof Error ? error.message : "Try again."); }
  };
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]["value"]>(undefined);
  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteEvents(activeFilter);
  const events = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  const counts = useMemo(
    () => ({
      all: events.length,
      virtual: events.filter((event) => event.is_virtual).length,
      inPerson: events.filter((event) => !event.is_virtual).length
    }),
    [events]
  );

  const syncCalendar = async (title: string, startDate: string, endDate?: string | null, url?: string, location?: string | null) => {
    try {
    if (Platform.OS === "web") throw new Error("Calendar sync requires the mobile app.");
    const perm = await Calendar.requestCalendarPermissions();
    if (!perm.granted) {
      Alert.alert("Calendar permission required", "Grant access to sync events.");
      return;
    }

      const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
      const calendar = calendars.find(c => c.allowsModifications);
      if (!calendar) throw new Error("Add a writable calendar account on this device first.");
      const start = new Date(startDate);
      const end = endDate ? new Date(endDate) : new Date(start.getTime() + 60 * 60 * 1000);
      const eventId = await calendar.createEvent({
        title,
        startDate: start,
        endDate: end,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        location: location ?? undefined,
        notes: url ? `Source: ${url}` : undefined,
        allDay: false,
        availability: Calendar.Availability.BUSY
      });
      Alert.alert("Calendar synced", `Saved ${title} to your calendar. Event id: ${eventId.id}`);
    } catch (error) {
      Alert.alert("Calendar sync failed", error instanceof Error ? error.message : "Unable to create a calendar event.");
    }
  };

  return (
    <ScrollView className="flex-1 bg-black" contentContainerClassName="px-4 pb-28 pt-4">
      <View className="gap-3">
        <View className="flex-row items-center justify-between px-1">
          <View className="flex-row items-center gap-2">
            <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">{"// RADAR_FEED"}</Text>
            <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-white">[● LIVE]</Text>
          </View>
          <View className="flex-row items-center gap-1 rounded border border-white/[0.08] bg-[#2a2a2a] px-2 py-1">
            <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">TARGETS:</Text>
            <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-white">{events.length}_DETECTED</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {filters.map((filter) => {
            const active = filter.value === activeFilter;
            const count = filter.label === "ALL" ? counts.all : filter.label === "VIRTUAL" ? counts.virtual : counts.inPerson;
            return (
              <Pressable
                key={filter.label}
                onPress={async () => {
                  await Haptics.selectionAsync();
                  setActiveFilter(filter.value);
                }}
                className={`rounded border px-3 py-2 active:scale-95 ${
                  active ? "border-transparent bg-white" : "border-white/[0.08] bg-[#2a2a2a]"
                }`}
              >
                <Text className={`font-mono text-[10px] tracking-[0.08em] ${active ? "font-mono-bold text-black" : "text-white"}`}>
                  [{filter.label} {count}]
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {error ? (
          <ScreenState
            title="// RADAR_ERROR"
            message="Unable to load events."
            label="[ RETRY ]"
            onPress={() => void refetch()}
          />
        ) : null}

        {!error && isLoading ? <ScreenState title="// RADAR_BOOT" message="Scanning event sources." /> : null}

        <View className="gap-3">
          {!error && !isLoading
            ? events.map((event) => {
            const urlValid = isOpenableUrl(event.url);
            const seenAt = event.scraped_at ?? event.last_seen_at;

            return (
              <GlassCard key={event.id} className="gap-3" style={{ padding: 12 }}>
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <View className="rounded border border-white/[0.08] bg-[#353535] px-2 py-1">
                      <Text className="font-mono text-[10px] tracking-[0.08em] text-white">
                        [{event.source.toUpperCase().slice(0, 18)}]
                      </Text>
                    </View>
                    <View className="rounded border border-white/[0.08] bg-[#1f1f1f] px-2 py-1">
                      <Text className="font-mono text-[10px] tracking-[0.08em] text-[#c5c6ca]">
                        {event.is_virtual ? "[VIRTUAL // GLOBAL]" : `[${(event.location ?? "ONSITE").toUpperCase().slice(0, 14)} // IN-PERSON]`}
                      </Text>
                    </View>
                  </View>
                  <View className="shrink-0 rounded border border-white/[0.08] bg-[#1f1f1f] px-2 py-1">
                    <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">
                      ID_{event.external_id.slice(0, 8).toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text className="text-xl font-sans-bold text-white">{event.title}</Text>

                {event.description ? (
                  <Text className="font-mono text-[11px] leading-5 text-[#e2e2e2]" numberOfLines={4}>
                    {event.description}
                  </Text>
                ) : null}

                <View className="gap-2 rounded border border-white/[0.08] bg-[rgba(9,9,11,0.70)] px-3 py-3">
                  {event.is_virtual ? (
                    <>
                      <View className="flex-row items-center justify-between">
                        <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">STATUS</Text>
                        <Text className="font-mono-bold text-[12px] tracking-[0.05em] text-white">
                          STARTS IN {formatCountdown(event.start_date)}
                        </Text>
                      </View>
                      <View className="flex-row items-center justify-between">
                        <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">DEADLINE</Text>
                        <Text className="font-mono text-[12px] tracking-[0.05em] text-[#e2e2e2]">
                          {formatShortDate(event.end_date ?? event.start_date).toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-row items-center justify-between">
                        <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">PRIZE_POOL</Text>
                        <Text className="font-mono-bold text-[12px] tracking-[0.05em] text-white">
                          {(event.prize_pool ?? "NETWORK").toUpperCase()}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <View className="flex-row items-center justify-between">
                        <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">SCHEDULE</Text>
                        <Text className="font-mono-bold text-[12px] tracking-[0.05em] text-white">
                          {formatShortDate(event.start_date).toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-row items-center justify-between gap-3">
                        <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">LOCATION</Text>
                        <Text className="flex-1 text-right font-mono text-[12px] tracking-[0.05em] text-[#e2e2e2]" numberOfLines={1}>
                          {(event.location ?? "LOCATION PENDING").toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-row items-center justify-between">
                        <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">STARTS IN</Text>
                        <Text className="font-mono-bold text-[12px] tracking-[0.05em] text-white">
                          {formatCountdown(event.start_date)}
                        </Text>
                      </View>
                    </>
                  )}
                </View>

                <View className="flex-row gap-2">
                  <Pressable
                    disabled={!urlValid}
                    onPress={async () => {
                      await Haptics.selectionAsync();
                      await openExternalUrl(event.url, "Unable to open event");
                    }}
                    className={`flex-1 rounded border border-white/[0.10] bg-transparent px-3 py-2 active:scale-[0.99] ${urlValid ? "" : "opacity-40"}`}
                  >
                    <Text className="text-center font-mono text-[10px] tracking-[0.08em] text-white">[OPEN SOURCE]</Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      await Haptics.selectionAsync();
                      await syncCalendar(event.title, event.start_date, event.end_date, event.url, event.location);
                    }}
                    className="flex-1 rounded border border-white/[0.14] bg-[#2a2a2a] px-3 py-2 active:scale-[0.99]"
                  >
                    <Text className="text-center font-mono-bold text-[10px] tracking-[0.08em] text-white">[+ SYNC CALENDAR]</Text>
                  </Pressable>
                  <Pressable onPress={() => void toggleSaved(event.id)} className="rounded border border-white/20 p-3">
                    <Text className="font-mono text-white">{saved.data?.some(e => e.event_id === event.id) ? "[ UNSAVE REMINDER ]" : "[ SAVE EVENT REMINDER ]"}</Text>
                  </Pressable>
                </View>

                {saved.data?.some((entry) => entry.event_id === event.id) ? (
                  <View className="gap-2 rounded border border-white/[0.08] bg-[rgba(9,9,11,0.70)] px-3 py-3">
                    <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">
                      REGISTRATION DEADLINE · LOCAL TIME
                    </Text>
                    <GlassInput
                      placeholder={DATETIME_INPUT_PLACEHOLDER}
                      autoCapitalize="none"
                      value={
                        deadlineDrafts[event.id] ??
                        toDateTimeInput(saved.data.find((entry) => entry.event_id === event.id)?.registration_deadline)
                      }
                      onChangeText={(value) =>
                        setDeadlineDrafts((current) => ({ ...current, [event.id]: value }))
                      }
                    />
                    <Pressable
                      onPress={async () => {
                        await Haptics.selectionAsync();
                        let registrationDeadline: string | null;
                        try {
                          registrationDeadline = parseDateTimeInput(
                            deadlineDrafts[event.id] ??
                              toDateTimeInput(saved.data?.find((entry) => entry.event_id === event.id)?.registration_deadline)
                          );
                        } catch (error) {
                          Alert.alert(
                            "Invalid deadline",
                            error instanceof Error
                              ? `${error.message}\nUse ${DATETIME_INPUT_PLACEHOLDER}.`
                              : `Use ${DATETIME_INPUT_PLACEHOLDER}.`
                          );
                          return;
                        }
                        try {
                          await api.put(`/notifications/saved-events/${event.id}`, {
                            registration_deadline: registrationDeadline
                          });
                          setDeadlineDrafts((current) => {
                            const next = { ...current };
                            delete next[event.id];
                            return next;
                          });
                          await saved.refetch();
                          if (userId) await syncLocalNotifications(userId);
                          Alert.alert("Reminder saved", "Registration deadline alerts are scheduled.");
                        } catch (error) {
                          Alert.alert("Save failed", error instanceof Error ? error.message : "Please retry.");
                        }
                      }}
                      className="self-start rounded bg-[#353535] px-3 py-2 active:scale-[0.98]"
                    >
                      <Text className="font-mono text-[10px] tracking-[0.08em] text-white">[SAVE DEADLINE]</Text>
                    </Pressable>
                  </View>
                ) : null}

                <View className="flex-row items-center justify-between">
                  <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">
                    {"// SYNCED "}
                    {seenAt ? formatRelativePast(seenAt) : "PENDING"}
                  </Text>
                  <Text className="font-mono-bold text-[10px] tracking-[0.08em] text-white">[200 OK]</Text>
                </View>
              </GlassCard>
            );
          })
            : null}
        </View>

        {!error && !isLoading && !events.length ? (
          <ScreenState title="// NO_SIGNAL" message="No radar events match this filter." />
        ) : null}

        {!error && hasNextPage ? <LoadMoreButton onPress={() => void fetchNextPage()} busy={isFetchingNextPage} /> : null}
      </View>
    </ScrollView>
  );
}
