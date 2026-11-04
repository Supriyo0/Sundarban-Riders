# Add project specific ProGuard / R8 rules here.

# Capacitor core and plugins
-keep public class com.getcapacitor.** { *; }
-keep public class * extends com.getcapacitor.Plugin { *; }
-keep public class * extends com.getcapacitor.BridgeActivity { *; }
-keep public class com.sundarbanriders.app.** { *; }

# Keep JavaScript Interfaces used by WebView bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve Cordova plugins if any
-keep public class org.apache.cordova.** { *; }
-keep public class * extends org.apache.cordova.CordovaPlugin { *; }

# Keep annotations, interfaces, line numbers for debugging
-keepattributes JavascriptInterface
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses
-keepattributes Signature
-keepattributes SourceFile,LineNumberTable
