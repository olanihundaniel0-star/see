import { Button } from "./primitives";
export function LoadMoreButton({ onPress, busy, label = "Load more" }: { onPress: () => void; busy?: boolean; label?: string }) {
  return <Button onPress={onPress} busy={busy} label={busy ? "Loading…" : label} variant="secondary" />;
}
