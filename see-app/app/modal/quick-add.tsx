import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { GlassInput } from "@/components/glass/GlassInput";
import { DateTimeField } from "@/components/ui/DateTimeField";
import { AppText, Button, Chip, IconButton, Screen, ScreenHeader, styles } from "@/components/ui/primitives";
import { localTimeZone } from "@/lib/format";
import { useQuickAdd, type JobStatus, type ReminderPriority } from "@/lib/queries";
import { useUnsavedChanges } from "@/lib/useUnsavedChanges";

type Mode = "job" | "note" | "reminder";
const modes: { value: Mode; label: string }[] = [{ value: "job", label: "Job" }, { value: "note", label: "Note" }, { value: "reminder", label: "Reminder" }];
const initialJob = { company: "", role: "", location: "", salary_range: "", job_url: "", deadline: "", status: "applied" as JobStatus };
const initialNote = { title: "", content: "", tags: "" };
const initialReminder = { title: "", due_date: "", priority: "medium" as ReminderPriority };
export default function QuickAddModal() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === "note" || params.mode === "reminder" ? params.mode : "job");
  const [job, setJob] = useState(initialJob);
  const [note, setNote] = useState(initialNote);
  const [reminder, setReminder] = useState(initialReminder);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [feedback, setFeedback] = useState("");
  const saving = useRef(false);
  const quickAdd = useQuickAdd();
  const dirty = JSON.stringify(job) !== JSON.stringify(initialJob) || JSON.stringify(note) !== JSON.stringify(initialNote) || JSON.stringify(reminder) !== JSON.stringify(initialReminder);
  useUnsavedChanges(dirty && !saved, quickAdd.isPending);
  useEffect(() => { if (saved) router.back(); }, [saved]);
  const submit = async () => {
    if (saving.current) return;
    setError("");
    if (mode === "job" && (!job.company.trim() || !job.role.trim())) { setError("Enter a company and role."); return; }
    if (mode === "job" && job.job_url.trim() && !/^https?:\/\//i.test(job.job_url.trim())) { setError("Use a job link beginning with https:// or http://."); return; }
    if (mode === "note" && (!note.title.trim() || !note.content.trim())) { setError("Add a title and some content to your note."); return; }
    if (mode === "reminder" && (!reminder.title.trim() || !reminder.due_date)) { setError("Add a reminder title and choose when it’s due."); return; }
    saving.current = true;
    try {
      if (mode === "job") await quickAdd.mutateAsync({ type: "job", title: job.company.trim(), data: { company: job.company.trim(), role: job.role.trim(), location: job.location.trim() || null, salary_range: job.salary_range.trim() || null, job_url: job.job_url.trim() || null, status: job.status, deadline: job.deadline || null, interview_notes: null } });
      if (mode === "note") await quickAdd.mutateAsync({ type: "note", title: note.title.trim(), data: { title: note.title.trim(), content: note.content, tags: note.tags.trim() || null } });
      if (mode === "reminder") await quickAdd.mutateAsync({ type: "reminder", title: reminder.title.trim(), data: { title: reminder.title.trim(), due_date: reminder.due_date, priority: reminder.priority } });
      const otherDrafts = (mode !== "job" && JSON.stringify(job) !== JSON.stringify(initialJob))
        || (mode !== "note" && JSON.stringify(note) !== JSON.stringify(initialNote))
        || (mode !== "reminder" && JSON.stringify(reminder) !== JSON.stringify(initialReminder));
      if (mode === "job") setJob(initialJob);
      if (mode === "note") setNote(initialNote);
      if (mode === "reminder") setReminder(initialReminder);
      if (otherDrafts) setFeedback("Saved. Your other drafts are still here.");
      else setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save. Please try again."); }
    finally { saving.current = false; }
  };
  return <Screen form>
    <ScreenHeader title="Quick add" account={false} action={<IconButton name="x" label="Close quick add" disabled={quickAdd.isPending} onPress={() => router.back()} />} />
    <View style={styles.row}>{modes.map(item => <Chip disabled={quickAdd.isPending} key={item.value} label={item.label} selected={mode === item.value} onPress={() => { if (!quickAdd.isPending) { setMode(item.value); setError(""); } }} />)}</View>
    {feedback ? <AppText accessibilityLiveRegion="polite">{feedback}</AppText> : null}
    <AppText variant="meta" muted>Fields marked * are required.</AppText>
    {mode === "job" ? <>
      <GlassInput editable={!quickAdd.isPending} label="Company *" placeholder="Company name" maxLength={150} value={job.company} onChangeText={company => setJob(current => ({ ...current, company }))} />
      <GlassInput editable={!quickAdd.isPending} label="Role *" placeholder="e.g. Backend Engineer" maxLength={150} value={job.role} onChangeText={role => setJob(current => ({ ...current, role }))} />
      <AppText variant="label">Stage</AppText>
      <View style={styles.row}>{([{ value: "bookmarked", label: "Saved" }, { value: "applied", label: "Applied" }, { value: "interviewing", label: "Interview" }] as const).map(item => <Chip disabled={quickAdd.isPending} key={item.value} label={item.label} selected={job.status === item.value} onPress={() => setJob(current => ({ ...current, status: item.value }))} />)}</View>
      <DateTimeField disabled={quickAdd.isPending} label="Application deadline" value={job.deadline} onChange={deadline => setJob(current => ({ ...current, deadline }))} />
      <GlassInput editable={!quickAdd.isPending} label="Location" placeholder="City, hybrid, or remote" maxLength={150} value={job.location} onChangeText={location => setJob(current => ({ ...current, location }))} />
      <GlassInput editable={!quickAdd.isPending} label="Compensation" placeholder="Salary range, if known" maxLength={100} value={job.salary_range} onChangeText={salary_range => setJob(current => ({ ...current, salary_range }))} />
      <GlassInput editable={!quickAdd.isPending} label="Job posting URL" placeholder="https://" keyboardType="url" autoCapitalize="none" autoCorrect={false} maxLength={2048} value={job.job_url} onChangeText={job_url => setJob(current => ({ ...current, job_url }))} />
    </> : mode === "note" ? <>
      <GlassInput editable={!quickAdd.isPending} label="Title *" placeholder="What’s on your mind?" maxLength={255} value={note.title} onChangeText={title => setNote(current => ({ ...current, title }))} />
      <GlassInput editable={!quickAdd.isPending} label="Content *" placeholder="Capture an idea, a snippet, or a plan…" multiline style={{ minHeight: 240 }} maxLength={20000} value={note.content} onChangeText={content => setNote(current => ({ ...current, content }))} />
      <GlassInput editable={!quickAdd.isPending} label="Tags" placeholder="interviews, typescript" helper="Separate tags with commas." maxLength={255} value={note.tags} onChangeText={tags => setNote(current => ({ ...current, tags }))} />
    </> : <>
      <GlassInput editable={!quickAdd.isPending} label="Reminder *" placeholder="What do you need to do?" maxLength={255} value={reminder.title} onChangeText={title => setReminder(current => ({ ...current, title }))} />
      <DateTimeField disabled={quickAdd.isPending} label="Due date and time" required value={reminder.due_date} onChange={due_date => setReminder(current => ({ ...current, due_date }))} />
      <AppText variant="label">Priority</AppText>
      <View style={styles.row}>{(["low", "medium", "high"] as const).map(priority => <Chip disabled={quickAdd.isPending} key={priority} label={priority.charAt(0).toUpperCase() + priority.slice(1)} selected={reminder.priority === priority} onPress={() => setReminder(current => ({ ...current, priority }))} />)}</View>
    </>}
    {mode !== "note" ? <AppText variant="meta" muted>Local time · {localTimeZone()}</AppText> : null}
    {error ? <AppText danger accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</AppText> : null}
    <Button label={quickAdd.isPending ? "Saving…" : mode === "job" ? "Add application" : mode === "note" ? "Save note" : "Create reminder"} busy={quickAdd.isPending} onPress={() => void submit()} />
    <Button label="Cancel" variant="ghost" disabled={quickAdd.isPending} onPress={() => router.back()} />
  </Screen>;
}
