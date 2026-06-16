/**
 * DaemonStatusBadge.tsx
 *
 * A subtle Android-only status dot showing daemon health.
 * Invisible when running normally. Shows progress during first setup.
 */
import * as React from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { useDaemonStatus, isDaemonReady } from "@/daemon";

export function DaemonStatusBadge() {
  const status = useDaemonStatus();

  if (Platform.OS !== "android") return null;

  if (isDaemonReady(status)) return null;

  if (status.status === "stopped") return null;

  const label =
    status.status === "setting_up"
      ? `Setting up AI… ${status.setupProgress}%`
      : status.status === "restarting"
        ? "AI restarting…"
        : status.status === "error"
          ? "AI error — tap to retry"
          : "AI starting…";

  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color="#0A84FF" style={styles.spinner} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(10, 132, 255, 0.12)",
    borderRadius: 8,
    margin: 8,
  },
  spinner: {
    marginRight: 8,
  },
  label: {
    fontSize: 13,
    color: "#0A84FF",
    fontWeight: "500",
  },
});
