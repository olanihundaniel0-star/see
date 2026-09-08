import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import { GlassCard } from "@/components/glass/GlassCard";
import { GlassInput } from "@/components/glass/GlassInput";
import { AsciiBanner } from "@/components/ui/AsciiBanner";
import { ScreenState } from "@/components/ui/ScreenState";
import { theme } from "@/constants/theme";
import { formatShortDateTime } from "@/lib/format";
import { useDeleteNote, useNote, useUpdateNote } from "@/lib/queries";

export default function NoteDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const noteId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : undefined;
  const { data: note, isLoading, error, refetch } = useNote(noteId);
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setTags(note.tags ?? "");
    }
  }, [note]);

  return (
    <>
      <Stack.Screen options={{ title: "Note Detail" }} />
      <ScrollView className="flex-1 bg-black" contentContainerClassName="px-4 pb-28 pt-4">
        <View className="gap-4">
          <AsciiBanner title={theme.ascii.vault} subtitle="Editable note record" right="[NOTE]" />

          {error ? (
            <ScreenState title="// NOTE_ERROR" message="Unable to load this note." label="[ RETRY ]" onPress={() => void refetch()} />
          ) : null}

          {!error && isLoading ? <ScreenState title="// NOTE_BOOT" message="Loading note record." /> : null}

          {note ? (
            <>
              <GlassCard className="gap-3">
                <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">{formatShortDateTime(note.updated_at)}</Text>
                <GlassInput label="TITLE" value={title} onChangeText={setTitle} />
                <View className="gap-2">
                  <Text className="px-1 font-mono text-[10px] tracking-[0.18em] text-zinc-500">CONTENT</Text>
                  <TextInput
                    multiline
                    value={content}
                    onChangeText={setContent}
                    className="min-h-[220px] rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-3 font-mono text-sm text-white"
                    textAlignVertical="top"
                    placeholderTextColor="#52525B"
                  />
                </View>
                <GlassInput label="TAGS" value={tags} onChangeText={setTags} placeholder="comma,separated,tags" />
                <View className="flex-row gap-2">
                  <Pressable
                    disabled={updateNote.isPending || !title.trim() || !content.trim()}
                    onPress={async () => {
                      await Haptics.selectionAsync();
                      await updateNote.mutateAsync({
                        id: note.id,
                        data: { title: title.trim(), content: content.trim(), tags: tags.trim() || null }
                      });
                    }}
                    className="flex-1 rounded-lg border border-white/20 bg-white px-3 py-3 disabled:opacity-60"
                  >
                    <Text className="text-center font-mono text-[10px] font-bold text-black">
                      {updateNote.isPending ? "[SAVING]" : "[SAVE NOTE]"}
                    </Text>
                  </Pressable>
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
                            void deleteNote.mutateAsync(note.id).then(() => router.back());
                          }
                        }
                      ]);
                    }}
                    className="rounded-lg border border-white/20 bg-zinc-950/70 px-3 py-3 disabled:opacity-60"
                  >
                    <Text className="text-center font-mono text-[10px] text-white">[DELETE]</Text>
                  </Pressable>
                </View>
              </GlassCard>

              <GlassCard className="gap-2">
                <Text className="font-mono text-[10px] tracking-[0.18em] text-zinc-500">// PREVIEW</Text>
                <Text className="font-mono text-[11px] leading-5 text-zinc-300">{content}</Text>
              </GlassCard>
            </>
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}
