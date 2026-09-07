import { useCallback } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import * as Calendar from "expo-calendar";
import { GlassCard } from "@/components/glass/GlassCard";
import { GlassPill } from "@/components/glass/GlassPill";
import { AsciiBanner } from "@/components/ui/AsciiBanner";
import { theme } from "@/constants/theme";

const filters = ["ALL", "HACKATHONS (DEVPOST)", "MEETUPS"] as const;

const events = [
  {
    title: "Devpost AI Hackathon",
    source: "DEVPOST",
    countdown: "36H LEFT",
    prize: "$50,000",
    location: "REMOTE"
  },
  {
    title: "Lagos React Meetup",
    source: "MEETUP",
    countdown: "2D LEFT",
    prize: "NETWORK",
    location: "LAGOS"
  }
];

export default function EventsScreen() {
  const syncCalendar = useCallback(async () => {
    const perm = await Calendar.requestCalendarPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Calendar permission required", "Grant access to sync events.");
      return;
    }
    Alert.alert("Calendar sync", "Calendar access granted. Hook this into your event feed.");
  }, []);

  return (
    <ScrollView className="flex-1 bg-black" contentContainerClassName="px-4 pb-28 pt-4">
      <View className="gap-4">
        <AsciiBanner title={theme.ascii.radar} subtitle="Hackathons and tech meetups" right="[RADAR]" />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {filters.map((filter, index) => (
            <Pressable
              key={filter}
              className={`rounded-lg border px-4 py-2 ${
                index === 0 ? "border-white/20 bg-zinc-900/70" : "border-white/10 bg-zinc-950/50"
              }`}
            >
              <Text className="font-mono text-[10px] tracking-[0.16em] text-white">{filter}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {events.map((event) => (
          <GlassCard key={event.title} className="gap-3">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 gap-1">
                <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">{event.source}</Text>
                <Text className="text-2xl font-bold text-white">{event.title}</Text>
                <Text className="font-mono text-[11px] text-zinc-400">{event.location}</Text>
              </View>
              <GlassPill label="COUNTDOWN" value={event.countdown} tone="active" />
            </View>
            <View className="flex-row items-center justify-between">
              <GlassPill label="PRIZE / VALUE" value={event.prize} />
              <Pressable
                onPress={syncCalendar}
                className="rounded-lg border border-white/10 bg-white px-3 py-2 active:scale-[0.99]"
              >
                <Text className="font-mono text-[10px] font-bold text-black">[+ SYNC CALENDAR]</Text>
              </Pressable>
            </View>
          </GlassCard>
        ))}
      </View>
    </ScrollView>
  );
}
