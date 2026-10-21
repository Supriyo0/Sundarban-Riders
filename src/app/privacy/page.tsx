import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — Sundarban Riders (সুন্দরবন রাইডার্স)',
  description: 'Privacy Policy for Sundarban Riders Toto Booking and WhatsApp Dispatch platform.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-2xl">
        <div className="border-b border-slate-800 pb-6 mb-6">
          <Link href="/" className="text-emerald-400 font-bold text-xl tracking-tight">
            সুন্দরবন রাইডার্স (Sundarban Riders)
          </Link>
          <h1 className="text-3xl font-extrabold text-white mt-2">Privacy Policy</h1>
          <p className="text-sm text-slate-400 mt-1">Last updated: October 22, 2026 • Official Website: https://sundarbanrider.in</p>
        </div>

        <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Overview</h2>
            <p>
              Sundarban Riders (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates a Toto (E-Rickshaw) booking and driver dispatch service in the Sundarban delta region via our official website (https://sundarbanrider.in) and mobile platform. We respect your privacy and are committed to protecting your personal data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Precise Location Data:</strong> When you use our app to book a ride or operate as a driver, we collect precise real-time geographic location data (GPS coordinates, latitude, longitude, and route trajectory). This data is collected while the app is in use and during an active trip to facilitate real-time driver dispatch, live road routing, accurate fare calculation, and active trip navigation.</li>
              <li><strong>Contact Information:</strong> Phone number and display name provided during registration, booking, or customer support communication.</li>
              <li><strong>Ride Details:</strong> Pickup address, drop-off destination, route waypoints, trip distance, duration, fare, booking timestamps, and trip status.</li>
              <li><strong>Driver &amp; Vehicle Information:</strong> Driver name, verified phone number, vehicle registration number, and online/offline availability status.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. How We Use Your Information &amp; Location Data</h2>
            <p>
              We use the collected information and real-time location data strictly for the following core operational purposes:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Locating Nearest Toto Drivers:</strong> To display nearby available drivers on the map and calculate estimated time of arrival (ETA).</li>
              <li><strong>Live Road Navigation &amp; Turn-by-Turn Routing:</strong> To guide passengers and drivers along actual navigable roads and rural pathways in the Sundarban delta.</li>
              <li><strong>Accurate Metered Fare Calculation:</strong> To measure exact road route distance in kilometers and calculate fair, transparent fares based on approved rates.</li>
              <li><strong>Trip Safety &amp; Live Tracking:</strong> To allow passengers and drivers to monitor the active ride progress until reaching the drop destination.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Data Sharing &amp; Third-Party Services</h2>
            <p>
              We do not sell, rent, or trade your personal or location data to any advertisers or third-party brokers. Location coordinates are shared strictly between the matched passenger and driver for the duration of an active trip to enable pickup and navigation. Data infrastructure is hosted securely on our servers and Supabase database services strictly to fulfill ride dispatch.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. Data Retention &amp; Deletion</h2>
            <p>
              Users may request deletion of their account records, contact details, and ride history at any time by contacting our support helpline at <strong>8348122122</strong> or emailing support@sundarbanriders.com. Location telemetry collected during trips is pruned and stored only as summarized trip receipts.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">6. Contact Us</h2>
            <p>
              For questions regarding this Privacy Policy or your data, please contact:<br />
              <strong>Sundarban Riders Support</strong><br />
              Phone: +91 8348122122<br />
              Email: support@sundarbanriders.com<br />
              Location: Gosaba / Sundarban, West Bengal, India
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
