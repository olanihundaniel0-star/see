import { useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import * as Calendar from "expo-calendar";
import * as Haptics from "expo-haptics";

import { GlassCard } from "@/components/glass/GlassCard";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import { ScreenState } from "@/components/ui/ScreenState";
import { formatCountdown, formatRelativePast, formatShortDate } from "@/lib/format";
import { useInfiniteEvents } from "@/lib/queries";

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
    const perm = await Calendar.requestCalendarPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Calendar permission required", "Grant access to sync events.");
      return;
    }

    try {
      const calendar = await Calendar.getDefaultCalendarAsync();
      const start = new Date(startDate);
      const end = endDate ? new Date(endDate) : new Date(start.getTime() + 60 * 60 * 1000);
      const eventId = await Calendar.createEventAsync(calendar.id, {
        title,
        startDate: start,
        endDate: end,
        timeZone: "Africa/Lagos",
        location: location ?? undefined,
        notes: url ? `Source: ${url}` : undefined,
        allDay: false,
        availability: Calendar.Availability.BUSY,
        status: Calendar.EventStatus.CONFIRMED
      });
      Alert.alert("Calendar synced", `Saved ${title} to your calendar. Event id: ${eventId}`);
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
                </View>

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
