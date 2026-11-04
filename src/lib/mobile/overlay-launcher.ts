import { Capacitor, registerPlugin } from "@capacitor/core";

export interface OverlayLauncherPlugin {
  canDrawOverlays(): Promise<{ granted: boolean }>;
  requestOverlayPermission(): Promise<void>;
  bringToForeground(): Promise<void>;
}

export const OverlayLauncher = registerPlugin<OverlayLauncherPlugin>("OverlayLauncher", {
  web: {
    canDrawOverlays: async () => ({ granted: true }),
    requestOverlayPermission: async () => {},
    bringToForeground: async () => {},
  },
});

/**
 * Checks if the Android app has "Display over other apps" (SYSTEM_ALERT_WINDOW) permission.
 */
export async function checkOverlayPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const res = await OverlayLauncher.canDrawOverlays();
    return !!res?.granted;
  } catch (err) {
    console.warn("[OverlayLauncher] check error:", err);
    return true;
  }
}

/**
 * Opens native Android Settings page to enable "Display over other apps".
 */
export async function requestOverlayPermission(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await OverlayLauncher.requestOverlayPermission();
  } catch (err) {
    console.warn("[OverlayLauncher] request error:", err);
  }
}

/**
 * Wakes up the app and brings it to foreground over whatever app the driver is using.
 */
export async function bringAppToForeground(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await OverlayLauncher.bringToForeground();
  } catch (err) {
    console.warn("[OverlayLauncher] bringToForeground error:", err);
  }
}

