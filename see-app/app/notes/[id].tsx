import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import { GlassCard } from "@/components/glass/GlassCard";
import { GlassInput } from "@/components/glass/GlassInput";
import { AsciiBanner } from "@/components/ui/AsciiBanner";
import { ScreenState } from "@/components/ui/ScreenState";
import { theme } from "@/constants/theme";
import { formatRelativePast } from "@/lib/format";
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
      <ScrollView removeClippedSubviews className="flex-1 bg-black" contentContainerClassName="px-4 pb-28 pt-4">
        <View className="gap-3">
          <AsciiBanner title={theme.ascii.vault} subtitle="Editable note record" right="[NOTE]" />

          {error ? (
            <ScreenState title="// NOTE_ERROR" message="Unable to load this note." label="[ RETRY ]" onPress={() => void refetch()} />
          ) : null}

          {!error && isLoading ? <ScreenState title="// NOTE_BOOT" message="Loading note record." /> : null}

          {note ? (
            <>
              <GlassCard className="gap-3" style={{ padding: 12 }}>
                <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">
                  {"// UPDATED: "}
                  {formatRelativePast(note.updated_at)}
                </Text>
                <GlassInput
                  label="> TITLE [REQ]"
                  value={title}
                  onChangeText={setTitle}
                  maxLength={255}
                  className="border-white/[0.12] bg-[rgba(9,9,11,0.70)]"
                />
                <View className="gap-2">
                  <Text className="px-1 font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">{"> CONTENT [REQ]"}</Text>
                  <TextInput
                    multiline
                    value={content}
                    onChangeText={setContent}
                    maxLength={20000}
                    className="min-h-[220px] rounded border border-white/[0.12] bg-[rgba(9,9,11,0.70)] px-3 py-3 font-mono text-sm text-white"
                    textAlignVertical="top"
                    placeholderTextColor="#52525B"
                  />
                </View>
                <GlassInput
                  label="> TAGS [OPT]"
                  value={tags}
                  onChangeText={setTags}
                  placeholder="comma,separated,tags"
                  maxLength={255}
                  className="border-white/[0.12] bg-[rgba(9,9,11,0.70)]"
                />
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
                    className="flex-1 rounded border-0 bg-white px-3 py-3 disabled:opacity-60 active:scale-[0.98]"
                  >
                    <Text className="text-center font-mono-bold text-[10px] tracking-[0.08em] text-black">
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
                    className="rounded border border-white/[0.10] bg-transparent px-3 py-3 disabled:opacity-60 active:scale-95"
                  >
                    <Text className="text-center font-mono text-[10px] tracking-[0.08em] text-white">[DELETE]</Text>
                  </Pressable>
                </View>
              </GlassCard>

              <GlassCard className="gap-2" style={{ padding: 12 }}>
                <View className="flex-row items-center justify-between">
                  <Text className="font-mono text-[10px] tracking-[0.08em] text-[#8f9194]">{"// PREVIEW"}</Text>
                  <Text className="font-mono text-[10px] tracking-[0.08em] text-white">TXT_BUF</Text>
                </View>
                <Text className="font-mono text-[11px] leading-5 text-[#e2e2e2]">{content}</Text>
              </GlassCard>
            </>
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}
