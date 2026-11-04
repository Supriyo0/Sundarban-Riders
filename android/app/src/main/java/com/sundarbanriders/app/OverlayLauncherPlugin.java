package com.sundarbanriders.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "OverlayLauncher")
public class OverlayLauncherPlugin extends Plugin {

    private static final String TAG = "OverlayLauncher";

    @PluginMethod
    public void canDrawOverlays(PluginCall call) {
        boolean canDraw = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Context ctx = getContext();
            canDraw = Settings.canDrawOverlays(ctx);
        }
        JSObject ret = new JSObject();
        ret.put("granted", canDraw);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Context ctx = getContext();
                if (!Settings.canDrawOverlays(ctx)) {
                    Intent intent = new Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + ctx.getPackageName())
                    );
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    ctx.startActivity(intent);
                }
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to open overlay settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void bringToForeground(PluginCall call) {
        try {
            Context ctx = getContext();
            Intent intent = new Intent(ctx, MainActivity.class);
            intent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_SINGLE_TOP |
                Intent.FLAG_ACTIVITY_CLEAR_TOP |
                Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            );
            ctx.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to bring app to foreground: " + e.getMessage());
        }
    }

    @PluginMethod
    public void startBookingService(PluginCall call) {
        try {
            Context ctx = getContext();
            String driverPhone = call.getString("driverPhone", "");
            String apiBaseUrl = call.getString("apiBaseUrl", "");

            Log.i(TAG, "Starting BookingPollService for phone: " + driverPhone + ", url: " + apiBaseUrl);

            Intent serviceIntent = new Intent(ctx, BookingPollService.class);
            if (driverPhone != null && !driverPhone.isEmpty()) {
                serviceIntent.putExtra("driver_phone", driverPhone);
            }
            if (apiBaseUrl != null && !apiBaseUrl.isEmpty()) {
                serviceIntent.putExtra("api_base_url", apiBaseUrl);
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(serviceIntent);
            } else {
                ctx.startService(serviceIntent);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start booking service: " + e.getMessage());
            call.reject("Failed to start booking service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopBookingService(PluginCall call) {
        try {
            Context ctx = getContext();
            Log.i(TAG, "Stopping BookingPollService");
            Intent serviceIntent = new Intent(ctx, BookingPollService.class);
            serviceIntent.setAction(BookingPollService.ACTION_STOP);
            ctx.stopService(serviceIntent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop booking service: " + e.getMessage());
            call.reject("Failed to stop booking service: " + e.getMessage());
        }
    }
}
