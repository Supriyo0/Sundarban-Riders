import { Capacitor, registerPlugin } from "@capacitor/core";

export interface OverlayLauncherPlugin {
  canDrawOverlays(): Promise<{ granted: boolean }>;
  requestOverlayPermission(): Promise<void>;
  bringToForeground(): Promise<void>;
  startBookingService(options?: { driverPhone?: string; apiBaseUrl?: string }): Promise<{ success: boolean }>;
  stopBookingService(): Promise<{ success: boolean }>;
  getPendingBooking(): Promise<{ bookingId: string }>;
  clearPendingBooking(): Promise<void>;
}

export const OverlayLauncher = registerPlugin<OverlayLauncherPlugin>("OverlayLauncher", {
  web: {
    canDrawOverlays: async () => ({ granted: true }),
    requestOverlayPermission: async () => {},
    bringToForeground: async () => {},
    startBookingService: async () => ({ success: true }),
    stopBookingService: async () => ({ success: true }),
    getPendingBooking: async () => ({ bookingId: "" }),
    clearPendingBooking: async () => {},
  },
});

function getNativeBridge(): any {
  if (typeof window === "undefined") return null;
  return (window as any).AndroidNative || (window as any).OverlayLauncher || null;
}

/**
 * Checks if the Android app has "Display over other apps" (SYSTEM_ALERT_WINDOW) permission.
 */
export async function checkOverlayPermission(): Promise<boolean> {
  const bridge = getNativeBridge();
  if (bridge?.canDrawOverlays) {
    try {
      return Boolean(bridge.canDrawOverlays());
    } catch {
      return true;
    }
  }
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await OverlayLauncher.canDrawOverlays();
      return !!res?.granted;
    } catch {
      return true;
    }
  }
  return true;
}

/**
 * Opens native Android Settings page to enable "Display over other apps".
 */
export async function requestOverlayPermission(): Promise<void> {
  const bridge = getNativeBridge();
  if (bridge?.requestOverlayPermission) {
    try {
      bridge.requestOverlayPermission();
      return;
    } catch {}
  }
  if (Capacitor.isNativePlatform()) {
    try {
      await OverlayLauncher.requestOverlayPermission();
    } catch {}
  }
}

/**
 * Wakes up the app and brings it to foreground over whatever app the driver is using.
 */
export async function bringAppToForeground(): Promise<void> {
  const bridge = getNativeBridge();
  if (bridge?.bringToForeground) {
    try {
      bridge.bringToForeground();
      return;
    } catch {}
  }
  if (Capacitor.isNativePlatform()) {
    try {
      await OverlayLauncher.bringToForeground();
    } catch {}
  }
}

/**
 * Starts the native Android Foreground Service for polling incoming ride requests
 * when the app is minimized or the screen is turned off.
 */
export async function startNativeBookingService(driverPhone?: string): Promise<void> {
  let apiBaseUrl = "https://sundarbanrider.in";
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

  const bridge = getNativeBridge();
  if (bridge?.startBookingService) {
    try {
      bridge.startBookingService(driverPhone || "", apiBaseUrl);
      return;
    } catch (e) {
      console.warn("[Bridge] startBookingService error:", e);
    }
  }

  if (Capacitor.isNativePlatform()) {
    try {
      await OverlayLauncher.startBookingService({ driverPhone, apiBaseUrl });
    } catch (err) {
      console.warn("[OverlayLauncher] startBookingService error:", err);
    }
  }
}

/**
 * Stops the native Android Foreground Service when the driver goes offline.
 */
export async function stopNativeBookingService(): Promise<void> {
  const bridge = getNativeBridge();
  if (bridge?.stopBookingService) {
    try {
      bridge.stopBookingService();
      return;
    } catch {}
  }

  if (Capacitor.isNativePlatform()) {
    try {
      await OverlayLauncher.stopBookingService();
    } catch {}
  }
}

/**
 * Clears the pending booking in native storage after web UI has handled it.
 */
export async function clearPendingBooking(): Promise<void> {
  const bridge = getNativeBridge();
  if (bridge?.clearPendingBooking) {
    try {
      bridge.clearPendingBooking();
      return;
    } catch {}
  }

  if (Capacitor.isNativePlatform()) {
    try {
      await OverlayLauncher.clearPendingBooking();
    } catch {}
  }
}
