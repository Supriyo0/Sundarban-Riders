import { Capacitor, registerPlugin } from "@capacitor/core";

export interface OverlayLauncherPlugin {
  canDrawOverlays(): Promise<{ granted: boolean }>;
  requestOverlayPermission(): Promise<void>;
  bringToForeground(): Promise<void>;
  startBookingService(options?: { driverPhone?: string; apiBaseUrl?: string }): Promise<{ success: boolean }>;
  stopBookingService(): Promise<{ success: boolean }>;
  getPendingBooking(): Promise<{ bookingId: string }>;
}

export const OverlayLauncher = registerPlugin<OverlayLauncherPlugin>("OverlayLauncher", {
  web: {
    canDrawOverlays: async () => ({ granted: true }),
    requestOverlayPermission: async () => {},
    bringToForeground: async () => {},
    startBookingService: async () => ({ success: true }),
    stopBookingService: async () => ({ success: true }),
    getPendingBooking: async () => ({ bookingId: "" }),
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

/**
 * Starts the native Android Foreground Service for polling incoming ride requests
 * when the app is minimized or the screen is turned off.
 */
export async function startNativeBookingService(driverPhone?: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    let apiBaseUrl = "https://109.122.56.24.sslip.io";
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      if (
        origin &&
        !origin.includes("localhost") &&
        !origin.includes("127.0.0.1") &&
        !origin.startsWith("capacitor://") &&
        !origin.startsWith("file://")
      ) {
        apiBaseUrl = origin;
      }
    }
    await OverlayLauncher.startBookingService({ driverPhone, apiBaseUrl });
  } catch (err) {
    console.warn("[OverlayLauncher] startBookingService error:", err);
  }
}

/**
 * Stops the native Android Foreground Service when the driver goes offline.
 */
export async function stopNativeBookingService(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await OverlayLauncher.stopBookingService();
  } catch (err) {
    console.warn("[OverlayLauncher] stopBookingService error:", err);
  }
}
