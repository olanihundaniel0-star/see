import { useDeferredValue, useMemo, useState } from "react";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { GlassCard } from "@/components/glass/GlassCard";
import { GlassPill } from "@/components/glass/GlassPill";
import { AsciiBanner } from "@/components/ui/AsciiBanner";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import { ScreenState } from "@/components/ui/ScreenState";
import { theme } from "@/constants/theme";
import { formatShortDateTime } from "@/lib/format";
import { Note, useDeleteNote, useInfiniteNotes } from "@/lib/queries";

function noteSnippet(note: Note) {
  return note.content.length > 180 ? `${note.content.slice(0, 180).trimEnd()}…` : note.content;
}

export default function NotesScreen() {
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string>("ALL");
  const deferredSearch = useDeferredValue(search);
  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteNotes(deferredSearch.trim() || undefined, activeTag === "ALL" ? undefined : activeTag);
  const deleteNote = useDeleteNote();

  const notes = useMemo(() => data?.pages.flatMap((page) => page) ?? [], [data]);

  const tags = useMemo(() => {
    const values = new Set<string>(["ALL"]);
    for (const note of notes) {
      for (const tag of note.tags?.split(",") ?? []) {
        const value = tag.trim();
        if (value) {
          values.add(value);
        }
      }
    }
    return Array.from(values);
  }, [notes]);

  const filteredNotes = notes;

  return (
    <ScrollView className="flex-1 bg-black" contentContainerClassName="px-4 pb-28 pt-4">
      <View className="gap-4">
        <AsciiBanner title={theme.ascii.vault} subtitle="Searchable markdown snippets and scratch notes" right={isLoading ? "[INDEXING]" : "[VAULT]"} />

        <GlassCard className="gap-3">
          <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">&gt; grep search notes...</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="search notes..."
            placeholderTextColor="#52525B"
            className="font-mono text-base text-white"
          />
        </GlassCard>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {tags.map((tag) => {
            const active = tag === activeTag;
            return (
              <Pressable
                key={tag}
                onPress={async () => {
                  await Haptics.selectionAsync();
                  setActiveTag(tag);
                }}
                className={`rounded-lg border px-3 py-2 ${active ? "border-white/20 bg-zinc-900/70" : "border-white/10 bg-zinc-950/50"}`}
              >
                <Text className="font-mono text-[10px] tracking-[0.16em] text-white">{tag}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {error ? (
          <ScreenState
            title="// VAULT_ERROR"
            message="Unable to load notes."
            label="[ RETRY ]"
            onPress={() => void refetch()}
          />
        ) : null}

        {!error && isLoading ? <ScreenState title="// VAULT_BOOT" message="Indexing stored notes." /> : null}

        <View className="gap-3">
          {!error && !isLoading
            ? filteredNotes.map((note) => {
                const noteTags = note.tags?.split(",").map((tag) => tag.trim()).filter(Boolean) ?? [];

                return (
                  <GlassCard key={note.id} className="gap-3">
                    <Pressable
                      onPress={() => router.push(`/notes/${note.id}`)}
                      className="gap-3"
                    >
                      <View className="gap-1">
                        <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">
                          {formatShortDateTime(note.updated_at)}
                        </Text>
                        <Text className="text-xl font-bold text-white">{note.title}</Text>
                      </View>

                      <View className="rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-3">
                        <Text className="font-mono text-[11px] leading-5 text-zinc-200">{noteSnippet(note)}</Text>
                      </View>
                    </Pressable>

                    <View className="flex-row flex-wrap gap-2">
                      {noteTags.length ? (
                        noteTags.slice(0, 4).map((tag) => <GlassPill key={tag} label="TAG" value={tag} />)
                      ) : (
                        <GlassPill label="TAG" value="UNTAGGED" />
                      )}
                    </View>

                    <View className="flex-row gap-2">
                      <GlassPill label="CREATED" value={formatShortDateTime(note.created_at)} className="flex-1" />
                      <Pressable
                        disabled={deleteNote.isPending}
                        onPress={async () => {
                          await Haptics.selectionAsync();
                          Alert.alert("Delete note?", note.title, [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Delete",
                              style: "destructive",
                              onPress: () => {
                                void deleteNote.mutateAsync(note.id);
                              }
                            }
                          ]);
                        }}
                        className="rounded-lg border border-white/20 bg-white px-3 py-2 disabled:opacity-60"
                      >
                        <Text className="font-mono text-[10px] font-bold text-black">[DELETE]</Text>
                      </Pressable>
                    </View>
                  </GlassCard>
                );
              })
            : null}
        </View>

        {!error && !isLoading && !filteredNotes.length ? (
          <ScreenState title="// EMPTY_VAULT" message="No notes match the current search." />
        ) : null}

        {!error && hasNextPage ? <LoadMoreButton onPress={() => void fetchNextPage()} busy={isFetchingNextPage} /> : null}
      </View>
    </ScrollView>
  );
}
