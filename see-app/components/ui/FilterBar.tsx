import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

/** A bounded horizontal row: result-list height must never resize its chips. */
export function FilterBar({ children, label }: { children: ReactNode; label: string }) {
  return <View style={styles.container}>
    <ScrollView horizontal accessibilityLabel={label} showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled" nestedScrollEnabled directionalLockEnabled
      contentInsetAdjustmentBehavior="never" style={styles.scroll} contentContainerStyle={styles.content}>
      {children}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  container: { width: "100%", minWidth: 0, flexGrow: 0, flexShrink: 0 },
  scroll: { width: "100%", flexGrow: 0, flexShrink: 0 },
  content: { flexDirection: "row", alignItems: "center", flexGrow: 0, gap: 8, paddingVertical: 2 }
});
