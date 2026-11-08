package com.sundarbanriders.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingBookingIntent(intent);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(OverlayLauncherPlugin.class);
        super.onCreate(savedInstanceState);

        try {
            BookingPollService.createNotificationChannels(this);
        } catch (Exception ignored) {}

        try {
            EdgeToEdge.enable(this);
        } catch (Exception ignored) {}

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(true);
                setTurnScreenOn(true);
            } else {
                getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                );
            }
        } catch (Exception ignored) {}

        handleIncomingBookingIntent(getIntent());
    }

    private void handleIncomingBookingIntent(Intent intent) {
        if (intent == null) return;
        String bookingId = intent.getStringExtra("booking_id");
        if (bookingId == null || bookingId.trim().isEmpty()) {
            android.net.Uri data = intent.getData();
            if (data != null && "sundarbanriders".equals(data.getScheme())) {
                bookingId = data.getLastPathSegment();
            }
        }
        if (bookingId != null && !bookingId.trim().isEmpty()) {
            final String cleanId = bookingId.trim();
            OverlayLauncherPlugin.setPendingBookingId(cleanId);
            try {
                SharedPreferences prefs = getSharedPreferences("sr_booking_service_pref", Context.MODE_PRIVATE);
                prefs.edit()
                    .putString("last_tapped_booking_id", cleanId)
                    .putLong("last_tapped_time", System.currentTimeMillis())
                    .apply();
            } catch (Exception ignored) {}
            dispatchBookingToWeb(cleanId);
        }
    }

    private void dispatchBookingToWeb(final String bookingId) {
        Runnable dispatchRunnable = () -> {
            try {
                if (!isFinishing() && !isDestroyed() && getBridge() != null && getBridge().getWebView() != null) {
                    String js = "window.dispatchEvent(new CustomEvent('sr:open_booking', { detail: { bookingId: '" + bookingId + "' } }));";
                    getBridge().getWebView().evaluateJavascript(js, null);
                }
            } catch (Exception ignored) {}
        };

        new Handler(Looper.getMainLooper()).post(dispatchRunnable);
        new Handler(Looper.getMainLooper()).postDelayed(dispatchRunnable, 800);
        new Handler(Looper.getMainLooper()).postDelayed(dispatchRunnable, 1800);
        new Handler(Looper.getMainLooper()).postDelayed(dispatchRunnable, 3000);
    }
}
