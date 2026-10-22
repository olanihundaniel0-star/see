import { View } from "react-native";
import { AppText, Button, Icon } from "./primitives";
import { LoadingSkeleton } from "./LoadingSkeleton";
type Props = { title: string; message: string; label?: string; onPress?: () => void; busy?: boolean; loading?: boolean };
export function ScreenState({ title, message, label, onPress, busy, loading }: Props) {
  if (loading) return <LoadingSkeleton />;
  return <View style={{ gap: 12, paddingVertical: 24 }} accessibilityLiveRegion="polite">
    <Icon name={onPress ? "info" : "inbox"} size={24} />
    <AppText variant="heading">{title}</AppText><AppText muted>{message}</AppText>
    {label && onPress ? <Button label={label} onPress={onPress} busy={busy} variant="secondary" style={{ alignSelf: "flex-start" }} /> : null}
  </View>;
}
