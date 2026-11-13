package com.sundarbanriders.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
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
import androidx.core.app.NotificationManagerCompat
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat

class MainActivity : ComponentActivity() {

    companion object {
        private const val TAG = "MainActivity"
        private const val APP_URL = "https://sundarbanrider.in/app"
        private var pendingBookingId: String? = null

        // WebResourceError error codes
        private const val ERROR_UNKNOWN_URL_SCHEME = -10
        private const val ERROR_CONNECT = -6
        private const val ERROR_HOST_LOOKUP = -2
        private const val ERROR_TIMEOUT = -8
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

    override fun onResume() {
        super.onResume()
        try {
            NotificationManagerCompat.from(this).cancelAll()
        } catch (ignored: Exception) {}
    }

    private fun handleIncomingIntent(intent: Intent?) {
        if (intent == null) return
        try {
            NotificationManagerCompat.from(this).cancelAll()
        } catch (ignored: Exception) {}
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

            // Eliminates white flash on cold start by matching Sundarban theme green
            setBackgroundColor(0xFF064E3B.toInt())

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

            // CRASH-PROOF & SCHEME-PROOF WebViewClient
            webViewClient = object : WebViewClient() {
                override fun onRenderProcessGone(view: WebView?, detail: android.webkit.RenderProcessGoneDetail?): Boolean {
                    Log.w(TAG, "WebView render process gone! Recovering safely without crash. Did crash: ${detail?.didCrash()}")
                    try {
                        (view?.parent as? ViewGroup)?.removeView(view)
                        view?.destroy()
                        setupCrashProofWebView()
                        setContentView(webView)
                    } catch (t: Throwable) {
                        Log.e(TAG, "Recovery error: ${t.message}")
                    }
                    return true
                }

                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    val url = request?.url?.toString() ?: return false
                    return handleExternalUrl(url)
                }

                @Suppress("DEPRECATION")
                override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                    if (url == null) return false
                    return handleExternalUrl(url)
                }

                private fun handleExternalUrl(url: String): Boolean {
                    val uri = Uri.parse(url)
                    val scheme = uri.scheme?.lowercase() ?: ""
                    val host = uri.host?.lowercase() ?: ""

                    // 1. Google Maps & Navigation (open native Google Maps app or external browser)
                    if (scheme == "geo" || scheme == "google.navigation" ||
                        host.contains("maps.google") || (host.contains("google.com") && uri.path?.contains("/maps") == true) ||
                        url.contains("maps.app.goo.gl")) {
                        try {
                            val mapIntent = Intent(Intent.ACTION_VIEW, uri).apply {
                                setPackage("com.google.android.apps.maps")
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            }
                            startActivity(mapIntent)
                            return true
                        } catch (e: Exception) {
                            try {
                                val browserIntent = Intent(Intent.ACTION_VIEW, uri).apply {
                                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                }
                                startActivity(browserIntent)
                                return true
                            } catch (ignored: Exception) {}
                        }
                        return true
                    }

                    // 2. WhatsApp, Tel, Mailto, SMS, Intent
                    if (scheme == "whatsapp" || scheme == "intent" || scheme == "tel" || scheme == "mailto" || scheme == "sms" ||
                        url.contains("wa.me") || url.contains("api.whatsapp.com") || url.contains("chat.whatsapp.com")) {
                        try {
                            val intent = if (scheme == "intent") {
                                Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                            } else {
                                Intent(Intent.ACTION_VIEW, uri)
                            }
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            startActivity(intent)
                        } catch (e: Exception) {
                            Log.w(TAG, "Cannot launch external url: $url, err: ${e.message}")
                            try {
                                if (scheme == "whatsapp" || url.contains("whatsapp") || url.contains("wa.me")) {
                                    val playStoreIntent = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.whatsapp"))
                                    playStoreIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                    startActivity(playStoreIntent)
                                }
                            } catch (ignored: Exception) {}
                        }
                        return true // HANDLED! Do not attempt to load in WebView!
                    }

                    // 3. Catch-all: Any scheme that is NOT http/https should NEVER be loaded in WebView
                    if (scheme != "http" && scheme != "https") {
                        try {
                            val genericIntent = Intent(Intent.ACTION_VIEW, uri).apply {
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            }
                            startActivity(genericIntent)
                        } catch (e: Exception) {
                            Log.w(TAG, "Unhandled scheme: $scheme")
                        }
                        return true
                    }

                    return false // Let WebView load HTTP/HTTPS in-place
                }

                override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                    val reqUrl = request?.url?.toString() ?: ""
                    Log.w(TAG, "Web error: ${error?.description} (code ${error?.errorCode}) on $reqUrl")

                    // 1. Intercept unknown schemes (whatsapp://, geo://, etc.) so it NEVER replaces the webpage with ERR_UNKNOWN_URL_SCHEME!
                    if (error?.errorCode == ERROR_UNKNOWN_URL_SCHEME || reqUrl.startsWith("whatsapp:") || reqUrl.startsWith("intent:") ||
                        reqUrl.startsWith("geo:") || reqUrl.startsWith("google.navigation:")) {
                        handleExternalUrl(reqUrl)
                        if (view?.canGoBack() == true) {
                            view.goBack()
                        }
                        return
                    }

                    // 2. Offline cold-start fallback: Show beautiful branded Sundarban Riders offline card instead of browser dinosaur/error!
                    if (request?.isForMainFrame == true && (error?.errorCode == ERROR_CONNECT || error?.errorCode == ERROR_HOST_LOOKUP || error?.errorCode == ERROR_TIMEOUT)) {
                        Log.i(TAG, "Offline or VPS error detected on main frame; rendering branded offline card")
                        val offlineHtml = """
                            <!DOCTYPE html>
                            <html lang="bn">
                            <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                                <title>সুন্দরবন রাইডার্স — অফলাইন</title>
                                <style>
                                    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                                    body { background: #f8fafc; color: #0f172a; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; text-align: center; }
                                    .card { background: #ffffff; border-radius: 28px; padding: 32px 24px; width: 100%; max-width: 380px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
                                    .icon { width: 72px; height: 72px; margin: 0 auto 20px; background: #ecfdf5; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; }
                                    h1 { font-size: 20px; font-weight: 800; color: #065f46; margin-bottom: 8px; }
                                    p { font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 24px; }
                                    .btn { display: block; width: 100%; padding: 14px 20px; background: #059669; color: #ffffff; font-size: 14px; font-weight: 700; border-radius: 16px; border: none; cursor: pointer; text-decoration: none; box-shadow: 0 4px 12px rgba(5,150,105,0.25); }
                                    .btn:active { transform: scale(0.98); background: #047857; }
                                    .btn-call { margin-top: 10px; background: #f1f5f9; color: #334155; box-shadow: none; border: 1px solid #cbd5e1; }
                                    .status { margin-top: 20px; font-size: 11px; color: #94a3b8; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px; }
                                    .dot { width: 8px; height: 8px; background: #ef4444; border-radius: 50%; display: inline-block; animation: pulse 1.5s infinite; }
                                    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
                                </style>
                            </head>
                            <body>
                                <div class="card">
                                    <div class="icon">📡</div>
                                    <h1>ইন্টারনেট সংযোগ নেই</h1>
                                    <p>আপনার ফোনের মোবাইল ডেটা বা Wi-Fi সংযোগটি চালু করুন এবং পুনরায় চেষ্টা করুন।</p>
                                    <button class="btn" onclick="window.location.href='https://sundarbanrider.in/app'">🔄 পুনরায় চেষ্টা করুন</button>
                                    <a class="btn btn-call" href="tel:8348122122">📞 হেল্পলাইন: 8348122122</a>
                                    <div class="status">
                                        <span class="dot"></span> অফলাইন মোড সক্রিয় রয়েছে
                                    </div>
                                </div>
                            </body>
                            </html>
                        """.trimIndent()
                        view?.loadDataWithBaseURL("https://sundarbanrider.in", offlineHtml, "text/html", "UTF-8", null)
                    }
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
        fun openWhatsApp(phone: String, text: String) {
            Log.i(TAG, "Bridge: openWhatsApp(phone=$phone, text=$text)")
            try {
                val clean = phone.replace("+", "").replace(" ", "").trim()
                val encodedText = Uri.encode(text)
                val uri = Uri.parse("https://api.whatsapp.com/send?phone=$clean&text=$encodedText")
                val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                    setPackage("com.whatsapp")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
            } catch (e: Exception) {
                try {
                    val fallback = Intent(Intent.ACTION_VIEW, Uri.parse("https://api.whatsapp.com/send?phone=$phone&text=${Uri.encode(text)}")).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(fallback)
                } catch (err: Exception) {
                    Log.w(TAG, "Cannot launch WhatsApp: ${err.message}")
                }
            }
        }

        @JavascriptInterface
        fun requestNotificationPermission(): Boolean {
            val areEnabled = NotificationManagerCompat.from(context).areNotificationsEnabled()
            if (!areEnabled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                Handler(Looper.getMainLooper()).post {
                    requestPermissionsLauncher.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
                }
            }
            return areEnabled
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

                val soundUri = Uri.parse("android.resource://${context.packageName}/${R.raw.sundarban_alert_chime}")
                val logoBitmap = try {
                    BitmapFactory.decodeResource(context.resources, R.drawable.sundarban_logo)
                } catch (ignored: Exception) {
                    null
                } ?: BitmapFactory.decodeResource(context.resources, R.mipmap.ic_launcher)

                val builder = NotificationCompat.Builder(context, SundarbanApp.CHANNEL_ALERT)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setLargeIcon(logoBitmap)
                    .setColor(0xFF059669.toInt())
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(NotificationCompat.CATEGORY_EVENT)
                    .setAutoCancel(true)
                    .setTimeoutAfter(15000L) // Automatically dismiss from top shade after 15 seconds
                    .setSound(soundUri)
                    .setVibrate(longArrayOf(0, 450, 200, 450, 200, 600))
                    .setContentIntent(pendingIntent)
                    .addAction(
                        R.mipmap.ic_launcher,
                        "রাইড দেখুন",
                        pendingIntent
                    )

                val nm = NotificationManagerCompat.from(context)
                val notifId = 9500 + (Math.abs(safeBookingId.hashCode()) % 500)
                nm.notify(notifId, builder.build())
                Log.i(TAG, "Notification delivered successfully: notifId=$notifId, title=$title")
            } catch (t: Throwable) {
                Log.w(TAG, "Bridge showNotification error: ${t.message}", t)
            }
        }
    }
}
