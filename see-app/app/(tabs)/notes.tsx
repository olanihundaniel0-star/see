import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { GlassCard } from "@/components/glass/GlassCard";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import { ScreenState } from "@/components/ui/ScreenState";
import { formatRelativePast } from "@/lib/format";
import { Note, useDeleteNote, useInfiniteNotes } from "@/lib/queries";

function noteSnippet(note: Note) {
  return note.content.length > 180 ? `${note.content.slice(0, 180).trimEnd()}…` : note.content;
}

function noteSlug(title: string) {
  const slug = title
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  return slug || "UNTITLED";
}

function noteBadge(tags: string[]) {
  if (tags.some((tag) => tag.toLowerCase() === "critical")) {
    return "[CRITICAL]";
  }
  if (tags.length) {
    return `[${tags[0].toUpperCase().slice(0, 12)}]`;
  }
  return "[NOTE]";
}

function syncBlocks(count: number) {
  const filled = count <= 0 ? 0 : Math.min(4, Math.max(1, Math.ceil(count / 5)));
  return "■".repeat(filled) + "□".repeat(4 - filled);
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

  const [knownTags, setKnownTags] = useState<string[]>(["ALL"]);
  useEffect(() => {
    setKnownTags((current) => {
      const values = new Set(current);
      for (const note of notes) {
        for (const tag of note.tags?.split(",") ?? []) {
          const value = tag.trim();
          if (value) {
            values.add(value);
          }
        }
      }
      return values.size === current.length ? current : Array.from(values);
    });
  }, [notes]);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    counts.set("ALL", notes.length);
    for (const note of notes) {
      for (const tag of note.tags?.split(",") ?? []) {
        const value = tag.trim();
        if (value) {
          counts.set(value, (counts.get(value) ?? 0) + 1);
        }
      }
    }
    return counts;
  }, [notes]);

  const tags = useMemo(
    () => ["ALL", ...knownTags.filter((tag) => tag !== "ALL").sort((a, b) => (tagCounts.get(b) ?? 0) - (tagCounts.get(a) ?? 0))],
    [knownTags, tagCounts]
  );

  const filteredNotes = notes;

  return (
    <ScrollView removeClippedSubviews className="flex-1 bg-black" contentContainerClassName="px-4 pb-28 pt-4">
      <View className="gap-3">
        <View className="flex-row items-center justify-between px-1">
          <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">
            <Text className="font-mono-bold text-white">{"// KNOWLEDGE_VAULT"}</Text>
            {" :: INDEX"}
          </Text>
          <View className="rounded border border-white/[0.08] bg-[#2a2a2a] px-2 py-1">
            <Text className="font-mono text-[10px] tracking-[0.08em] text-white">
              [{syncBlocks(notes.length)}] {notes.length} SYNC
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2 rounded border border-white/[0.12] bg-[rgba(9,9,11,0.70)] px-3 py-3">
          <Text className="font-mono-bold text-sm text-white">&gt;</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="grep search notes..."
            maxLength={500}
            placeholderTextColor="#52525B"
            className="flex-1 font-mono text-sm text-white"
          />
          <View className="h-4 w-2 shrink-0 bg-white/80" />
          <Pressable
            onPress={async () => {
              await Haptics.selectionAsync();
              setSearch("");
            }}
            className="shrink-0 rounded border border-white/[0.08] bg-[#2a2a2a] px-2 py-1 active:scale-95"
          >
            <Text className="font-mono text-[10px] tracking-[0.08em] text-white">[ESC]</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {tags.map((tag) => {
            const active = tag === activeTag;
            const count = tagCounts.get(tag) ?? 0;
            return (
              <Pressable
                key={tag}
                onPress={async () => {
                  await Haptics.selectionAsync();
                  setActiveTag(tag);
                }}
                className={`rounded border px-3 py-2 active:scale-95 ${
                  active ? "border-transparent bg-white" : "border-white/[0.08] bg-[#1f1f1f]"
                }`}
              >
                <Text className={`font-mono text-[10px] tracking-[0.08em] ${active ? "font-mono-bold text-black" : "text-white"}`}>
                  #{tag.toLowerCase()} ({count})
                </Text>
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
                  <GlassCard key={note.id} className="gap-3" style={{ padding: 12 }}>
                    <Pressable onPress={() => router.push(`/notes/${note.id}`)} className="gap-3">
                      <View className="flex-row items-center justify-between gap-2">
                        <Text className="font-mono-bold flex-1 text-[10px] tracking-[0.08em] text-white" numberOfLines={1}>
                          {`+-- NOTE: ${noteSlug(note.title)} --+`}
                        </Text>
                        <View className="shrink-0 rounded border border-white/[0.08] bg-[#353535] px-2 py-1">
                          <Text className="font-mono text-[10px] tracking-[0.08em] text-white">{noteBadge(noteTags)}</Text>
                        </View>
                      </View>

                      <Text className="text-xl font-sans-bold text-white">{note.title}</Text>

                      <View className="gap-2 rounded border border-white/[0.08] bg-[#0e0e0e] px-3 py-3">
                        <View className="flex-row items-center justify-between">
                          <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">{"// NOTE_BUFFER"}</Text>
                          <Text className="font-mono text-[10px] tracking-[0.08em] text-white">TXT_BUF</Text>
                        </View>
                        <Text className="font-mono text-[11px] leading-5 text-zinc-200">{noteSnippet(note)}</Text>
                      </View>
                    </Pressable>

                    <View className="flex-row flex-wrap gap-2">
                      {noteTags.length ? (
                        noteTags.slice(0, 4).map((tag) => (
                          <View key={tag} className="rounded border border-white/[0.08] bg-[#2a2a2a] px-2 py-1">
                            <Text className="font-mono text-[10px] tracking-[0.08em] text-white">#{tag}</Text>
                          </View>
                        ))
                      ) : (
                        <View className="rounded border border-white/[0.08] bg-[#2a2a2a] px-2 py-1">
                          <Text className="font-mono text-[10px] tracking-[0.08em] text-white">#untagged</Text>
                        </View>
                      )}
                    </View>

                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">
                        {"// UPDATED: "}
                        {formatRelativePast(note.updated_at)}
                      </Text>
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
                        className="rounded border border-white/[0.10] bg-transparent px-3 py-2 disabled:opacity-60 active:scale-95"
                      >
                        <Text className="font-mono text-[10px] tracking-[0.08em] text-white">[DELETE]</Text>
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
