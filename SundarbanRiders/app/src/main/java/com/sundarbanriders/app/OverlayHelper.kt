package com.sundarbanriders.app

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView

object OverlayHelper {

    private const val TAG = "OverlayHelper"
    private var currentFloatingView: View? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    fun canDrawOverlays(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                Settings.canDrawOverlays(context)
            } catch (e: Exception) {
                false
            }
        } else {
            true
        }
    }

    fun showBookingOverlay(
        context: Context,
        bookingId: String,
        passengerName: String,
        pickup: String,
        drop: String,
        fare: String
    ) {
        if (!canDrawOverlays(context)) {
            Log.d(TAG, "Cannot draw overlays: permission not granted")
            return
        }

        mainHandler.post {
            try {
                val wm = context.getSystemService(Context.WINDOW_SERVICE) as? WindowManager ?: return@post
                dismissOverlay(context)

                val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                } else {
                    @Suppress("DEPRECATION")
                    WindowManager.LayoutParams.TYPE_PHONE
                }

                val params = WindowManager.LayoutParams(
                    WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    layoutType,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED,
                    PixelFormat.TRANSLUCENT
                ).apply {
                    gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
                    y = dp(context, 16)
                }

                // Main Card Container
                val card = LinearLayout(context).apply {
                    orientation = LinearLayout.VERTICAL
                    val pad = dp(context, 16)
                    setPadding(pad, pad, pad, pad)
                    val bg = GradientDrawable().apply {
                        setColor(0xFFFFFFFF.toInt())
                        cornerRadius = dp(context, 20).toFloat()
                        setStroke(dp(context, 2), 0xFFF59E0B.toInt()) // Amber border
                    }
                    background = bg
                    elevation = dp(context, 12).toFloat()
                }

                // Header Row: Title & Fare Badge
                val headerRow = LinearLayout(context).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                }

                val titleTv = TextView(context).apply {
                    text = "🚨 নতুন রাইডের অনুরোধ!"
                    setTextColor(0xFF0F172A.toInt())
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
                    typeface = Typeface.DEFAULT_BOLD
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                }
                headerRow.addView(titleTv)

                val fareBadge = TextView(context).apply {
                    text = "₹$fare"
                    setTextColor(0xFF059669.toInt()) // Emerald
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
                    typeface = Typeface.DEFAULT_BOLD
                    val padH = dp(context, 8)
                    val padV = dp(context, 3)
                    setPadding(padH, padV, padH, padV)
                    background = GradientDrawable().apply {
                        setColor(0xFFECFDF5.toInt())
                        cornerRadius = dp(context, 10).toFloat()
                    }
                }
                headerRow.addView(fareBadge)
                card.addView(headerRow)

                // Passenger Name
                val nameTv = TextView(context).apply {
                    text = "👤 যাত্রী: $passengerName"
                    setTextColor(0xFF334155.toInt())
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
                    typeface = Typeface.DEFAULT_BOLD
                    setPadding(0, dp(context, 6), 0, 0)
                }
                card.addView(nameTv)

                // Route
                val routeTv = TextView(context).apply {
                    text = "📍 $pickup ➔ $drop"
                    setTextColor(0xFF64748B.toInt())
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
                    setPadding(0, dp(context, 3), 0, dp(context, 10))
                }
                card.addView(routeTv)

                // Buttons Row
                val btnRow = LinearLayout(context).apply {
                    orientation = LinearLayout.HORIZONTAL
                }

                val dismissBtn = Button(context).apply {
                    text = "✕ বন্ধ করুন"
                    setTextColor(0xFF64748B.toInt())
                    setBackgroundColor(Color.TRANSPARENT)
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
                    layoutParams = LinearLayout.LayoutParams(0, dp(context, 44), 0.35f).apply {
                        setMargins(0, 0, dp(context, 8), 0)
                    }
                    setOnClickListener { dismissOverlay(context) }
                }
                btnRow.addView(dismissBtn)

                val acceptBtn = Button(context).apply {
                    text = "🛺 রাইড গ্রহণ করুন"
                    setTextColor(Color.WHITE)
                    background = GradientDrawable().apply {
                        setColor(0xFF10B981.toInt()) // Emerald green
                        cornerRadius = dp(context, 14).toFloat()
                    }
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
                    typeface = Typeface.DEFAULT_BOLD
                    layoutParams = LinearLayout.LayoutParams(0, dp(context, 44), 0.65f)
                    setOnClickListener {
                        dismissOverlay(context)
                        try {
                            val openIntent = Intent(context, MainActivity::class.java).apply {
                                action = "com.sundarbanriders.app.OPEN_BOOKING_$bookingId"
                                data = Uri.parse("sundarbanriders://booking/$bookingId")
                                addFlags(
                                    Intent.FLAG_ACTIVITY_NEW_TASK or
                                            Intent.FLAG_ACTIVITY_SINGLE_TOP or
                                            Intent.FLAG_ACTIVITY_CLEAR_TOP
                                )
                                putExtra("booking_id", bookingId)
                                putExtra("auto_open_booking", true)
                            }
                            context.startActivity(openIntent)
                        } catch (e: Exception) {
                            Log.w(TAG, "Failed to start MainActivity from overlay: ${e.message}")
                        }
                    }
                }
                btnRow.addView(acceptBtn)
                card.addView(btnRow)

                val rootLayout = FrameLayout(context).apply {
                    setPadding(dp(context, 12), dp(context, 6), dp(context, 12), dp(context, 6))
                    addView(card)
                }

                currentFloatingView = rootLayout
                wm.addView(rootLayout, params)

                // Auto dismiss after 28 seconds
                mainHandler.postDelayed({
                    if (currentFloatingView == rootLayout) {
                        dismissOverlay(context)
                    }
                }, 28000)

            } catch (t: Throwable) {
                Log.w(TAG, "Error displaying overlay: ${t.message}")
            }
        }
    }

    fun dismissOverlay(context: Context) {
        mainHandler.post {
            try {
                val wm = context.getSystemService(Context.WINDOW_SERVICE) as? WindowManager ?: return@post
                val view = currentFloatingView
                if (view != null && view.isAttachedToWindow) {
                    wm.removeViewImmediate(view)
                }
            } catch (t: Throwable) {
                // Ignore
            } finally {
                currentFloatingView = null
            }
        }
    }

    private fun dp(context: Context, value: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value.toFloat(),
            context.resources.displayMetrics
        ).toInt()
    }
}

