import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { GlassInput } from "@/components/glass/GlassInput";
import { DateTimeField } from "@/components/ui/DateTimeField";
import { Checkbox } from "@/components/ui/Checkbox";
import { ScreenState } from "@/components/ui/ScreenState";
import { AppText, Button, Chip, Screen, ScreenHeader, styles } from "@/components/ui/primitives";
import { localTimeZone } from "@/lib/format";
import { type ReminderPriority, useDeleteReminder, useReminder, useUpdateReminder } from "@/lib/queries";
import { useUnsavedChanges } from "@/lib/useUnsavedChanges";
export default function ReminderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reminderId = Array.isArray(id) ? id[0] : id;
  const { data: reminder, isLoading, error, refetch } = useReminder(reminderId);
  const update = useUpdateReminder();
  const remove = useDeleteReminder();
  const [draft, setDraft] = useState({ title: "", due_date: "", priority: "medium" as ReminderPriority, is_completed: false });
  const [baseline, setBaseline] = useState(draft);
  const [deleted, setDeleted] = useState(false);
  const [saved, setSaved] = useState(false);
  const initialized = useRef<string | null>(null);
  useEffect(() => {
    if (reminder && initialized.current !== reminder.id) {
      initialized.current = reminder.id;
      const value = { title: reminder.title, due_date: reminder.due_date, priority: reminder.priority, is_completed: reminder.is_completed };
      setDraft(value); setBaseline(value);
    }
  }, [reminder]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  useUnsavedChanges(dirty && !deleted);
  useEffect(() => { if (deleted) router.back(); }, [deleted]);
  return <Screen form>
    <ScreenHeader title="Edit reminder" back account={false} />
    {error ? <ScreenState title="Reminder unavailable" message="We couldn’t load this reminder." label="Retry" onPress={() => void refetch()} /> : isLoading ? <ScreenState loading title="Loading" message="" /> : !reminder ? <ScreenState title="Reminder not found" message="It may have been deleted." /> : <>
      {saved && !dirty ? <AppText variant="meta" muted accessibilityLiveRegion="polite">Changes saved</AppText> : null}
      <GlassInput label="Title *" value={draft.title} onChangeText={title => setDraft(current => ({ ...current, title }))} maxLength={255} />
      <DateTimeField label="Due date and time" required value={draft.due_date} onChange={due_date => setDraft(current => ({ ...current, due_date }))} />
      <AppText variant="meta" muted>Local time · {localTimeZone()}</AppText>
      <AppText variant="label">Priority</AppText>
      <View style={styles.row}>{(["low", "medium", "high"] as const).map(priority => <Chip key={priority} label={priority.charAt(0).toUpperCase() + priority.slice(1)} selected={draft.priority === priority} onPress={() => setDraft(current => ({ ...current, priority }))} />)}</View>
      <Checkbox checked={draft.is_completed} label="Completed" onChange={is_completed => setDraft(current => ({ ...current, is_completed }))} />
      <Button label="Save reminder" busy={update.isPending} disabled={!dirty || !draft.title.trim() || !draft.due_date} onPress={() => {
        const submitted = { ...draft, title: draft.title.trim() };
        update.mutate({ id: reminder.id, data: submitted }, { onSuccess: () => { setBaseline(submitted); setDraft(current => JSON.stringify(current) === JSON.stringify(draft) ? submitted : current); setSaved(true); } });
      }} />
      <Button label="Delete reminder" variant="danger" busy={remove.isPending} onPress={() => Alert.alert("Delete reminder?", "Its scheduled alerts will also be cancelled.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => remove.mutate(reminder.id, { onSuccess: () => setDeleted(true) }) }])} />
    </>}
  </Screen>;
}
