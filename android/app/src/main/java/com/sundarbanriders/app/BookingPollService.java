package com.sundarbanriders.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * BookingPollService — Native Android Background Service
 *
 * Runs in the background when the driver is ONLINE.
 * Polls the VPS /api/bookings endpoint for new pending rides.
 * When a booking arrives:
 * 1. If "Display over other apps" (SYSTEM_ALERT_WINDOW) is granted, brings MainActivity
 *    to the foreground immediately over any other app or lock screen.
 * 2. Fires a Full-Screen Intent Heads-Up Notification with loud alarm sound & vibration.
 */
public class BookingPollService extends Service {

    private static final String TAG = "SR_BookingPoll";

    public static final String CHANNEL_FOREGROUND = "sr_booking_service_fg";
    public static final String CHANNEL_ALERT      = "sr_booking_alert_urgent";

    private static final int NOTIF_FOREGROUND_ID = 9001;
    private static final int NOTIF_ALERT_BASE_ID = 9500;

    private static final long POLL_INTERVAL_MS = 5000L;

    public static final String PREF_NAME         = "sr_booking_service_pref";
    public static final String PREF_DRIVER_PHONE = "driver_phone";
    public static final String PREF_API_BASE     = "api_base_url";

    public static final String ACTION_STOP = "com.sundarbanriders.app.STOP_BOOKING_POLL";

