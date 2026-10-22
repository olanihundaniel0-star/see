import { Alert } from "react-native";
import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";

/** Covers header, system Back, modal dismissal and interactive navigation. */
export function useUnsavedChanges(dirty: boolean, busy = false) {
  const navigation = useNavigation();
  usePreventRemove(dirty || busy, ({ data }) => {
    if (busy) {
      Alert.alert("Saving your changes", "Please wait for this save to finish.");
      return;
    }
    Alert.alert("Discard unsaved changes?", "Your changes haven’t been saved yet.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(data.action) }
    ]);
  });
}
