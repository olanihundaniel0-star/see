import { router } from "expo-router";
import { Screen, ScreenHeader } from "@/components/ui/primitives";
import { ScreenState } from "@/components/ui/ScreenState";
export default function NotFound() {
  return <Screen><ScreenHeader title="Page not found" account={false} /><ScreenState title="This page isn’t here" message="It may have moved, or the link may be out of date." label="Go to Today" onPress={() => router.replace("/")} /></Screen>;
}
