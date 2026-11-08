# Add project specific ProGuard / R8 rules here.

# Capacitor core and bridge
-keep public class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep public class * extends com.getcapacitor.Plugin { *; }
-keep public class * extends com.getcapacitor.BridgeActivity { *; }

# Sundarban Riders app package & background service
-keep public class com.sundarbanriders.app.** { *; }

# Keep all capacitor official plugins
-keep class com.capacitorjs.plugins.** { *; }
-keep interface com.capacitorjs.plugins.** { *; }

# Keep all annotations & reflection for Capacitor bridge
-keepattributes *Annotation*
-keepattributes JavascriptInterface
-keepattributes EnclosingMethod
-keepattributes InnerClasses
-keepattributes Signature
-keepattributes SourceFile,LineNumberTable

-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public *;
    @com.getcapacitor.annotation.CapacitorPlugin public *;
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve Cordova plugins if any
-keep public class org.apache.cordova.** { *; }
-keep public class * extends org.apache.cordova.CordovaPlugin { *; }

# Don't warn for optional dependencies
-dontwarn com.getcapacitor.**
-dontwarn com.capacitorjs.plugins.**
