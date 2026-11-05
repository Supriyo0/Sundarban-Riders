package com.sundarbanriders.app;

import android.content.Intent;
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
            EdgeToEdge.enable(this);
        } catch (Exception ignored) {}

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

        handleIncomingBookingIntent(getIntent());
    }

    private void handleIncomingBookingIntent(Intent intent) {
        if (intent == null) return;
        String bookingId = intent.getStringExtra("booking_id");
        if (bookingId != null && !bookingId.trim().isEmpty()) {
            final String cleanId = bookingId.trim();
            OverlayLauncherPlugin.setPendingBookingId(cleanId);
            dispatchBookingToWeb(cleanId);
        }
    }

    private void dispatchBookingToWeb(final String bookingId) {
        // Dispatch immediately and retry after a short delay to ensure WebView bridge is ready
        Runnable dispatchRunnable = () -> {
            try {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    String js = "window.dispatchEvent(new CustomEvent('sr:open_booking', { detail: { bookingId: '" + bookingId + "' } }));";
                    getBridge().getWebView().evaluateJavascript(js, null);
                }
            } catch (Exception ignored) {}
        };

        new Handler(Looper.getMainLooper()).post(dispatchRunnable);
        new Handler(Looper.getMainLooper()).postDelayed(dispatchRunnable, 1000);
        new Handler(Looper.getMainLooper()).postDelayed(dispatchRunnable, 2500);
    }
}
