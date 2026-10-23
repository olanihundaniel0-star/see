import { View } from "react-native";
import { AppText, Button } from "./primitives";

/** Background refresh failures must not remove useful cached content. */
export function QueryFeedback({ refreshing, error, hasData, onRetry }: {
  refreshing: boolean; error: unknown; hasData: boolean; onRetry: () => void;
}) {
  if (!hasData || (!refreshing && !error)) return null;
  return <View style={{ gap: 8 }} accessibilityLiveRegion="polite">
    <AppText variant="meta" muted>{refreshing ? "Showing saved data · Updating…" : "Couldn’t refresh. Showing your last saved data."}</AppText>
    {error && !refreshing ? <Button label="Retry refresh" variant="ghost" onPress={onRetry} style={{ alignSelf: "flex-start" }} /> : null}
  </View>;
}
