# Proguard / R8 Optimization Rules for Sundarban Riders (Google Play Compliant)
-keepattributes JavascriptInterface,Annotation,*Annotation*,InnerClasses,EnclosingMethod,Signature

# 1. Preserve JavaScript Interface methods for WebView bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# 2. Preserve WebAppBridge so JavaScript can invoke native methods
-keep class com.sundarbanriders.app.MainActivity$WebAppBridge {
    <methods>;
}

# 3. Preserve Android entry point components
-keep class com.sundarbanriders.app.MainActivity { *; }
-keep class com.sundarbanriders.app.BookingPollService { *; }
-keep class com.sundarbanriders.app.OverlayHelper { *; }

# 4. Networking (OkHttp)
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
