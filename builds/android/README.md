# Sundarban Riders — Android App Builds (APK & AAB)

এই ফোল্ডারে সুন্দরবন রাইডার মোবাইল অ্যাপের সফলভাবে বিল্ড করা অ্যান্ড্রয়েড ফাইলগুলো প্রস্তুত রয়েছে:

---

### 📦 জেনারেট হওয়া ফাইলসমূহ:

1. **`builds/android/debug/SundarbanRiders-debug.apk`** (৫.৯৮ MB)
   - **সরাসরি ইনস্টলযোগ্য APK**: এটি যেকোনো অ্যান্ড্রয়েড মোবাইলে (Android 7.0 থেকে Android 15 পর্যন্ত) সরাসরি ট্রান্সফার বা ডাউনলোড করে ইনস্টল করে এখনই টেস্ট করা যাবে।

2. **`builds/android/release/SundarbanRiders-release.aab`** (৪.৮৩ MB)
   - **Google Play Store App Bundle**: গুগল প্লে কনসোলে (Google Play Console) Production বা Closed Testing ট্র্যাকে সরাসরি আপলোড করার অফিশিয়াল ফরম্যাট।
   - গুগল প্লে অ্যাপ সাইনিং (Google Play App Signing) ব্যবহার করলে এই `.aab` সরাসরি প্লে কনসোলে ড্র্যাগ-অ্যান্ড-ড্রপ করা যাবে।

3. **`builds/android/release/SundarbanRiders-release-unsigned.apk`** (৫.০০ MB)
   - **আনসাইন্ড রিলিজ APK**: প্রোডাকশন কীস্টোর দিয়ে সাইন করার জন্য প্রস্তুত APK।

---

### 📱 অ্যান্ড্রয়েড ফোনে সরাসরি টেস্ট করার উপায়:
1. `builds/android/debug/SundarbanRiders-debug.apk` ফাইলটি WhatsApp বা USB কেবলের মাধ্যমে মোবাইলে পাঠান।
2. ফোনে ফাইলটি ওপেন করে **"Install"** এ চাপ দিন (যদি অনুমতি চায় তবে *Install from unknown sources* অ্যাপ্রুভ করুন)।
3. অ্যাপটি চালু হলে লাইট থিম, জিপিএস লোকেশন পারমিশন, চালক/যাত্রী রোল সিলেকশন এবং WhatsApp OTP লগইন স্বয়ংক্রিয়ভাবে কাজ করবে।

---

### 🚀 Google Play Store-এ আপলোড করার নিয়ম:
1. [Google Play Console](https://play.google.com/console)-এ লগইন করুন।
2. **"Create App"** সিলেক্ট করুন এবং App Name দিন: `Sundarban Riders`।
3. **App Releases** -> **Production** -> **Create new release** এ যান।
4. `SundarbanRiders-release.aab` ফাইলটি আপলোড করুন।
5. রিলিজ নোটস ও অ্যাপ ডিটেইলস সেভ করে পাবলিশের জন্য সাবমিট করুন।
