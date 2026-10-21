import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { isAxiosError } from "axios";
import { api } from "@/lib/api";

type PendingNotification = { id: string; send_at: string; body: string; route: string; source: string };

let currentUser: string | null = null;
export function setNotificationUser(userId: string | null) { currentUser = userId; }

export function notificationRoute(data: Record<string, unknown>, userId: string) {
  if (data.user_id !== userId || typeof data.route !== "string") return null;
  return /^\/(jobs|reminders)\/[0-9a-f-]{36}$/.test(data.route) || ["/(tabs)", "/(tabs)/events"].includes(data.route) ? data.route : null;
}

Notifications.setNotificationHandler({ handleNotification: async notification => {
  const allowed = !!currentUser && notification.request.content.data?.user_id === currentUser;
  return { shouldShowBanner: allowed, shouldShowList: allowed, shouldPlaySound: allowed, shouldSetBadge: false };
} });

function deviceKey(userId: string) { return `see-device-${userId}`; }

export async function registerNotifications(userId: string, ask = false) {
  if (Platform.OS === "web") throw new Error("Notifications require the Android or iOS app.");
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("commitments", {
    name: "Commitments", importance: Notifications.AndroidImportance.DEFAULT, sound: "default"
  });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && ask) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) {
    if (ask) throw new Error("Enable notifications in device settings to receive alerts.");
    return false;
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error("Missing EAS project ID for push registration.");
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  if (currentUser !== userId) return false;
  const { data } = await api.post<{ id: string }>("/notifications/devices", {
    token,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  });
  if (currentUser === userId) await SecureStore.setItemAsync(deviceKey(userId), data.id);
  return true;
}

export async function cancelLocalNotifications() {
  if (Platform.OS !== "web") {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync();
  }
}

export async function unregisterNotifications(userId: string) {
  if (Platform.OS === "web") return;
  const id = await SecureStore.getItemAsync(deviceKey(userId));
  try {
    // Explicit sign-out waits for server revocation; failed revocation is surfaced to the user.
    if (id) await api.delete(`/notifications/devices/${id}`);
  } finally {
    await cancelLocalNotifications();
    await SecureStore.deleteItemAsync(deviceKey(userId));
  }
}

async function pendingNotifications() {
  return (await api.get<PendingNotification[]>("/notifications")).data;
}

async function scheduleLocal(userId: string, deviceId: string, item: PendingNotification) {
  const localId = await Notifications.scheduleNotificationAsync({
    identifier: item.id,
    content: {
      title: "SEE",
      body: item.body,
      sound: "default",
      data: { notification_id: item.id, user_id: userId, route: item.route }
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(item.send_at), channelId: "commitments" }
  });
  try {
    await api.post(`/notifications/${item.id}/local`, { device_id: deviceId });
  } catch (error) {
    // A device that already owns the local delivery keeps its schedule; any
    // other claim failure means the server push path must remain available.
    const detail = isAxiosError(error) ? String(error.response?.data?.detail ?? "") : "";
    if (!detail.includes("already assigned")) await Notifications.cancelScheduledNotificationAsync(localId);
    if (!detail.includes("already assigned")) throw error;
  }
}

export async function syncLocalNotifications(userId: string) {
  if (Platform.OS === "web" || currentUser !== userId) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  const deviceId = await SecureStore.getItemAsync(deviceKey(userId));
  if (!deviceId) return;
  const pending = await pendingNotifications();
  const active = new Set(pending.map(n => n.id));
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const scheduled = new Set(existing.map(n => n.identifier));
  await Promise.all(
    existing
      .filter(n => !active.has(n.identifier) || n.content.data?.user_id !== userId)
      .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
  const now = Date.now();
  const future = pending
    .filter(n => !scheduled.has(n.id) && new Date(n.send_at).getTime() > now + 65_000)
    .slice(0, 50);
  for (const item of future) await scheduleLocal(userId, deviceId, item);
}


export async function snoozeNotification(id: string, userId: string, minutes = 15) {
  const { data } = await api.post<{ id: string; send_at: string; body: string; route: string }>(`/notifications/${id}/snooze`, { minutes });
  if (Platform.OS === "web" || currentUser !== userId) return;
  const deviceId = await SecureStore.getItemAsync(deviceKey(userId));
  if (!deviceId || !(await Notifications.getPermissionsAsync()).granted) return;
  // Only explicit device snoozes use OS scheduling. Ordinary alerts are
  // server-driven, so completing or deleting an item cancels them everywhere.
  await scheduleLocal(userId, deviceId, { ...data, source: "snooze" });
}
