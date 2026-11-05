package com.sundarbanriders.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

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
 * 1. Plays Sundarban Riders custom chime sound cleanly on Main Looper.
 * 2. If "Display over other apps" (SYSTEM_ALERT_WINDOW) is granted, displays a true
 *    native WindowManager floating overlay view right over whatever app is open.
 * 3. Fires a High-Priority Full-Screen Heads-Up Notification with custom sound & vibration.
 */
public class BookingPollService extends Service {

    private static final String TAG = "SR_BookingPoll";

    public static final String CHANNEL_FOREGROUND = "sr_booking_service_fg";
    public static final String CHANNEL_ALERT      = "sr_booking_alert_app_v4";

    private static final int NOTIF_FOREGROUND_ID = 9001;
    private static final int NOTIF_ALERT_BASE_ID = 9500;

    private static final long POLL_INTERVAL_MS = 3500L;

    public static final String PREF_NAME         = "sr_booking_service_pref";
    public static final String PREF_DRIVER_PHONE = "driver_phone";
    public static final String PREF_API_BASE     = "api_base_url";

    public static final String ACTION_STOP = "com.sundarbanriders.app.STOP_BOOKING_POLL";

    private Handler handler;
    private Runnable pollRunnable;
    private PowerManager.WakeLock wakeLock;
    private String driverPhone = "";
    private String apiBaseUrl  = "";
    private final java.util.Map<String, Long> alertedBookingTimes = new java.util.concurrent.ConcurrentHashMap<>();
    private volatile boolean isRunning = false;
    private View currentFloatingView = null;
    private final java.util.concurrent.atomic.AtomicBoolean isChecking = new java.util.concurrent.atomic.AtomicBoolean(false);

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
        dismissFloatingOverlay();
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
                if (!isChecking.get()) {
                    new Thread(() -> {
                        if (isChecking.compareAndSet(false, true)) {
                            try {
                                checkForNewBooking();
                            } catch (Exception e) {
                                Log.d(TAG, "Poll check: " + e.getMessage());
                            } finally {
                                isChecking.set(false);
                            }
                        }
                    }).start();
                }
                if (isRunning && handler != null) {
                    handler.postDelayed(this, POLL_INTERVAL_MS);
                }
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

        for (int i = 0; i < arr.length(); i++) {
            JSONObject b = arr.getJSONObject(i);
            String id = b.optString("id", "");
            String status = b.optString("status", "");
            String assignedDriver = b.optString("driver_id", "");

            if (id.isEmpty()) continue;
            if (!status.equalsIgnoreCase("pending") && !status.equalsIgnoreCase("requested")) continue;
            if (!assignedDriver.isEmpty() && !assignedDriver.equalsIgnoreCase("null")) continue;

            long now = System.currentTimeMillis();
            Long lastAlerted = alertedBookingTimes.get(id);
            // If alerted within the last 150 seconds, skip. After 2.5 minutes or if new, alert driver!
            if (lastAlerted != null && (now - lastAlerted < 150000L)) {
                continue;
            }
            alertedBookingTimes.put(id, now);

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

        // 1. Play App Custom Chime Sound on Main Looper safely
        handler.post(() -> {
            try {
                MediaPlayer mp = MediaPlayer.create(getApplicationContext(), R.raw.ride_alert);
                if (mp != null) {
                    mp.setOnCompletionListener(MediaPlayer::release);
                    mp.setOnErrorListener((player, what, extra) -> {
                        try { player.release(); } catch (Exception ignored) {}
                        return true;
                    });
                    mp.start();
                }
            } catch (Exception e) {
                Log.w(TAG, "MediaPlayer error: " + e.getMessage());
            }
        });

        // 2. Show Native WindowManager Floating Overlay View (Draw Over Other Apps)
        showFloatingOverlay(bookingId, passengerName, pickup, drop, fare);

        // 3. High-Priority Heads-Up FullScreen Notification
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        Intent tapIntent = new Intent(this, MainActivity.class);
        tapIntent.setAction("com.sundarbanriders.app.OPEN_BOOKING_" + bookingId);
        tapIntent.setData(Uri.parse("sundarbanriders://booking/" + bookingId));
        tapIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_SINGLE_TOP |
            Intent.FLAG_ACTIVITY_CLEAR_TOP
        );
        tapIntent.putExtra("booking_id", bookingId);
        tapIntent.putExtra("auto_open_booking", true);

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent tapPI = PendingIntent.getActivity(this, (int)(System.currentTimeMillis() % 10000), tapIntent, piFlags);
        PendingIntent fullScreenPI = PendingIntent.getActivity(this, (int)(System.currentTimeMillis() % 10000) + 1, tapIntent, piFlags);

