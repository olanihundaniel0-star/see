import { useEffect } from "react";
import { Alert, AppState, Platform } from "react-native";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { cancelLocalNotifications, notificationRoute, registerNotifications, setNotificationUser, syncLocalNotifications } from "@/lib/notifications";

export function NotificationBridge({ userId }: { userId: string | null }) {
  useEffect(() => {
    setNotificationUser(userId);
    if (Platform.OS === "web") return;
    if (!userId) { void cancelLocalNotifications().catch(error => console.warn("Local alert cleanup failed", error.message)); return; }
    let active = true;
    const sync = async () => {
      try {
        await registerNotifications(userId);
        if (active) await syncLocalNotifications(userId);
      } catch (error) {
        console.warn("Notification synchronization needs retry", error instanceof Error ? error.message : "Unavailable");
      }
    };
    void sync();
    const foreground = AppState.addEventListener("change", state => { if (state === "active") void sync(); });
    let lastId: string | null = null;
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!active || !response || response.notification.request.identifier === lastId) return;
      const route = notificationRoute(response.notification.request.content.data ?? {}, userId);
      if (route) {
        lastId = response.notification.request.identifier;
        router.push(route as never);
        void Notifications.clearLastNotificationResponseAsync();
      }
    };
    const listener = Notifications.addNotificationResponseReceivedListener(open);
    void Notifications.getLastNotificationResponseAsync().then(open).catch(() => Alert.alert("Notification", "Open Alerts to review your commitments."));
    const tokenListener = Notifications.addPushTokenListener(() => void sync());
    return () => { active = false; foreground.remove(); listener.remove(); tokenListener.remove(); setNotificationUser(null); };
  }, [userId]);
  return null;
}
