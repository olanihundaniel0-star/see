import { useContext, useEffect, useState } from "react";
import { Alert, Pressable, Switch, Text, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AccountContext } from "@/lib/session";
import { GlassInput } from "@/components/glass/GlassInput";
import { registerNotifications, snoozeNotification, syncLocalNotifications } from "@/lib/notifications";

type Preferences = { enabled: boolean; timezone: string; advance_minutes: number; overdue_minutes: number; quiet_start: number | null; quiet_end: number | null; reminders: boolean; jobs: boolean; events: boolean; daily: boolean; weekly: boolean; agenda_hour: number };
const booleanFields = ["enabled", "reminders", "jobs", "events", "daily", "weekly"] as const;
export function NotificationSettings() {
  const userId = useContext(AccountContext);
  const prefs = useQuery({ queryKey: [userId, "notification-preferences"], enabled: !!userId, queryFn: async ({ signal }) => (await api.get<Preferences>("/notifications/preferences", { signal })).data });
  const alerts = useQuery({ queryKey: [userId, "notifications"], enabled: !!userId, queryFn: async ({ signal }) => (await api.get<{ id: string; body: string; send_at: string }[]>("/notifications", { signal })).data });
  const [draft, setDraft] = useState<Preferences | null>(null);
  useEffect(() => { if (prefs.data) setDraft(old => old ?? { ...prefs.data, timezone: prefs.data.timezone === "UTC" ? Intl.DateTimeFormat().resolvedOptions().timeZone : prefs.data.timezone }); }, [prefs.data]);
  const save = useMutation({ mutationFn: async () => {
    if (!draft) return;
    await api.put("/notifications/preferences", draft);
    if (userId) await syncLocalNotifications(userId);
  }, onSuccess: () => Alert.alert("Saved", "Notification preferences updated."), onError: error => Alert.alert("Save failed", error.message) });
  return <View className="gap-3 rounded-lg border border-white/20 p-4">
    <Text className="font-mono-bold text-white">NOTIFICATIONS</Text>
    <Pressable className="rounded bg-white p-3" onPress={() => userId && void registerNotifications(userId, true).then(() => Alert.alert("Connected", "This device is registered for alerts.")).catch(e => Alert.alert("Registration failed", e.message))}>
      <Text className="text-center font-mono text-black">[ ENABLE / RETRY DEVICE REGISTRATION ]</Text>
    </Pressable>
    {prefs.isPending ? <Text className="text-white">Loading preferences…</Text> : null}
    {prefs.error ? <Pressable onPress={() => void prefs.refetch()}><Text className="text-white">Unable to load preferences. [RETRY]</Text></Pressable> : null}
    {draft ? <>
      {booleanFields.map(key => <View key={key} className="flex-row items-center justify-between"><Text className="font-mono text-white">{key.toUpperCase()}</Text><Switch value={draft[key]} onValueChange={value => setDraft({ ...draft, [key]: value })} /></View>)}
      <GlassInput label="TIME ZONE (IANA)" value={draft.timezone} onChangeText={timezone => setDraft({ ...draft, timezone })} />
      {(["advance_minutes", "overdue_minutes", "agenda_hour", "quiet_start", "quiet_end"] as const).map(key => <GlassInput key={key} label={key.toUpperCase()} keyboardType="number-pad" value={draft[key]?.toString() ?? ""} onChangeText={text => {
        const trimmed = text.trim();
        if (!trimmed) return setDraft({ ...draft, [key]: key.startsWith("quiet") ? null : 0 });
        const parsed = Number(trimmed);
        if (Number.isFinite(parsed)) setDraft({ ...draft, [key]: parsed });
      }} />)}
      <Text className="font-mono text-xs text-zinc-300">Advance/overdue: minutes, 0 disables. Quiet hours: 0–23, leave both blank to disable. Agenda hour uses your time zone. Overdue follow-up sends once per item.</Text>
      <Pressable disabled={save.isPending} onPress={() => save.mutate()} className="rounded bg-white p-3"><Text className="text-center text-black">{save.isPending ? "SAVING…" : "[ SAVE PREFERENCES ]"}</Text></Pressable>
    </> : null}
    <Text className="font-mono-bold text-white">RECENT / UPCOMING ALERTS</Text>
    {alerts.error ? <Pressable onPress={() => void alerts.refetch()}><Text className="text-white">Alerts unavailable. [RETRY]</Text></Pressable> : null}
    {alerts.data?.slice(0, 10).map(n => <View key={n.id} className="gap-2 border-b border-white/10 py-2"><Text className="text-white">{n.body}</Text><Text className="text-zinc-300">{new Date(n.send_at).toLocaleString()}</Text><Pressable onPress={() => userId && void snoozeNotification(n.id, userId).then(() => { void alerts.refetch(); Alert.alert("Snoozed", "Reminder set for 15 minutes, respecting quiet hours."); }).catch(e => Alert.alert("Snooze failed", e.message))}><Text className="font-mono text-white">[ SNOOZE 15 MINUTES ]</Text></Pressable></View>)}
  </View>;
}
