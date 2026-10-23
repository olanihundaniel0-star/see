import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Pressable, RefreshControl, View } from "react-native";
import { GlassCard } from "@/components/glass/GlassCard";
import { GlassInput } from "@/components/glass/GlassInput";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import { ScreenState } from "@/components/ui/ScreenState";
import { AppText, Badge, Chip, Screen, ScreenHeader, styles } from "@/components/ui/primitives";
import { formatRelativePast } from "@/lib/format";
import { useInfiniteNotes, type NoteSource } from "@/lib/queries";
import { theme } from "@/constants/theme";
import { FilterBar } from "@/components/ui/FilterBar";
import { QueryFeedback } from "@/components/ui/QueryFeedback";

export default function NotesScreen() {
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [source, setSource] = useState<NoteSource>("manual");
  const [deferredSearch, setDeferredSearch] = useState(search);
  useEffect(() => { const timer = setTimeout(() => setDeferredSearch(search), 300); return () => clearTimeout(timer); }, [search]);
  const { data, isLoading, isRefetching, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteNotes(deferredSearch.trim() || undefined, activeTag || undefined, source);
  const notes = useMemo(() => data?.pages.flatMap(page => page) ?? [], [data]);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  useEffect(() => {
    setKnownTags(current => {
      const tags = new Set(current);
      notes.forEach(note => note.tags?.split(",").forEach(tag => { if (tag.trim()) tags.add(tag.trim()); }));
      // New results must not reorder filters already under the user's finger.
      return tags.size === current.length ? current : [...current, ...[...tags].filter(tag => !current.includes(tag)).sort()];
    });
  }, [notes]);
  return <Screen refreshControl={<RefreshControl refreshing={isRefetching && !isLoading} onRefresh={() => void refetch()} tintColor={theme.colors.primary} />}>
    <ScreenHeader title="Notes" subtitle="A place for what you’re learning." addMode="note" />
    <FilterBar label="Note source">
      {([{ value: "manual", label: "My notes" }, { value: "email", label: "Email imports" }, { value: "all", label: "All" }] as const).map(item => <Chip key={item.value} label={item.label} selected={source === item.value} onPress={() => { setSource(item.value); setActiveTag(""); }} />)}
    </FilterBar>
    {source === "email" ? <AppText variant="meta" muted>Earlier notes created from email. New emails no longer create personal notes.</AppText> : null}
    <GlassInput accessibilityLabel="Search notes" placeholder="Search notes" value={search} onChangeText={setSearch} maxLength={500} returnKeyType="search" autoCapitalize="none" clearButtonMode="while-editing" />
    {knownTags.length ? <FilterBar label="Note tags">
      <Chip label="All tags" selected={!activeTag} onPress={() => setActiveTag("")} />
      {knownTags.map(tag => <Chip key={tag} label={`#${tag}`} selected={tag === activeTag} onPress={() => setActiveTag(tag)} />)}
    </FilterBar> : null}
    <QueryFeedback hasData={!!data} refreshing={isRefetching} error={error} onRetry={() => void refetch()} />
    {error && !data ? <ScreenState title="Notes unavailable" message="Your notes couldn’t be loaded." label="Retry" onPress={() => void refetch()} /> : isLoading ? <ScreenState loading title="Loading" message="" /> : !notes.length ? <ScreenState title={search || activeTag ? "No matching notes" : "Make room for an idea"} message={search || activeTag ? "Try another search or clear your tag filter." : "Capture interview prep, code snippets, and ideas."} label={search || activeTag ? "Clear filters" : "Write a note"} onPress={() => { if (search || activeTag) { setSearch(""); setActiveTag(""); } else router.push({ pathname: "/modal/quick-add", params: { mode: "note" } }); }} /> : notes.map(note => <Pressable key={note.id} accessibilityRole="button" accessibilityLabel={`Edit note: ${note.title}`} onPress={() => router.push(`/notes/${note.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      <GlassCard>
        <AppText variant="cardTitle">{note.title}</AppText>
        <AppText muted numberOfLines={4}>{note.content}</AppText>
        {note.tags ? <View style={styles.row}>{[...new Set(note.tags.split(",").map(tag => tag.trim()).filter(Boolean))].map(tag => <Badge key={tag} label={`#${tag}`} />)}</View> : null}
        <AppText variant="meta" muted>Edited {formatRelativePast(note.updated_at)}</AppText>
      </GlassCard>
    </Pressable>)}
    {!error && hasNextPage ? <LoadMoreButton busy={isFetchingNextPage} onPress={() => void fetchNextPage()} /> : null}
  </Screen>;
}
