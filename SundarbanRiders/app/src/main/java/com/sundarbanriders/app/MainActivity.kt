package com.sundarbanriders.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.app.NotificationManager
import android.app.PendingIntent
import androidx.core.app.NotificationCompat
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat

class MainActivity : ComponentActivity() {

    companion object {
        private const val TAG = "MainActivity"
        private const val APP_URL = "https://109.122.56.24.sslip.io/app"
        private var pendingBookingId: String? = null
    }

    private lateinit var webView: WebView
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null

    // Modern ActivityResult launchers
    private val requestPermissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val grantedLoc = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val grantedNotif = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions[Manifest.permission.POST_NOTIFICATIONS] ?: false
        } else true
        Log.i(TAG, "Permissions result: Location=$grantedLoc, Notifications=$grantedNotif")
    }

    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (fileUploadCallback == null) return@registerForActivityResult
        val results = if (result.resultCode == RESULT_OK) {
            val data = result.data
            if (data?.data != null) {
                arrayOf(data.data!!)
            } else if (data?.clipData != null) {
                val clip = data.clipData!!
                val list = mutableListOf<Uri>()
                for (i in 0 until clip.itemCount) {
                    list.add(clip.getItemAt(i).uri)
                }
                list.toTypedArray()
            } else null
        } else null
        fileUploadCallback?.onReceiveValue(results)
        fileUploadCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Screen on and show over lockscreen when arriving from alert
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(true)
                setTurnScreenOn(true)
            } else {
                @Suppress("DEPRECATION")
                window.addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                )
            }
        } catch (ignored: Exception) {}

        requestAppPermissions()
        setupCrashProofWebView()
        setContentView(webView)

        handleIncomingIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncomingIntent(intent)
    }

    private fun handleIncomingIntent(intent: Intent?) {
        if (intent == null) return
        val bookingId = intent.getStringExtra("booking_id")
            ?: intent.data?.lastPathSegment
        if (!bookingId.isNullOrEmpty()) {
            pendingBookingId = bookingId
            Log.i(TAG, "Incoming booking intent received for: $bookingId")
            // Forward directly to web app via JavaScript
            Handler(Looper.getMainLooper()).postDelayed({
                webView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('sr:open_booking', { detail: { bookingId: '$bookingId' } }));",
                    null
                )
            }, 1000)
        }
    }

    private fun requestAppPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        requestPermissionsLauncher.launch(permissions.toTypedArray())
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupCrashProofWebView() {
        webView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                useWideViewPort = true
                loadWithOverviewMode = true
                setSupportZoom(false)
                displayZoomControls = false
                builtInZoomControls = false
                allowFileAccess = true
                allowContentAccess = true
                mediaPlaybackRequiresUserGesture = false
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                cacheMode = WebSettings.LOAD_DEFAULT
                userAgentString = "${settings.userAgentString} SundarbanRidersApp/3.8"
            }

            // CRASH-PROOF WebViewClient: Overrides onRenderProcessGone to prevent process crashes!
            webViewClient = object : WebViewClient() {
                override fun onRenderProcessGone(view: WebView?, detail: android.webkit.RenderProcessGoneDetail?): Boolean {
                    Log.w(TAG, "WebView render process gone! Recovering safely without crash. Did crash: ${detail?.didCrash()}")
                    // Destroy old webView and reload
                    try {
                        (view?.parent as? ViewGroup)?.removeView(view)
                        view?.destroy()
                        setupCrashProofWebView()
                        setContentView(webView)
                    } catch (t: Throwable) {
                        Log.e(TAG, "Recovery error: ${t.message}")
                    }
                    return true // Handled safely! Android will NOT crash the app!
                }

                override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                    super.onReceivedError(view, request, error)
                    Log.w(TAG, "Web error: ${error?.description}")
                }
            }

            // WebChromeClient: GPS auto-grant & Camera/Document picker
            webChromeClient = object : WebChromeClient() {
                override fun onGeolocationPermissionsShowPrompt(
                    origin: String?,
                    callback: GeolocationPermissions.Callback?
                ) {
                    callback?.invoke(origin, true, false)
                }

                override fun onShowFileChooser(
                    webView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    fileUploadCallback?.onReceiveValue(null)
                    fileUploadCallback = filePathCallback

                    val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                        type = "*/*"
                        addCategory(Intent.CATEGORY_OPENABLE)
                    }
                    filePickerLauncher.launch(intent)
                    return true
                }
            }

            // Add Native Kotlin Bridge to JavaScript
            addJavascriptInterface(WebAppBridge(this@MainActivity), "AndroidNative")
            addJavascriptInterface(WebAppBridge(this@MainActivity), "OverlayLauncher")

            loadUrl(APP_URL)
        }
    }

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.destroy()
        }
        super.onDestroy()
    }

    // Native Bridge class accessible from JavaScript
    inner class WebAppBridge(private val context: Context) {

        @JavascriptInterface
        fun startBookingService(driverPhone: String?, apiBaseUrl: String?) {
            Log.i(TAG, "Bridge: startBookingService(phone=$driverPhone, url=$apiBaseUrl)")
            try {
                val serviceIntent = Intent(context, BookingPollService::class.java).apply {
                    if (!driverPhone.isNullOrEmpty()) putExtra("driver_phone", driverPhone)
                    if (!apiBaseUrl.isNullOrEmpty()) putExtra("api_base_url", apiBaseUrl)
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    try {
                        context.startForegroundService(serviceIntent)
                    } catch (t: Throwable) {
                        Log.w(TAG, "startForegroundService exception: ${t.message}, fallback to startService")
                        context.startService(serviceIntent)
                    }
                } else {
                    context.startService(serviceIntent)
                }
            } catch (t: Throwable) {
                Log.e(TAG, "Error starting booking service: ${t.message}")
            }
        }

        @JavascriptInterface
        fun stopBookingService() {
            Log.i(TAG, "Bridge: stopBookingService()")
            try {
                val serviceIntent = Intent(context, BookingPollService::class.java).apply {
                    action = BookingPollService.ACTION_STOP
                }
                context.stopService(serviceIntent)
            } catch (t: Throwable) {
                Log.e(TAG, "Error stopping booking service: ${t.message}")
            }
        }

        @JavascriptInterface
        fun canDrawOverlays(): Boolean {
            return OverlayHelper.canDrawOverlays(context)
        }

        @JavascriptInterface
        fun requestOverlayPermission() {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
                    val intent = Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:${context.packageName}")
                    ).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(intent)
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to open overlay permission settings: ${e.message}")
            }
        }

        @JavascriptInterface
        fun getPendingBooking(): String {
            val id = pendingBookingId ?: ""
            pendingBookingId = null
            return "{\"bookingId\": \"$id\"}"
        }

        @JavascriptInterface
        fun clearPendingBooking() {
            pendingBookingId = null
        }

        @JavascriptInterface
        fun bringToForeground() {
            try {
                val intent = Intent(context, MainActivity::class.java).apply {
                    addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK or
                                Intent.FLAG_ACTIVITY_SINGLE_TOP or
                                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                                Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                    )
                }
                context.startActivity(intent)
            } catch (ignored: Exception) {}
        }

        @JavascriptInterface
        fun showNotification(title: String, body: String, bookingId: String?) {
            Log.i(TAG, "Bridge: showNotification(title=$title, body=$body, bookingId=$bookingId)")
            try {
                SundarbanApp.createNotificationChannels(context)
                val safeBookingId = bookingId ?: ""
                val intent = Intent(context, MainActivity::class.java).apply {
                    action = "com.sundarbanriders.app.OPEN_BOOKING_$safeBookingId"
                    data = Uri.parse("sundarbanriders://booking/$safeBookingId")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    putExtra("booking_id", safeBookingId)
                    putExtra("auto_open_booking", true)
                }

                val piFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                } else {
                    PendingIntent.FLAG_UPDATE_CURRENT
                }

                val pendingIntent = PendingIntent.getActivity(
                    context,
                    safeBookingId.hashCode(),
                    intent,
                    piFlags
                )

                val notification = NotificationCompat.Builder(context, SundarbanApp.CHANNEL_ALERT)
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_CALL)
                    .setAutoCancel(true)
                    .setFullScreenIntent(pendingIntent, true)
                    .setContentIntent(pendingIntent)
                    .addAction(
                        android.R.drawable.ic_menu_send,
                        "🛺 রাইড দেখুন",
                        pendingIntent
                    )
                    .build()

                val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                val notifId = 9500 + (Math.abs(safeBookingId.hashCode()) % 500)
                nm?.notify(notifId, notification)
            } catch (t: Throwable) {
                Log.w(TAG, "Bridge showNotification error: ${t.message}")
            }
        }
    }
}
