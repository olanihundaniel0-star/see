import { useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import * as Calendar from "expo-calendar";
import * as Haptics from "expo-haptics";

import { GlassCard } from "@/components/glass/GlassCard";
import { GlassPill } from "@/components/glass/GlassPill";
import { AsciiBanner } from "@/components/ui/AsciiBanner";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import { ScreenState } from "@/components/ui/ScreenState";
import { theme } from "@/constants/theme";
import { formatCountdown, formatShortDateTime, formatShortDate } from "@/lib/format";
import { useInfiniteEvents } from "@/lib/queries";

const filters = [
  { label: "ALL", value: undefined },
  { label: "VIRTUAL", value: true },
  { label: "IN-PERSON", value: false }
] as const;

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
      <View className="gap-4">
        <AsciiBanner title={theme.ascii.radar} subtitle="Hackathons, meetups, and live scans" right={isLoading ? "[SCAN]" : "[RADAR]"} />

        <GlassCard className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">// SOURCE_FILTERS</Text>
            <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-400">[{counts.all}] DETECTED</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {filters.map((filter) => {
              const active = filter.value === activeFilter;
              const label =
                filter.label === "ALL"
                  ? `ALL ${counts.all}`
                  : filter.label === "VIRTUAL"
                    ? `VIRTUAL ${counts.virtual}`
                    : `IN-PERSON ${counts.inPerson}`;

              return (
                <Pressable
                  key={filter.label}
                  onPress={async () => {
                    await Haptics.selectionAsync();
                    setActiveFilter(filter.value);
                  }}
                  className={`rounded-lg border px-4 py-2 ${active ? "border-white/20 bg-zinc-900/70" : "border-white/10 bg-zinc-950/50"}`}
                >
                  <Text className="font-mono text-[10px] tracking-[0.16em] text-white">{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </GlassCard>

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
            const categories = event.categories ?? [];

            return (
              <GlassCard key={event.id} className="gap-3">
                <View className="flex-row items-start justify-between gap-4">
                  <View className="flex-1 gap-1">
                    <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">{event.source.toUpperCase()}</Text>
                    <Text className="text-2xl font-bold text-white">{event.title}</Text>
                    <Text className="font-mono text-[11px] text-zinc-400">
                      {event.location ?? (event.is_virtual ? "REMOTE" : "LOCATION PENDING")}
                    </Text>
                  </View>
                  <GlassPill label="COUNTDOWN" value={formatCountdown(event.start_date)} tone={event.is_virtual ? "active" : "default"} />
                </View>

                {event.description ? <Text className="font-mono text-[11px] leading-5 text-zinc-300">{event.description}</Text> : null}

                <View className="flex-row flex-wrap gap-2">
                  <GlassPill label="START" value={formatShortDate(event.start_date)} />
                  <GlassPill label="VALUE" value={event.prize_pool ?? "NETWORK"} tone="active" />
                  <GlassPill label="MODE" value={event.is_virtual ? "VIRTUAL" : "IN-PERSON"} />
                  {categories.slice(0, 2).map((category) => (
                    <GlassPill key={category} label="TAG" value={category.toUpperCase()} />
                  ))}
                </View>

                <View className="flex-row gap-2">
                  <Pressable
                    onPress={async () => {
                      await Haptics.selectionAsync();
                      await Linking.openURL(event.url);
                    }}
                    className="flex-1 rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-2 active:scale-[0.99]"
                  >
                    <Text className="text-center font-mono text-[10px] text-white">[OPEN SOURCE]</Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      await Haptics.selectionAsync();
                      await syncCalendar(event.title, event.start_date, event.end_date, event.url, event.location);
                    }}
                    className="flex-1 rounded-lg border border-white/20 bg-white px-3 py-2 active:scale-[0.99]"
                  >
                    <Text className="text-center font-mono text-[10px] font-bold text-black">[SYNC CALENDAR]</Text>
                  </Pressable>
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