    private Handler handler;
    private Runnable pollRunnable;
    private PowerManager.WakeLock wakeLock;
    private String driverPhone = "";
    private String apiBaseUrl  = "";
    private String lastSeenBookingId = "";
    private volatile boolean isRunning = false;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
        handler = new Handler(Looper.getMainLooper());

        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "SundarbanRiders::BookingPollWakeLock"
                );
                wakeLock.acquire(30 * 60 * 1000L);
            }
        } catch (Exception e) {
            Log.w(TAG, "WakeLock error: " + e.getMessage());
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }

        SharedPreferences prefs = getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        if (intent != null) {
            String p = intent.getStringExtra("driver_phone");
            String u = intent.getStringExtra("api_base_url");
            if (p != null && !p.isEmpty()) {
                driverPhone = p;
                prefs.edit().putString(PREF_DRIVER_PHONE, p).apply();
            }
            if (u != null && !u.isEmpty()) {
                apiBaseUrl = u;
                prefs.edit().putString(PREF_API_BASE, u).apply();
            }
        }

        if (driverPhone.isEmpty()) driverPhone = prefs.getString(PREF_DRIVER_PHONE, "");
        if (apiBaseUrl.isEmpty() || apiBaseUrl.contains("localhost") || apiBaseUrl.contains("127.0.0.1")) {
            apiBaseUrl = prefs.getString(PREF_API_BASE, "https://109.122.56.24.sslip.io");
        }
        if (apiBaseUrl.isEmpty() || apiBaseUrl.contains("localhost") || apiBaseUrl.contains("127.0.0.1")) {
            apiBaseUrl = "https://109.122.56.24.sslip.io";
        }

        // Start Foreground Service with correct type on Android 14+
        Notification notification = buildForegroundNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                startForeground(NOTIF_FOREGROUND_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } catch (Exception e) {
                startForeground(NOTIF_FOREGROUND_ID, notification);
            }
        } else {
            startForeground(NOTIF_FOREGROUND_ID, notification);
        }

        if (!isRunning) {
            isRunning = true;
            schedulePoll();
        }

        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isRunning = false;
        if (handler != null && pollRunnable != null) {
            handler.removeCallbacks(pollRunnable);
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {}
        }
    }

    private void schedulePoll() {
        pollRunnable = new Runnable() {
            @Override
            public void run() {
                if (!isRunning) return;
                new Thread(() -> {
                    try {
                        checkForNewBooking();
                    } catch (Exception e) {
                        Log.d(TAG, "Poll check: " + e.getMessage());
                    } finally {
                        if (isRunning && handler != null) {
                            handler.postDelayed(pollRunnable, POLL_INTERVAL_MS);
                        }
                    }
                }).start();
            }
        };
        handler.post(pollRunnable);
    }

    private void checkForNewBooking() throws Exception {
        if (apiBaseUrl.isEmpty()) return;

        String baseUrl = apiBaseUrl.replaceAll("/$", "");
        String urlStr = baseUrl + "/api/bookings?status=pending&_t=" + System.currentTimeMillis();

        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        if (conn instanceof javax.net.ssl.HttpsURLConnection) {
            ((javax.net.ssl.HttpsURLConnection) conn).setHostnameVerifier((hostname, session) -> true);
        }
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(4000);
        conn.setReadTimeout(4000);
        conn.setRequestProperty("Accept", "application/json");
        conn.setRequestProperty("Cache-Control", "no-cache");

        int code = conn.getResponseCode();
        if (code != 200) {
            conn.disconnect();
            return;
        }

        BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) sb.append(line);
        reader.close();
        conn.disconnect();

        JSONObject json = new JSONObject(sb.toString());
        JSONArray arr = json.optJSONArray("bookings");
        if (arr == null || arr.length() == 0) {
            JSONObject single = json.optJSONObject("booking");
            if (single != null) {
                arr = new JSONArray();
                arr.put(single);
            }
        }

        if (arr == null || arr.length() == 0) return;

        // Iterate through pending bookings to find unassigned pending ride
        for (int i = 0; i < arr.length(); i++) {
            JSONObject b = arr.getJSONObject(i);
            String id = b.optString("id", "");
            String status = b.optString("status", "");
            String assignedDriver = b.optString("driver_id", "");

            if (id.isEmpty()) continue;
            if (!status.equalsIgnoreCase("pending") && !status.equalsIgnoreCase("requested")) continue;
            // Skip if already assigned to another driver
            if (!assignedDriver.isEmpty() && !assignedDriver.equalsIgnoreCase("null")) continue;

            // Skip if we already alerted for this booking
            if (id.equals(lastSeenBookingId)) continue;

            lastSeenBookingId = id;

            String passName = b.optString("customer_name", b.optString("passenger_name", "যাত্রী"));
            String pickup   = b.optString("pickup_location", "পিকআপ পয়েন্ট");
            String drop     = b.optString("drop_location", "গন্তব্য");
            String fare     = b.optString("estimated_fare", b.optString("fare", ""));

            triggerRideAlert(id, passName, pickup, drop, fare);
            break;
        }
    }

    private void triggerRideAlert(String bookingId, String passengerName, String pickup, String drop, String fare) {
        Log.i(TAG, "Triggering ride alert for booking: " + bookingId);

        // 1. Direct Activity Overlay Launch (if SYSTEM_ALERT_WINDOW granted)
        boolean hasOverlayPermission = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            hasOverlayPermission = Settings.canDrawOverlays(this);
        }

        if (hasOverlayPermission) {
            try {
                Intent frontIntent = new Intent(this, MainActivity.class);
                frontIntent.addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK |
                    Intent.FLAG_ACTIVITY_SINGLE_TOP |
                    Intent.FLAG_ACTIVITY_CLEAR_TOP |
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                );
                frontIntent.putExtra("booking_id", bookingId);
                frontIntent.putExtra("auto_open_booking", true);
                startActivity(frontIntent);
            } catch (Exception e) {
                Log.e(TAG, "Direct overlay launch failed: " + e.getMessage());
            }
        }

        // 2. High-Priority Heads-Up FullScreen Notification
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        Intent tapIntent = new Intent(this, MainActivity.class);
        tapIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        tapIntent.putExtra("booking_id", bookingId);
        tapIntent.putExtra("auto_open_booking", true);

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent tapPI = PendingIntent.getActivity(this, (int)(System.currentTimeMillis() % 10000), tapIntent, piFlags);
        PendingIntent fullScreenPI = PendingIntent.getActivity(this, (int)(System.currentTimeMillis() % 10000) + 1, tapIntent, piFlags);

        Uri alertSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (alertSound == null) {
            alertSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        }

        String fareText = fare.isEmpty() ? "" : " • আনুমানিক ₹" + fare;
        String contentText = passengerName + " : " + cleanLocation(pickup) + " → " + cleanLocation(drop) + fareText;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ALERT)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("🛺 নতুন রাইড অনুরোধ এসেছে!")
            .setContentText(contentText)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(
                "👤 যাত্রী: " + passengerName +
                "\n📍 পিকআপ: " + cleanLocation(pickup) +
                "\n🏁 গন্তব্য: " + cleanLocation(drop) +
                (fare.isEmpty() ? "" : "\n💰 প্রস্তাবিত ভাড়া: ₹" + fare) +
                "\n\nরাইড গ্রহণ করতে এখনই ট্যাপ করুন।"
            ))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setSound(alertSound)
            .setVibrate(new long[]{0, 600, 250, 600, 250, 600})
            .setLights(0xFF10B981, 600, 300)
            .setContentIntent(tapPI)
            .setFullScreenIntent(fullScreenPI, true);

        int notifId = NOTIF_ALERT_BASE_ID + (bookingId.hashCode() & 0x0FFF);
        nm.notify(notifId, builder.build());
    }

    private String cleanLocation(String loc) {
        if (loc == null || loc.isEmpty()) return "নির্দিষ্ট অবস্থান";
        return loc.replaceAll("\\s*\\(GPS:[^)]*\\)", "").trim();
    }

    private Notification buildForegroundNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent openPI = PendingIntent.getActivity(this, 0, openIntent, piFlags);

        return new NotificationCompat.Builder(this, CHANNEL_FOREGROUND)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("সুন্দরবন রাইডার্স (অনলাইন)")
            .setContentText("🟢 চালক সক্রিয় — নতুন রাইডের অপেক্ষায়...")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(openPI)
            .build();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        NotificationChannel fgChannel = new NotificationChannel(
            CHANNEL_FOREGROUND,
            "রাইডার ব্যাকগ্রাউন্ড সার্ভিস",
            NotificationManager.IMPORTANCE_LOW
        );
        fgChannel.setDescription("চালক অনলাইন থাকাকালীন পটভূমি সংযোগ বজায় রাখে");
        fgChannel.setShowBadge(false);
        nm.createNotificationChannel(fgChannel);

        NotificationChannel alertChannel = new NotificationChannel(
            CHANNEL_ALERT,
            "নতুন রাইড অ্যালার্ট (জরুরি)",
            NotificationManager.IMPORTANCE_HIGH
        );
        alertChannel.setDescription("নতুন রাইডের অনুরোধের শব্দ ও ফুল-স্ক্রিন পপ-আপ");
        alertChannel.enableVibration(true);
        alertChannel.setVibrationPattern(new long[]{0, 600, 250, 600, 250, 600});
        alertChannel.enableLights(true);
        alertChannel.setLightColor(0xFF10B981);
        alertChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        alertChannel.setBypassDnd(true);

        Uri alertSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (alertSound != null) {
            AudioAttributes audioAttr = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build();
            alertChannel.setSound(alertSound, audioAttr);
        }

        nm.createNotificationChannel(alertChannel);
    }
}
