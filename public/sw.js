// Sundarban Riders Service Worker - Push Notifications & Offline Assets
// Enables native background notifications with vibration & sound when phone screen is off or app is closed.

const CACHE_NAME = 'sr-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming background push notifications (FCM / Web Push)
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: '🛺 নতুন রাইড নোটিফিকেশন!',
        body: event.data.text() || 'সুন্দরবন রাইডার থেকে নতুন রাইডের অ্যালার্ট এসেছে।',
      };
    }
  }

  const title = data.title || '🛺 নতুন টোটো রাইড রিকোয়েস্ট!';
  const options = {
    body: data.body || 'কাছাকাছি এক যাত্রী নতুন টোটো বুক করতে চাইছেন। এখনই দেখুন!',
    icon: data.icon || '/sundarban-logo.png',
    badge: data.badge || '/sundarban-logo.png',
    tag: data.tag || 'ride-alert-' + Date.now(),
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 150, 300, 150, 500],
    data: {
      url: data.url || '/app',
      bookingId: data.bookingId,
      timestamp: Date.now(),
    },
    actions: [
      {
        action: 'view_ride',
        title: '🛺 রাইড দেখুন',
      },
      {
        action: 'dismiss',
        title: 'বন্ধ করুন',
      },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/app';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If an existing /app window is open, focus it and notify it
      for (const client of windowClients) {
        if (client.url.includes('/app') && 'focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_RIDE_CLICKED',
            bookingId: event.notification.data?.bookingId,
          });
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
