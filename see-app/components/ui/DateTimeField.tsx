import { createElement, useState } from "react";
import { Keyboard, Modal, Platform, Pressable, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { theme } from "@/constants/theme";
import { pickerDate, pickerValue, toDateTimeInput, type PickerMode } from "@/lib/datetime";
import { AppText, Button, Icon, styles } from "./primitives";

type Props = {
  label: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  required?: boolean;
  variant?: "default" | "sheet";
  mode?: PickerMode;
  hourOnly?: boolean;
  disabled?: boolean;
};
function nextHour() {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return date;
}
export function DateTimeField({ label, value, onChange, required = false, mode = "datetime", hourOnly = false, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(nextHour);
  const selected = pickerDate(value, mode);
  const commit = (date: Date) => onChange(pickerValue(date, mode, hourOnly));
  const display = selected ? mode === "time"
    ? pickerValue(selected, "time", hourOnly)
    : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", ...(mode === "datetime" ? { hour: "2-digit", minute: "2-digit", hour12: false } as const : {}) }).format(selected) : "";
  const showPicker = () => {
    Keyboard.dismiss();
    const base = selected ?? nextHour();
    setDraft(base);
    if (Platform.OS !== "android") { setOpen(true); return; }
    const chooseTime = (day: Date) => DateTimePickerAndroid.open({
      value: day, mode: "time", display: "clock", is24Hour: true,
      onChange: (event, time) => {
        if (event.type !== "set" || !time) return;
        const next = new Date(day);
        next.setHours(time.getHours(), hourOnly ? 0 : time.getMinutes(), 0, 0);
        commit(next);
      }
    });
    if (mode === "time") { chooseTime(base); return; }
    DateTimePickerAndroid.open({
      value: base, mode: "date", display: "calendar",
      onChange: (event, date) => {
        if (event.type !== "set" || !date) return;
        const day = new Date(base);
        day.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
        if (mode === "date") commit(day);
        else chooseTime(day); // Commit only after both steps; cancelling leaves the field unchanged.
      }
    });
  };
  return <View style={{ gap: 8 }}>
    <AppText variant="label">{label}{required ? " *" : ""}</AppText>
    {Platform.OS === "web" ? createElement("input", {
      type: mode === "datetime" ? "datetime-local" : mode,
      "aria-label": label, required, disabled,
      value: selected ? mode === "datetime" ? toDateTimeInput(value) : pickerValue(selected, mode, hourOnly) : "",
      step: hourOnly ? 3600 : mode === "date" ? undefined : 60,
      onChange: (event: { target: { value: string } }) => {
        const raw = event.target.value;
        if (!raw) { if (!required) onChange(""); return; }
        const next = pickerDate(raw, mode);
        if (next) commit(next);
      },
      style: { boxSizing: "border-box", colorScheme: "dark", width: "100%", minWidth: 0, minHeight: 48, padding: 12, border: `1px solid ${theme.colors.outlineVariant}`, borderRadius: 4, background: theme.colors.surfaceLowest, color: theme.colors.text, font: "inherit", fontSize: 16 }
    }) : <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${display || "not set"}`} accessibilityState={{ disabled }} disabled={disabled} onPress={showPicker}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, padding: 12, borderWidth: 1, borderColor: theme.colors.borderInput, borderRadius: 4, backgroundColor: theme.colors.surfaceLowest, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 })}>
      <Icon name={mode === "time" ? "clock" : "calendar"} color={theme.colors.onSurfaceVariant} />
      <AppText muted={!selected} style={{ flex: 1 }}>{display || (mode === "time" ? "Select time" : mode === "date" ? "Select date" : "Select date and time")}</AppText>
      <Icon name="chevron-down" size={16} />
    </Pressable>}
    {!required && !!selected ? <Button label={`Clear ${label.toLowerCase()}`} variant="ghost" disabled={disabled} onPress={() => onChange("")} style={{ alignSelf: "flex-start", paddingHorizontal: 0 }} /> : null}
    {hourOnly ? <AppText variant="meta" muted>Scheduled on the hour.</AppText> : null}
    {Platform.OS === "ios" ? <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, justifyContent: "center", padding: 16, backgroundColor: theme.colors.scrim }}>
        <Pressable accessibilityLabel="Cancel date selection" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }} onPress={() => setOpen(false)} />
        <View accessibilityViewIsModal style={{ padding: 16, gap: 16, backgroundColor: theme.colors.surface, borderRadius: 12, width: "100%", maxWidth: 440, alignSelf: "center" }}>
          <AppText variant="heading">{label}</AppText>
          <DateTimePicker value={draft} mode={mode === "time" ? "time" : "date"} display={mode === "time" ? "spinner" : "inline"} themeVariant="dark" locale="en_GB" onChange={(_event, date) => { if (date) setDraft(date); }} />
          {mode === "datetime" ? <DateTimePicker value={draft} mode="time" display="compact" themeVariant="dark" locale="en_GB" onChange={(_event, date) => { if (date) setDraft(date); }} /> : null}
          <View style={styles.row}><Button label="Cancel" variant="secondary" onPress={() => setOpen(false)} style={{ flex: 1 }} /><Button label="Set" onPress={() => { commit(draft); setOpen(false); }} style={{ flex: 1 }} /></View>
        </View>
      </View>
    </Modal> : null}
  </View>;
}
