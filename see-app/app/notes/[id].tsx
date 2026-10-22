import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { GlassInput } from "@/components/glass/GlassInput";
import { ScreenState } from "@/components/ui/ScreenState";
import { AppText, Button, Screen, ScreenHeader, styles } from "@/components/ui/primitives";
import { formatRelativePast } from "@/lib/format";
import { useDeleteNote, useNote, useUpdateNote } from "@/lib/queries";
import { useUnsavedChanges } from "@/lib/useUnsavedChanges";

export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const noteId = Array.isArray(id) ? id[0] : id;
  const { data: note, isLoading, error, refetch } = useNote(noteId);
  const update = useUpdateNote();
  const remove = useDeleteNote();
  const [draft, setDraft] = useState({ title: "", content: "", tags: "" });
  const [baseline, setBaseline] = useState(draft);
  const [deleted, setDeleted] = useState(false);
  const [saved, setSaved] = useState(false);
  const initialized = useRef<string | null>(null);
  useEffect(() => {
    if (note && initialized.current !== note.id) {
      initialized.current = note.id;
      const value = { title: note.title, content: note.content, tags: note.tags ?? "" };
      setDraft(value); setBaseline(value);
    }
  }, [note]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  useUnsavedChanges(dirty && !deleted);
  useEffect(() => { if (deleted) router.back(); }, [deleted]);
  return <Screen form>
    <ScreenHeader title="Edit note" back account={false} />
    {error ? <ScreenState title="Note unavailable" message="We couldn’t load this note." label="Retry" onPress={() => void refetch()} /> : isLoading ? <ScreenState loading title="Loading" message="" /> : !note ? <ScreenState title="Note not found" message="This note may have been deleted." /> : <>
      <AppText variant="meta" muted accessibilityLiveRegion="polite">{dirty ? "Unsaved changes" : saved ? "All changes saved" : `Edited ${formatRelativePast(note.updated_at)}`}</AppText>
      <GlassInput label="Title *" value={draft.title} onChangeText={title => setDraft(current => ({ ...current, title }))} maxLength={255} style={{ fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 22, lineHeight: 28 }} />
      <GlassInput label="Content *" value={draft.content} onChangeText={content => setDraft(current => ({ ...current, content }))} multiline maxLength={20000} style={{ minHeight: 320, lineHeight: 26 }} placeholder="Your notes…" />
      <GlassInput label="Tags" value={draft.tags} onChangeText={tags => setDraft(current => ({ ...current, tags }))} placeholder="interviews, typescript" helper="Separate tags with commas." maxLength={255} />
      <Button label="Save note" busy={update.isPending} disabled={!draft.title.trim() || !draft.content.trim() || !dirty} onPress={() => {
        const submitted = { ...draft, title: draft.title.trim(), tags: draft.tags.trim() };
        update.mutate({ id: note.id, data: { ...submitted, tags: submitted.tags || null } }, { onSuccess: () => { setBaseline(submitted); setDraft(current => JSON.stringify(current) === JSON.stringify(draft) ? submitted : current); setSaved(true); } });
      }} />
      <View style={styles.divider} />
      <Button label="Delete note" variant="danger" busy={remove.isPending} onPress={() => Alert.alert("Delete note?", "This cannot be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => remove.mutate(note.id, { onSuccess: () => setDeleted(true) }) }])} />
    </>}
  </Screen>;
}
