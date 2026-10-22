import { useContext, useEffect, useState } from "react";
import { Alert, Switch, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AccountContext } from "@/lib/session";
import { GlassInput } from "@/components/glass/GlassInput";
import { DateTimeField } from "@/components/ui/DateTimeField";
import { ScreenState } from "@/components/ui/ScreenState";
import { AppText, Button, SectionHeading, styles } from "@/components/ui/primitives";
import { registerNotifications, snoozeNotification, syncLocalNotifications } from "@/lib/notifications";
import { formatFullDateTime, localTimeZone } from "@/lib/format";
import { theme } from "@/constants/theme";

type Preferences = { enabled: boolean; timezone: string; advance_minutes: number; overdue_minutes: number; quiet_start: number | null; quiet_end: number | null; reminders: boolean; jobs: boolean; events: boolean; daily: boolean; weekly: boolean; agenda_hour: number };
const switches = [
  { key: "enabled", label: "Allow notifications", detail: "The main switch for all SEE alerts." },
  { key: "reminders", label: "Task reminders", detail: "Alerts for your reminders and deadlines." },
  { key: "jobs", label: "Job milestones", detail: "Interviews, assessments, and follow-ups." },
  { key: "events", label: "Saved events", detail: "Event dates and registration deadlines." },
  { key: "daily", label: "Daily agenda", detail: "A daily view of what’s ahead." },
  { key: "weekly", label: "Weekly summary", detail: "A weekly overview of your activity." }
] as const;
function Toggle({ label, detail, value, onChange, disabled }: { label: string; detail?: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 16, minHeight: 56, paddingVertical: 8 }}>
    <View style={{ flex: 1, gap: 4 }}><AppText variant="label">{label}</AppText>{detail ? <AppText variant="meta" muted>{detail}</AppText> : null}</View>
    <Switch accessibilityLabel={label} disabled={disabled} value={value} onValueChange={onChange} trackColor={{ false: theme.colors.surfaceHighest, true: theme.colors.switchTrackActive }} thumbColor={theme.colors.primary} />
  </View>;
}
const hourValue = (hour: number | null) => hour === null ? "" : `${String(hour).padStart(2, "0")}:00`;
export function NotificationSettings() {
  const userId = useContext(AccountContext);
  const prefs = useQuery({ queryKey: [userId, "notification-preferences"], enabled: !!userId, queryFn: async ({ signal }) => (await api.get<Preferences>("/notifications/preferences", { signal })).data });
  const alerts = useQuery({ queryKey: [userId, "notifications"], enabled: !!userId, queryFn: async ({ signal }) => (await api.get<{ id: string; body: string; send_at: string }[]>("/notifications", { signal })).data });
  const [draft, setDraft] = useState<Preferences | null>(null);
  const [advance, setAdvance] = useState("");
  const [overdue, setOverdue] = useState("");
  const [validation, setValidation] = useState("");
  const [registering, setRegistering] = useState(false);
  const [snoozing, setSnoozing] = useState<string | null>(null);
  useEffect(() => {
    if (prefs.data && !draft) {
      setDraft({ ...prefs.data });
      setAdvance(String(prefs.data.advance_minutes)); setOverdue(String(prefs.data.overdue_minutes));
    }
  }, [prefs.data, draft]);
  const save = useMutation({ mutationFn: async (value: Preferences) => {
    await api.put("/notifications/preferences", value);
    if (userId) await syncLocalNotifications(userId);
  }, onSuccess: () => { void prefs.refetch(); Alert.alert("Preferences saved", "Your notification schedule has been updated."); }, onError: error => Alert.alert("Save failed", error.message) });
  const submit = () => {
    if (!draft) return;
    const validMinutes = (value: string) => /^\d+$/.test(value) && Number(value) <= 10080;
    if (!validMinutes(advance) || !validMinutes(overdue)) { setValidation("Enter whole minutes from 0 to 10,080. Use 0 to turn an alert off."); return; }
    try { new Intl.DateTimeFormat("en-GB", { timeZone: draft.timezone }).format(); } catch { setValidation("Choose a valid time zone, such as Africa/Lagos, or use your device time zone."); return; }
    if ((draft.quiet_start === null) !== (draft.quiet_end === null)) { setValidation("Choose both quiet-hour times, or turn quiet hours off."); return; }
    setValidation("");
    save.mutate({ ...draft, advance_minutes: Number(advance), overdue_minutes: Number(overdue) });
  };
  return <View style={{ gap: 16 }}>
    <SectionHeading title="Notifications" />
    <Button label="Connect this device" variant="secondary" busy={registering} onPress={() => {
      if (!userId) return;
      setRegistering(true);
      void registerNotifications(userId, true).then(() => Alert.alert("Device connected", "This device is ready for SEE alerts.")).catch(e => Alert.alert("Couldn’t connect", e.message)).finally(() => setRegistering(false));
    }} />
    {prefs.isPending ? <ScreenState loading title="Loading" message="" /> : prefs.error ? <ScreenState title="Preferences unavailable" message="We couldn’t load your notification settings." label="Retry" onPress={() => void prefs.refetch()} /> : null}
    {draft ? <>
      <View>{switches.map(item => <Toggle key={item.key} label={item.label} detail={item.detail} value={draft[item.key]} disabled={save.isPending} onChange={value => setDraft(current => current ? { ...current, [item.key]: value } : current)} />)}</View>
      <View style={styles.divider} />
      <SectionHeading title="Timing" />
      <GlassInput label="Alert before a deadline (minutes)" helper="Use 0 to turn advance alerts off." keyboardType="number-pad" value={advance} onChangeText={setAdvance} maxLength={5} />
      <GlassInput label="Overdue follow-up (minutes)" helper="Sent once per item. Use 0 to turn it off." keyboardType="number-pad" value={overdue} onChangeText={setOverdue} maxLength={5} />
      <GlassInput label="Time zone" value={draft.timezone} autoCapitalize="none" autoCorrect={false} onChangeText={timezone => setDraft({ ...draft, timezone })} helper="Quiet hours and agenda time follow this time zone." />
      <Button label={`Use device time zone (${localTimeZone()})`} variant="secondary" onPress={() => setDraft({ ...draft, timezone: localTimeZone() })} />
      <DateTimeField label="Agenda time" mode="time" hourOnly required value={hourValue(draft.agenda_hour)} onChange={value => setDraft({ ...draft, agenda_hour: Number(value.split(":")[0]) })} />
      <Toggle label="Quiet hours" detail="Pause notifications during these hours." value={draft.quiet_start !== null} onChange={enabled => setDraft({ ...draft, quiet_start: enabled ? 22 : null, quiet_end: enabled ? 8 : null })} />
      {draft.quiet_start !== null ? <>
        <DateTimeField label="Quiet hours start" mode="time" hourOnly required value={hourValue(draft.quiet_start)} onChange={value => setDraft({ ...draft, quiet_start: Number(value.split(":")[0]) })} />
        <DateTimeField label="Quiet hours end" mode="time" hourOnly required value={hourValue(draft.quiet_end)} onChange={value => setDraft({ ...draft, quiet_end: Number(value.split(":")[0]) })} />
      </> : null}
      {validation ? <AppText danger accessibilityRole="alert">{validation}</AppText> : null}
      <Button label="Save preferences" busy={save.isPending} onPress={submit} />
    </> : null}
    <SectionHeading title="Recent and upcoming alerts" />
    {alerts.error ? <ScreenState title="Alerts unavailable" message="Try again to load your alerts." label="Retry" onPress={() => void alerts.refetch()} /> : alerts.isPending ? <AppText muted>Loading alerts…</AppText> : !alerts.data?.length ? <AppText muted>No alerts yet. Add a reminder or save an event to get started.</AppText> : alerts.data.slice(0, 10).map(item => <View key={item.id} style={{ gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
      <AppText>{item.body}</AppText><AppText variant="meta" muted>{formatFullDateTime(item.send_at)}</AppText>
      <Button label="Snooze 15 minutes" icon="clock" variant="ghost" busy={snoozing === item.id} disabled={!!snoozing} onPress={() => {
        if (!userId) return;
        setSnoozing(item.id);
        void snoozeNotification(item.id, userId).then(() => { void alerts.refetch(); Alert.alert("Snoozed", "Set for 15 minutes, respecting your quiet hours."); }).catch(e => Alert.alert("Couldn’t snooze", e.message)).finally(() => setSnoozing(null));
      }} style={{ alignSelf: "flex-start" }} />
    </View>)}
  </View>;
}
