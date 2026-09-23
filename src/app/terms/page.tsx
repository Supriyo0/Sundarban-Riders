import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — Sundarban Riders (সুন্দরবন রাইডার্স)',
  description: 'Terms of Service for Sundarban Riders Toto Booking and WhatsApp Dispatch platform.',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-2xl">
        <div className="border-b border-slate-800 pb-6 mb-6">
          <Link href="/" className="text-emerald-400 font-bold text-xl tracking-tight">
            সুন্দরবন রাইডার্স (Sundarban Riders)
          </Link>
          <h1 className="text-3xl font-extrabold text-white mt-2">Terms of Service</h1>
          <p className="text-sm text-slate-400 mt-1">Last updated: September 23, 2026</p>
        </div>

        <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Sundarban Riders services via WhatsApp or web, you agree to comply with and be bound by these Terms of Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. Intermediary Service Role</h2>
            <p>
              Sundarban Riders operates as a digital technology intermediary connecting independent toto (e-rickshaw) drivers with passengers across the Sundarban delta region. Sundarban Riders is not a direct transportation carrier.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. 3-Strike Booking Cancellation Policy</h2>
            <p>
              To ensure driver reliability, passengers who cancel confirmed bookings more than three (3) consecutive times may have their phone numbers temporarily suspended from booking new rides. Reinstatement can be requested via our helpline.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Fares &amp; Payments</h2>
            <p>
              Trip fares are computed using standard regional rates. Fare payments are made directly between the passenger and driver upon trip completion unless specified otherwise.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. Helpline &amp; Dispute Resolution</h2>
            <p>
              For grievances, ride issues, or assistance, contact our helpline at <strong>+91 8348122122</strong>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
