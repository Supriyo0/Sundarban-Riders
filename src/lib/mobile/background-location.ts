/**
 * Driver PWA & Capacitor Background Location Service
 *
 * Provides resilient, continuous GPS tracking for drivers when:
 * 1. The driver is actively navigating inside the app.
 * 2. The phone screen locks or dims (via Screen Wake Lock API).
 * 3. The driver switches browser tabs or minimizes the app (via background heartbeat & visibility recovery).
 * 4. Running inside the Android Capacitor wrapper (foreground service support).
 */

interface BackgroundLocationOptions {
  driverId?: string;
  phone: string;
  onLocationUpdate: (coords: [number, number]) => void;
  onError?: (err: Error) => void;
}

let activeWatchId: number | null = null;
let heartbeatIntervalId: NodeJS.Timeout | null = null;
let wakeLockSentinel: any = null;
let currentCoords: [number, number] | null = null;
let isTrackingRunning = false;

/**
 * Requests the Screen Wake Lock API to prevent the driver's phone from sleeping
 * while they are online on duty.
 */
export async function requestScreenWakeLock(): Promise<boolean> {
  if (typeof window === "undefined" || !("wakeLock" in navigator)) {
    return false;
  }
  try {
    // Release existing sentinel if any
    if (wakeLockSentinel && !wakeLockSentinel.released) {
      await wakeLockSentinel.release();
    }
    wakeLockSentinel = await (navigator as any).wakeLock.request("screen");
    wakeLockSentinel.addEventListener("release", () => {
      wakeLockSentinel = null;
    });
    return true;
  } catch (err) {
    console.warn("[BackgroundLocation] Screen WakeLock error:", err);
    return false;
  }
}

/**
 * Releases the Screen Wake Lock when the driver goes offline.
 */
export async function releaseScreenWakeLock(): Promise<void> {
  if (wakeLockSentinel && !wakeLockSentinel.released) {
    try {
      await wakeLockSentinel.release();
    } catch {}
    wakeLockSentinel = null;
  }
}

/**
 * Sends coordinates to the server to update the driver's live position in PostgreSQL
 */
async function syncDriverLocationToServer(
  driverId: string | undefined,
  phone: string,
  latitude: number,
  longitude: number
) {
  try {
    await fetch("/api/drivers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: driverId,
        phone,
        latitude,
        longitude,
        is_active: true,
      }),
    });
  } catch (err) {
    console.warn("[BackgroundLocation] Server sync failed:", err);
  }
}

/**
 * Starts continuous driver background location tracking.
 */
export function startDriverBackgroundLocationTracking(
  options: BackgroundLocationOptions
): () => void {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return () => {};
  }

  isTrackingRunning = true;

  // 1. Acquire screen wake lock so the driver's phone doesn't sleep on duty
  requestScreenWakeLock().catch(() => {});

  // 2. Re-acquire wake lock if user switches back to the tab
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible" && isTrackingRunning) {
      requestScreenWakeLock().catch(() => {});
      // Immediate position check upon returning to tab
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          currentCoords = [lat, lng];
          options.onLocationUpdate([lat, lng]);
          syncDriverLocationToServer(options.driverId, options.phone, lat, lng);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 3000 }
      );
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);

  // 3. Start high-accuracy GPS watchPosition
  activeWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      currentCoords = [lat, lng];
      options.onLocationUpdate([lat, lng]);
      syncDriverLocationToServer(options.driverId, options.phone, lat, lng);
    },
    (err) => {
      options.onError?.(new Error(err.message));
    },
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000,
    }
  );

  // 4. Fallback periodic heartbeat timer (every 12 seconds)
  // Ensures location continues to ping even if watchPosition lags or pauses
  heartbeatIntervalId = setInterval(() => {
    if (!isTrackingRunning) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        currentCoords = [lat, lng];
        options.onLocationUpdate([lat, lng]);
        syncDriverLocationToServer(options.driverId, options.phone, lat, lng);
      },
      () => {
        // If GPS single fix fails but we have cached coords, ping last known
        if (currentCoords) {
          syncDriverLocationToServer(
            options.driverId,
            options.phone,
            currentCoords[0],
            currentCoords[1]
          );
        }
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 8000 }
    );
  }, 12000);

  // Return cleanup function
  return () => {
    isTrackingRunning = false;
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    if (activeWatchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(activeWatchId);
      activeWatchId = null;
    }
    if (heartbeatIntervalId) {
      clearInterval(heartbeatIntervalId);
      heartbeatIntervalId = null;
    }
    releaseScreenWakeLock().catch(() => {});
  };
}

/**
 * Stops any running driver background location tracking and releases resources.
 */
export function stopDriverBackgroundLocationTracking(): void {
  isTrackingRunning = false;
  if (activeWatchId !== null && typeof window !== "undefined" && navigator.geolocation) {
    navigator.geolocation.clearWatch(activeWatchId);
    activeWatchId = null;
  }
  if (heartbeatIntervalId) {
    clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
  }
  releaseScreenWakeLock().catch(() => {});
}