        Uri alertSound = Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + getPackageName() + "/" + R.raw.ride_alert);

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
            .setVibrate(new long[]{0, 500, 200, 500, 200, 500})
            .setLights(0xFF10B981, 600, 300)
            .setContentIntent(tapPI)
            .setFullScreenIntent(fullScreenPI, true);

        int notifId = NOTIF_ALERT_BASE_ID + (bookingId.hashCode() & 0x0FFF);
        nm.notify(notifId, builder.build());
    }

    private void showFloatingOverlay(final String bookingId, final String passengerName, final String pickup, final String drop, final String fare) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            return;
        }

        handler.post(() -> {
            try {
                WindowManager wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
                if (wm == null) return;

                dismissFloatingOverlay();

                int layoutType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                    : WindowManager.LayoutParams.TYPE_PHONE;

                WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                    WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    layoutType,
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL |
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
                    PixelFormat.TRANSLUCENT
                );
                params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
                params.y = dp(20);

                // Build modern UI card programmatically
                LinearLayout card = new LinearLayout(this);
                card.setOrientation(LinearLayout.VERTICAL);
                card.setPadding(dp(16), dp(14), dp(16), dp(14));

                GradientDrawable bg = new GradientDrawable();
                bg.setColor(0xFFFFFFFF);
                bg.setCornerRadius(dp(22));
                bg.setStroke(dp(2), 0xFF10B981); // Emerald border
                card.setBackground(bg);
                card.setElevation(dp(16));

                // Title + Fare Row
                LinearLayout topRow = new LinearLayout(this);
                topRow.setOrientation(LinearLayout.HORIZONTAL);
                topRow.setGravity(Gravity.CENTER_VERTICAL);

                TextView titleTv = new TextView(this);
                titleTv.setText("🛺 নতুন রাইড অনুরোধ!");
                titleTv.setTextColor(0xFF047857);
                titleTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
                titleTv.setTypeface(Typeface.DEFAULT_BOLD);
                LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f);
                topRow.addView(titleTv, titleLp);

                if (!fare.isEmpty()) {
                    TextView fareTv = new TextView(this);
                    fareTv.setText("₹" + fare);
                    fareTv.setTextColor(0xFF0F172A);
                    fareTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
                    fareTv.setTypeface(Typeface.DEFAULT_BOLD);
                    topRow.addView(fareTv);
                }
                card.addView(topRow);

                // Passenger Name
                TextView nameTv = new TextView(this);
                nameTv.setText("👤 যাত্রী: " + passengerName);
                nameTv.setTextColor(0xFF334155);
                nameTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
                nameTv.setTypeface(Typeface.DEFAULT_BOLD);
                nameTv.setPadding(0, dp(4), 0, 0);
                card.addView(nameTv);

                // Route: Pickup -> Drop
                TextView routeTv = new TextView(this);
                routeTv.setText("📍 " + cleanLocation(pickup) + " ➔ " + cleanLocation(drop));
                routeTv.setTextColor(0xFF64748B);
                routeTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
                routeTv.setPadding(0, dp(2), 0, dp(10));
                card.addView(routeTv);

                // Buttons Row: [✕ বাতিল] & [ 🛺 রাইড গ্রহণ করুন ]
                LinearLayout btnRow = new LinearLayout(this);
                btnRow.setOrientation(LinearLayout.HORIZONTAL);

                Button dismissBtn = new Button(this);
                dismissBtn.setText("✕ বন্ধ করুন");
                dismissBtn.setTextColor(0xFF64748B);
                dismissBtn.setBackgroundColor(Color.TRANSPARENT);
                dismissBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
                LinearLayout.LayoutParams dismissLp = new LinearLayout.LayoutParams(0, dp(44), 0.35f);
                dismissLp.setMargins(0, 0, dp(8), 0);
                btnRow.addView(dismissBtn, dismissLp);

                Button acceptBtn = new Button(this);
                acceptBtn.setText("🛺 রাইড দেখুন ও গ্রহণ করুন");
                acceptBtn.setTextColor(Color.WHITE);
                GradientDrawable btnBg = new GradientDrawable();
                btnBg.setColor(0xFF10B981);
                btnBg.setCornerRadius(dp(14));
                acceptBtn.setBackground(btnBg);
                acceptBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
                acceptBtn.setTypeface(Typeface.DEFAULT_BOLD);
                LinearLayout.LayoutParams acceptLp = new LinearLayout.LayoutParams(0, dp(44), 0.65f);
                btnRow.addView(acceptBtn, acceptLp);

                card.addView(btnRow);

                FrameLayout rootLayout = new FrameLayout(this);
                rootLayout.setPadding(dp(14), dp(8), dp(14), dp(8));
                rootLayout.addView(card);

                currentFloatingView = rootLayout;
                wm.addView(rootLayout, params);

                acceptBtn.setOnClickListener(v -> {
                    dismissFloatingOverlay();
                    try {
                        Intent openIntent = new Intent(this, MainActivity.class);
                        openIntent.setAction("com.sundarbanriders.app.OPEN_BOOKING_" + bookingId);
                        openIntent.setData(Uri.parse("sundarbanriders://booking/" + bookingId));
                        openIntent.addFlags(
                            Intent.FLAG_ACTIVITY_NEW_TASK |
                            Intent.FLAG_ACTIVITY_SINGLE_TOP |
                            Intent.FLAG_ACTIVITY_CLEAR_TOP
                        );
                        openIntent.putExtra("booking_id", bookingId);
                        openIntent.putExtra("auto_open_booking", true);
                        startActivity(openIntent);
                    } catch (Exception e) {
                        Log.w(TAG, "Failed to launch MainActivity from overlay: " + e.getMessage());
                    }
                });

                dismissBtn.setOnClickListener(v -> dismissFloatingOverlay());

                // Auto dismiss after 30 seconds
                handler.postDelayed(() -> {
                    if (currentFloatingView == rootLayout) {
                        dismissFloatingOverlay();
                    }
                }, 30000);

            } catch (Exception e) {
                Log.w(TAG, "Floating overlay display error: " + e.getMessage());
            }
        });
    }

    private void dismissFloatingOverlay() {
        if (currentFloatingView != null) {
            try {
                WindowManager wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
                if (wm != null && currentFloatingView.isAttachedToWindow()) {
                    wm.removeViewImmediate(currentFloatingView);
                }
            } catch (Exception ignored) {}
            currentFloatingView = null;
        }
    }

    private int dp(int value) {
        return (int) TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value,
            getResources().getDisplayMetrics()
        );
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
            "নতুন রাইড অ্যালার্ট (কাস্টম টোন)",
            NotificationManager.IMPORTANCE_HIGH
        );
        alertChannel.setDescription("নতুন রাইডের অনুরোধের শব্দ ও ফুল-স্ক্রিন পপ-আপ");
        alertChannel.enableVibration(true);
        alertChannel.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500});
        alertChannel.enableLights(true);
        alertChannel.setLightColor(0xFF10B981);
        alertChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        alertChannel.setBypassDnd(true);

        try {
            Uri alertSound = Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + getPackageName() + "/" + R.raw.ride_alert);
            AudioAttributes audioAttr = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build();
            alertChannel.setSound(alertSound, audioAttr);
        } catch (Exception e) {
            Log.w(TAG, "Custom sound channel config: " + e.getMessage());
        }

        nm.createNotificationChannel(alertChannel);
    }
}
