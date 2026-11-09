# Proguard rules for Sundarban Riders
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.sundarbanriders.app.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

