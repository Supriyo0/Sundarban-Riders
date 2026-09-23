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
          <p className="text-sm text-slate-400 mt-1">Last updated: September 23, 2026</p>
        </div>

        <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Overview</h2>
            <p>
              Sundarban Riders (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates a Toto (E-Rickshaw) booking and driver dispatch service in the Sundarban delta region, facilitated through WhatsApp Business messaging and our web platform. We respect your privacy and are committed to protecting your personal data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Contact Information:</strong> Phone number and display name provided via WhatsApp when booking or registering as a driver.</li>
              <li><strong>Ride Details:</strong> Pickup and drop-off locations, booking timestamps, and trip status.</li>
              <li><strong>Driver Information:</strong> Driver name, phone number, vehicle registration number, and online/offline status.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. How We Use Your Information</h2>
            <p>
              We collect information solely to coordinate toto bookings, dispatch nearest available drivers, provide real-time WhatsApp updates, and manage customer service inquiries via our helpline (8348122122).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Data Sharing &amp; Third-Party Services</h2>
            <p>
              We do not sell, rent, or trade your personal data. Data is processed through Meta Platforms Inc. (WhatsApp Business Cloud API) and Supabase database services strictly to fulfill our communication and booking infrastructure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. Data Retention &amp; Deletion</h2>
            <p>
              Users may request deletion of their contact records and ride history at any time by contacting our support helpline at <strong>8348122122</strong> or emailing support@sundarbanriders.com.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">6. Contact Us</h2>
            <p>
              For questions regarding this Privacy Policy, please contact:<br />
              <strong>Sundarban Riders Support</strong><br />
              Phone: +91 8348122122<br />
              Location: Gosaba / Sundarban, West Bengal, India
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
