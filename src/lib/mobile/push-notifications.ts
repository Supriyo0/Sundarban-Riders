/**
 * Push Notification Service (Web Push / FCM / Capacitor Push)
 *
 * Ensures drivers receive loud sound & vibration alerts even when their phone
 * screen is off, minimized, or in the background.
 */

export interface PushSubscriptionResult {
  success: boolean;
  token?: string;
  error?: string;
}

/**
 * Registers the Service Worker for background push notifications
 */
export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.warn("[Push] Service worker registration failed:", err);
    return null;
  }
}

/**
 * Requests push notification permission from the user/browser/OS
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  try {
    if (Notification.permission === "granted") {
      return "granted";
    }
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn("[Push] Request permission failed:", err);
    return "denied";
  }
}

/**
 * Subscribes the driver to push notifications and syncs with backend
 */
export async function subscribeDriverToPushNotifications(options: {
  phone: string;
  driverId?: string;
}): Promise<PushSubscriptionResult> {
  if (typeof window === "undefined") {
    return { success: false, error: "Window unavailable" };
  }

  try {
    // 1. Request permission
    const permission = await requestNotificationPermission();
    if (permission !== "granted") {
      return { success: false, error: "Notification permission not granted" };
    }

    // 2. Register service worker
    const reg = await registerPushServiceWorker();
    if (!reg) {
      return { success: false, error: "Service worker not supported" };
    }

    // 3. Try Capacitor Native Push if in Capacitor Android container
    const isCapacitor = Boolean(
      (window as any).Capacitor && (window as any).Capacitor.isNativePlatform()
    );

    if (isCapacitor) {
      try {
        const NativePush = (window as any).Capacitor?.Plugins?.PushNotifications;
        if (NativePush) {
          const permResult = await NativePush.requestPermissions();
          if (permResult.receive === "granted") {
            await NativePush.register();
            return { success: true };
          }
        }
      } catch (nativeErr) {
        console.warn("[Push] Native Capacitor push fallback to Web Push:", nativeErr);
      }
    }

    // 4. Web Push (FCM / VAPID) subscription via PushManager
    if ("pushManager" in reg) {
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        // Standard default subscription
        try {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || undefined,
          });
        } catch {
          // If VAPID key is not set or local testing
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
          }).catch(() => null);
        }
      }

      if (sub) {
        // Sync subscription with server
        try {
          await fetch("/api/notifications/push-subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: options.phone,
              driverId: options.driverId,
              subscription: sub,
            }),
          });
        } catch {}
        return { success: true, token: JSON.stringify(sub) };
      }
    }

    return { success: true };
  } catch (err: any) {
    console.warn("[Push] Subscription error:", err);
    return { success: false, error: err?.message || "Push subscription error" };
  }
}

/**
 * Fires a local high-priority ride alert notification with sound & vibration
 * Drops down Heads-Up banner even when driver is in another app or screen is off.
 */
export async function showLocalRideAlertNotification(title: string, body: string, bookingId?: string) {
  if (typeof window === "undefined") return;

  // 1. Try Native Capacitor Local Notifications (Android Foreground & Background Heads-Up Banner)
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { LocalNotifications } = await import("@capacitor/local-notifications");

      // Ensure high-priority heads-up channel
      try {
        await LocalNotifications.createChannel({
          id: "ride_alerts",
          name: "Ride Alerts",
          description: "High priority heads-up incoming ride requests",
          importance: 5, // MAX importance for Heads-Up drop-down banner
          visibility: 1, // Public on lockscreen
          vibration: true,
          lights: true,
          lightColor: "#059669",
        });
      } catch {}

      const notifId = Math.abs(
        parseInt((bookingId || "").replace(/\D/g, "").slice(-6), 10) || Math.floor(Math.random() * 90000 + 10000)
      );

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title,
            body,
            channelId: "ride_alerts",
            smallIcon: "ic_launcher",
            largeIcon: "ic_launcher",
            extra: { bookingId, url: "/app" },
            schedule: { at: new Date(Date.now() + 50) },
          },
        ],
      });
      return;
    }
  } catch (nativeErr) {
    console.warn("[LocalNotifications] native dispatch error:", nativeErr);
  }

  // 2. Web Push / Service Worker fallback
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg && reg.showNotification) {
      await reg.showNotification(title, {
        body,
        icon: "/sundarban-logo.png",
        badge: "/sundarban-logo.png",
        tag: "ride-" + (bookingId || Date.now()),
        renotify: true,
        vibrate: [300, 100, 300, 100, 500],
        data: { url: "/app", bookingId },
      } as any);
    } else {
      new Notification(title, {
        body,
        icon: "/sundarban-logo.png",
      });
    }
  } catch (err) {
    console.warn("[Push] Local notification display error:", err);
  }
}
