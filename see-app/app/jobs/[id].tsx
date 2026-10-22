import { useEffect, useRef, useState } from "react";
import { Alert, Linking, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { GlassCard } from "@/components/glass/GlassCard";
import { GlassInput } from "@/components/glass/GlassInput";
import { Checkbox } from "@/components/ui/Checkbox";
import { DateTimeField } from "@/components/ui/DateTimeField";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ScreenState } from "@/components/ui/ScreenState";
import { AppText, Badge, Button, Chip, Screen, ScreenHeader, SectionHeading, styles } from "@/components/ui/primitives";
import { formatProgress, formatShortDateTime, localTimeZone } from "@/lib/format";
import { type JobStatus, useCreateChecklist, useDeleteJob, useJob, useToggleChecklist, useUpdateJob } from "@/lib/queries";
import { useUnsavedChanges } from "@/lib/useUnsavedChanges";

const statuses: { value: JobStatus; label: string }[] = [
  { value: "bookmarked", label: "Saved" }, { value: "applied", label: "Applied" },
  { value: "assessment", label: "Assessment" }, { value: "interviewing", label: "Interview" },
  { value: "offer", label: "Offer" }, { value: "rejected", label: "Rejected" }, { value: "archived", label: "Archived" }
];
export default function JobDossierScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Array.isArray(id) ? id[0] : id;
  const { data: job, isLoading, error, refetch } = useJob(jobId);
  const update = useUpdateJob();
  const toggle = useToggleChecklist(jobId);
  const create = useCreateChecklist(jobId);
  const remove = useDeleteJob();
  const [newTask, setNewTask] = useState("");
  const [notes, setNotes] = useState("");
  const [schedule, setSchedule] = useState({ deadline: "", interview_at: "", assessment_at: "", follow_up_at: "" });
  const [status, setStatus] = useState<JobStatus>("applied");
  const [editing, setEditing] = useState(false);
  const [details, setDetails] = useState({ company: "", role: "", location: "", salary_range: "", job_url: "" });
  const [deleted, setDeleted] = useState(false);
  const initialized = useRef<string | null>(null);
  useEffect(() => {
    if (!job || initialized.current === job.id) return;
    initialized.current = job.id;
    setNotes(job.interview_notes ?? "");
    setStatus(job.status);
    setSchedule({ deadline: job.deadline ?? "", interview_at: job.interview_at ?? "", assessment_at: job.assessment_at ?? "", follow_up_at: job.follow_up_at ?? "" });
    setDetails({ company: job.company, role: job.role, location: job.location ?? "", salary_range: job.salary_range ?? "", job_url: job.job_url ?? "" });
  }, [job]);
  const detailsDirty = !!job && (details.company !== job.company || details.role !== job.role || details.location !== (job.location ?? "") || details.salary_range !== (job.salary_range ?? "") || details.job_url !== (job.job_url ?? ""));
  const scheduleDirty = !!job && (Object.keys(schedule) as (keyof typeof schedule)[]).some(key => {
    const savedValue = job[key];
    return schedule[key] ? !savedValue || new Date(schedule[key]).getTime() !== new Date(savedValue).getTime() : !!savedValue;
  });
  useUnsavedChanges(!deleted && !!job && (detailsDirty || scheduleDirty || notes !== (job.interview_notes ?? "") || status !== job.status || !!newTask.trim()), update.isPending || create.isPending || remove.isPending);
  useEffect(() => { if (deleted) router.back(); }, [deleted]);
  const completed = job?.checklists.filter(item => item.is_completed).length ?? 0;
  return <Screen form>
    <ScreenHeader title="Application" back account={false} />
    {isLoading ? <ScreenState loading title="Loading" message="" /> : error ? <ScreenState title="Application unavailable" message="We couldn’t load this application." label="Retry" onPress={() => void refetch()} /> : !job ? <ScreenState title="Application not found" message="It may have been deleted." label="Back to jobs" onPress={() => router.replace("/(tabs)/jobs")} /> : <>
      <GlassCard>
        <AppText variant="heading">{job.company}</AppText>
        <AppText variant="title">{job.role}</AppText>
        <View style={styles.row}><Badge label={statuses.find(item => item.value === job.status)?.label ?? job.status} />{job.location ? <AppText muted>{job.location}</AppText> : null}</View>
        {job.salary_range ? <AppText muted>{job.salary_range}</AppText> : null}
        <AppText variant="meta" muted>Applied {formatShortDateTime(job.applied_at)}</AppText>
        <View style={styles.row}>
          {job.job_url ? <Button label="Job posting" icon="external-link" variant="secondary" onPress={() => {
            if (!/^https?:\/\//i.test(job.job_url ?? "")) { Alert.alert("Invalid link", "Edit the application to add a valid web address."); return; }
            void Linking.openURL(job.job_url!).catch(() => Alert.alert("Couldn’t open link", "Please check the job posting address."));
          }} /> : null}
          <Button label={editing ? "Close details" : "Edit details"} variant="ghost" onPress={() => setEditing(!editing)} />
        </View>
        {editing ? <>
          <GlassInput editable={!update.isPending && !create.isPending} label="Company *" value={details.company} onChangeText={company => setDetails(current => ({ ...current, company }))} maxLength={150} />
          <GlassInput editable={!update.isPending && !create.isPending} label="Role *" value={details.role} onChangeText={role => setDetails(current => ({ ...current, role }))} maxLength={150} />
          <GlassInput editable={!update.isPending && !create.isPending} label="Location" value={details.location} onChangeText={location => setDetails(current => ({ ...current, location }))} maxLength={150} />
          <GlassInput editable={!update.isPending && !create.isPending} label="Compensation" value={details.salary_range} onChangeText={salary_range => setDetails(current => ({ ...current, salary_range }))} maxLength={100} />
          <GlassInput editable={!update.isPending && !create.isPending} label="Job posting URL" value={details.job_url} onChangeText={job_url => setDetails(current => ({ ...current, job_url }))} keyboardType="url" autoCapitalize="none" maxLength={2048} />
          <Button label="Save details" busy={update.isPending} disabled={!details.company.trim() || !details.role.trim()} onPress={() => {
            if (details.job_url.trim() && !/^https?:\/\//i.test(details.job_url.trim())) { Alert.alert("Check the web address", "Use a link beginning with https:// or http://."); return; }
            update.mutate({ id: job.id, data: { company: details.company.trim(), role: details.role.trim(), location: details.location.trim() || null, salary_range: details.salary_range.trim() || null, job_url: details.job_url.trim() || null } }, { onSuccess: () => { setDetails(current => ({ company: current.company.trim(), role: current.role.trim(), location: current.location.trim(), salary_range: current.salary_range.trim(), job_url: current.job_url.trim() })); setEditing(false); } });
          }} />
        </> : null}
      </GlassCard>
      <SectionHeading title="Application stage" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{statuses.map(item => <Chip key={item.value} label={item.label} selected={status === item.value} onPress={() => setStatus(item.value)} />)}</ScrollView>
      {status !== job.status ? <Button label="Update stage" busy={update.isPending} onPress={() => update.mutate({ id: job.id, data: { status } })} /> : null}
      <SectionHeading title="Dates and milestones" />
      <AppText variant="meta" muted>Local time · {localTimeZone()}</AppText>
      {([{ key: "deadline", label: "Application deadline" }, { key: "interview_at", label: "Interview" }, { key: "assessment_at", label: "Assessment" }, { key: "follow_up_at", label: "Follow-up" }] as const).map(field => <DateTimeField disabled={update.isPending} key={field.key} label={field.label} value={schedule[field.key]} onChange={value => setSchedule(current => ({ ...current, [field.key]: value }))} />)}
      <Button label="Save dates" busy={update.isPending} onPress={() => update.mutate({ id: job.id, data: { deadline: schedule.deadline || null, interview_at: schedule.interview_at || null, assessment_at: schedule.assessment_at || null, follow_up_at: schedule.follow_up_at || null } }, { onSuccess: () => Alert.alert("Dates saved", "Your milestone reminders have been updated.") })} />
      <SectionHeading title="Preparation" detail={`${completed} of ${job.checklists.length} done`} />
      {job.checklists.length ? <ProgressBar value={formatProgress(completed, job.checklists.length)} /> : <AppText muted>Add the steps you want to finish before your next interview.</AppText>}
      <View>{job.checklists.map(item => <Checkbox key={item.id} checked={item.is_completed} label={item.title} disabled={toggle.isPending} onChange={isCompleted => toggle.mutate({ checklistId: item.id, isCompleted })} />)}</View>
      <GlassInput editable={!update.isPending && !create.isPending} label="New preparation task" placeholder="What needs to be done?" value={newTask} onChangeText={setNewTask} maxLength={255} />
      <Button label="Add task" icon="plus" variant="secondary" busy={create.isPending} disabled={!newTask.trim()} onPress={() => create.mutate(newTask.trim(), { onSuccess: () => setNewTask("") })} />
      <SectionHeading title="Interview notes" />
      <GlassInput editable={!update.isPending && !create.isPending} accessibilityLabel="Interview notes" placeholder="Questions, preparation, and follow-up notes…" multiline value={notes} onChangeText={setNotes} maxLength={20000} style={{ minHeight: 200 }} />
      <Button label="Save notes" busy={update.isPending} onPress={() => update.mutate({ id: job.id, data: { interview_notes: notes } }, { onSuccess: () => Alert.alert("Notes saved") })} />
      <View style={styles.divider} />
      <View style={styles.row}>
        {job.status !== "archived" ? <Button label="Archive application" variant="secondary" disabled={update.isPending} onPress={() => Alert.alert("Archive application?", "You can find it later under Archived in Jobs.", [{ text: "Cancel", style: "cancel" }, { text: "Archive", onPress: () => update.mutate({ id: job.id, data: { status: "archived" } }, { onSuccess: () => setStatus("archived") }) }])} /> : null}
        <Button label="Delete application" variant="danger" busy={remove.isPending} onPress={() => Alert.alert("Delete application?", "This deletes the application and its preparation tasks.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => remove.mutate(job.id, { onSuccess: () => setDeleted(true) }) }])} />
      </View>
    </>}
  </Screen>;
}
