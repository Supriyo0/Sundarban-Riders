package com.sundarbanriders.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.util.Log

class SundarbanApp : Application() {

    companion object {
        private const val TAG = "SundarbanApp"
        const val CHANNEL_FOREGROUND = "sr_booking_service_fg"
        const val CHANNEL_ALERT = "sr_booking_alert_v6"

        fun createNotificationChannels(context: Context) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                        ?: return

                    // 1. Foreground Persistent Service Channel (Silent)
                    val fgChannel = NotificationChannel(
                        CHANNEL_FOREGROUND,
                        "চ্যানেল: রাইডার অনলাইন স্ট্যাটাস",
                        NotificationManager.IMPORTANCE_LOW
                    ).apply {
                        description = "ড্রাইভারের সক্রিয় ব্যাকগ্রাউন্ড সার্ভিস ও নেটওয়ার্ক ট্র্যাকিং"
                        setShowBadge(false)
                        setSound(null, null)
                        enableVibration(false)
                    }
                    manager.createNotificationChannel(fgChannel)

                    // 2. High-Priority Booking Alert Channel (Sound + Vibration + App Logo)
                    val soundUri = Uri.parse("android.resource://${context.packageName}/${R.raw.sundarban_alert_chime}")
                    val audioAttributes = AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .build()

                    val alertChannel = NotificationChannel(
                        CHANNEL_ALERT,
                        "নতুন রাইড অ্যালার্ট (Sundarban Riders)",
                        NotificationManager.IMPORTANCE_HIGH
                    ).apply {
                        description = "নতুন যাত্রী বুকিং আসার তাৎক্ষণিক ফুলস্ক্রিন নোটিফিকেশন"
                        enableLights(true)
                        enableVibration(true)
                        vibrationPattern = longArrayOf(0, 450, 200, 450, 200, 600)
                        setSound(soundUri, audioAttributes)
                        setBypassDnd(true)
                        lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                    }
                    manager.createNotificationChannel(alertChannel)

                    Log.i(TAG, "Notification channels pre-registered successfully with custom chime")
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to create notification channels: ${e.message}")
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()

        // 1. Global Crash-Proof Uncaught Exception Handler
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                Log.e(TAG, "FATAL EXCEPTION TRAPPED on thread [${thread.name}]: ${throwable.message}", throwable)
            } catch (t: Throwable) {
                // Ignore
            }
            // If it's a non-critical background service exception, prevent the entire app from dying
            if (thread.name.contains("BookingPoll") || thread.name.contains("OkHttp")) {
                Log.w(TAG, "Suppressed background thread exception without killing app UI")
            } else {
                defaultHandler?.uncaughtException(thread, throwable)
            }
        }

        // 2. Pre-create notification channels on app startup
        createNotificationChannels(this)
    }
}

