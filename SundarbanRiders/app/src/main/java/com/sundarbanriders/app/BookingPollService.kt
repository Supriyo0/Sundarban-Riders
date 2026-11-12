package com.sundarbanriders.app

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.ServiceInfo
import android.graphics.BitmapFactory
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

class BookingPollService : Service() {

    companion object {
        private const val TAG = "BookingPollService"
        private const val NOTIF_FOREGROUND_ID = 9001
        private const val NOTIF_ALERT_BASE_ID = 9500
        private const val POLL_INTERVAL_MS = 3500L

        const val PREF_NAME = "sr_booking_service_pref"
        const val PREF_DRIVER_PHONE = "driver_phone"
        const val PREF_API_BASE = "api_base_url"

        const val ACTION_STOP = "com.sundarbanriders.app.STOP_BOOKING_POLL"
    }

    private val serviceJob = Job()
    private val serviceScope = CoroutineScope(Dispatchers.IO + serviceJob)
    private var wakeLock: PowerManager.WakeLock? = null

    private var driverPhone: String = ""
    private var apiBaseUrl: String = "https://sundarbanrider.in"

    private val alertedBookingTimes = ConcurrentHashMap<String, Long>()
    private var isPolling = false

    private val httpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(5, TimeUnit.SECONDS)
            .build()
    }

    override fun onCreate() {
        super.onCreate()
        SundarbanApp.createNotificationChannels(this)

        // 1. Immediately call startForeground in onCreate within 0ms to guarantee
        // ForegroundServiceDidNotStartInTimeException is IMPOSSIBLE
        try {
            val notification = buildForegroundNotification()
            if (Build.VERSION.SDK_INT >= 34) { // Android 14+
                startForeground(
                    NOTIF_FOREGROUND_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                )
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIF_FOREGROUND_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                )
            } else {
                startForeground(NOTIF_FOREGROUND_ID, notification)
            }
            Log.i(TAG, "Foreground service started successfully with type dataSync")
        } catch (t: Throwable) {
            Log.e(TAG, "startForeground error in onCreate: ${t.message}", t)
            try {
                startForeground(NOTIF_FOREGROUND_ID, buildForegroundNotification())
            } catch (ignored: Throwable) {}
        }

        // 2. Safe WakeLock (Partial)
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
            wakeLock = pm?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SundarbanRiders::BookingPollWakeLock")
            wakeLock?.acquire(30 * 60 * 1000L) // 30 mins
        } catch (e: Exception) {
            Log.w(TAG, "WakeLock acquire error: ${e.message}")
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Redundantly ensure foreground notification is attached
        try {
            val notification = buildForegroundNotification()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIF_FOREGROUND_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
            } else {
                startForeground(NOTIF_FOREGROUND_ID, notification)
            }
        } catch (ignored: Throwable) {}

        if (intent?.action == ACTION_STOP) {
            stopPollingAndSelf()
            return START_NOT_STICKY
        }

        val prefs = getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        intent?.let {
            val p = it.getStringExtra("driver_phone")
            val u = it.getStringExtra("api_base_url")
            if (!p.isNullOrEmpty()) {
                driverPhone = p
                prefs.edit().putString(PREF_DRIVER_PHONE, p).apply()
            }
            if (!u.isNullOrEmpty()) {
                apiBaseUrl = u
                prefs.edit().putString(PREF_API_BASE, u).apply()
            }
        }

        if (driverPhone.isEmpty()) {
            driverPhone = prefs.getString(PREF_DRIVER_PHONE, "") ?: ""
        }
        val savedUrl = prefs.getString(PREF_API_BASE, "") ?: ""
        if (savedUrl.isNotEmpty() && !savedUrl.contains("localhost")) {
            apiBaseUrl = savedUrl
        }

        if (!isPolling) {
            isPolling = true
            startPollingLoop()
        }

        return START_STICKY
    }

    private fun startPollingLoop() {
        serviceScope.launch {
            while (isActive && isPolling) {
                try {
                    pollPendingBookings()
                } catch (t: Throwable) {
                    Log.w(TAG, "Polling loop error: ${t.message}")
                }
                delay(POLL_INTERVAL_MS)
            }
        }
    }

    private fun pollPendingBookings() {
        val targetUrl = "$apiBaseUrl/api/bookings?active=true&status=pending&_t=${System.currentTimeMillis()}"
        val request = Request.Builder()
            .url(targetUrl)
            .header("Cache-Control", "no-cache")
            .header("Pragma", "no-cache")
            .build()

        httpClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return
            val body = response.body?.string() ?: return
            val json = JSONObject(body)

            val bookingsArray: JSONArray = when {
                json.has("bookings") -> json.getJSONArray("bookings")
                json.has("trips") -> json.getJSONArray("trips")
                else -> return
            }

            for (i in 0 until bookingsArray.length()) {
                val b = bookingsArray.getJSONObject(i)
                val status = b.optString("status")
                if (status == "pending" || status == "searching") {
                    val bookingId = b.optString("id", b.optString("booking_number", ""))
                    if (bookingId.isNotEmpty()) {
                        handleIncomingBooking(b, bookingId)
                    }
                }
            }
        }
    }

    private fun handleIncomingBooking(bookingJson: JSONObject, bookingId: String) {
        val now = System.currentTimeMillis()
        val lastAlerted = alertedBookingTimes[bookingId] ?: 0L
        if (now - lastAlerted < 25000L) {
            // Already alerted within 25 seconds
            return
        }
        alertedBookingTimes[bookingId] = now

        val passengerName = bookingJson.optString("customer_name", "যাত্রী বন্ধু")
        val pickup = bookingJson.optString("pickup_location", "পিকআপ অবস্থান")
        val drop = bookingJson.optString("drop_location", "গন্তব্য")
        val fare = bookingJson.optString("estimated_fare", "40")

        Log.i(TAG, "🚨 NEW BOOKING ALERT: ID=$bookingId, Route=$pickup -> $drop, Fare=₹$fare")

        // 1. Play Alert Sound
        playChimeSound()

        // 2. Show Heads-Up High Priority Notification with Full Screen Intent
        showAlertNotification(bookingId, passengerName, pickup, drop, fare)

        // 3. Show Floating Native Window if permission granted
        OverlayHelper.showBookingOverlay(this, bookingId, passengerName, pickup, drop, fare)
    }

    private fun playChimeSound() {
        try {
            val mediaPlayer = MediaPlayer.create(this, R.raw.sundarban_alert_chime)
                ?: MediaPlayer().apply {
                    setAudioAttributes(
                        AudioAttributes.Builder()
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .build()
                    )
                }
            mediaPlayer.setOnCompletionListener { it.release() }
            mediaPlayer.start()
        } catch (t: Throwable) {
            Log.w(TAG, "Audio player error: ${t.message}")
        }
    }

    private fun showAlertNotification(
        bookingId: String,
        passengerName: String,
        pickup: String,
        drop: String,
        fare: String
    ) {
        try {
            val intent = Intent(this, MainActivity::class.java).apply {
                action = "com.sundarbanriders.app.OPEN_BOOKING_$bookingId"
                data = Uri.parse("sundarbanriders://booking/$bookingId")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                putExtra("booking_id", bookingId)
                putExtra("auto_open_booking", true)
            }

            val piFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }

            val pendingIntent = PendingIntent.getActivity(this, bookingId.hashCode(), intent, piFlags)

            val soundUri = Uri.parse("android.resource://$packageName/${R.raw.sundarban_alert_chime}")
            val logoBitmap = try {
                BitmapFactory.decodeResource(resources, R.drawable.sundarban_logo)
            } catch (ignored: Exception) {
                null
            } ?: BitmapFactory.decodeResource(resources, R.mipmap.ic_launcher)

            val notification = NotificationCompat.Builder(this, SundarbanApp.CHANNEL_ALERT)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setLargeIcon(logoBitmap)
                .setColor(0xFF059669.toInt())
                .setContentTitle("নতুন রাইডের অনুরোধ! • ₹$fare")
                .setContentText("$passengerName: $pickup ➔ $drop")
                .setStyle(
                    NotificationCompat.BigTextStyle()
                        .bigText("যাত্রী: $passengerName\nপিকআপ: $pickup\nগন্তব্য: $drop\nভাড়া: ₹$fare")
                )
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setAutoCancel(true)
                .setSound(soundUri)
                .setVibrate(longArrayOf(0, 450, 200, 450, 200, 600))
                .setFullScreenIntent(pendingIntent, true)
                .setContentIntent(pendingIntent)
                .addAction(
                    R.mipmap.ic_launcher,
                    "রাইড গ্রহণ করুন",
                    pendingIntent
                )
                .build()

            val nm = NotificationManagerCompat.from(this)
            val notifId = NOTIF_ALERT_BASE_ID + (Math.abs(bookingId.hashCode()) % 500)
            nm.notify(notifId, notification)

        } catch (t: Throwable) {
            Log.w(TAG, "Failed to show alert notification: ${t.message}")
        }
    }

    private fun buildForegroundNotification(): Notification {
        val openIntent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        val piFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val openPI = PendingIntent.getActivity(this, 0, openIntent, piFlags)

        val logoBitmap = try {
            BitmapFactory.decodeResource(resources, R.drawable.sundarban_logo)
        } catch (ignored: Exception) {
            null
        } ?: BitmapFactory.decodeResource(resources, R.mipmap.ic_launcher)

        return NotificationCompat.Builder(this, SundarbanApp.CHANNEL_FOREGROUND)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setLargeIcon(logoBitmap)
            .setColor(0xFF059669.toInt())
            .setContentTitle("সুন্দরবন রাইডার্স (অনলাইন)")
            .setContentText("চালক সক্রিয় — নতুন রাইডের অপেক্ষায়...")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(openPI)
            .build()
    }

    private fun stopPollingAndSelf() {
        isPolling = false
        serviceJob.cancel()
        OverlayHelper.dismissOverlay(this)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
        } catch (ignored: Throwable) {}
        stopSelf()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        isPolling = false
        serviceJob.cancel()
        OverlayHelper.dismissOverlay(this)
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
        } catch (ignored: Exception) {}
    }
}

