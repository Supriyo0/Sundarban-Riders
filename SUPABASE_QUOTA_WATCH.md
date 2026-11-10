# 🛡️ Supabase Quota & Egress Guard (Muscle Memory)

> **Core Objective:** Keep the Supabase project strictly within the **Free Tier Limits** forever:
> * **Egress (Data Transfer):** Must stay `< 5.0 GB / month` (Target: `< 200 MB / month`)
> * **API Log Ingestion:** Must stay `< 1.0 GB / month` (Target: `< 100 MB / month`)
> * **Database Size:** Must stay `< 500 MB`
> * **Monthly Active Users:** Must stay `< 50,000`

---

## 🚨 Strict Rules for Developers & AI Agents:

1. **NEVER use `select('*')` in High-Frequency Polling:**
   * Any loop or interval `< 10 seconds` MUST explicitly name only the required columns (e.g. `select('id, status, driver_lat, driver_lng, actual_distance_km, final_fare')`).
   * Never include `route_coordinates` (huge coordinate arrays) or large JSON blobs in polling loops.
2. **Always Use `document.hidden` Visibility Guards:**
   * Background polling MUST pause immediately when the user switches tabs, minimizes the app, or locks the phone screen.
3. **Use In-Memory Short Caching:**
   * Endpoints like `/api/bookings` cache identical responses for 1.5–2 seconds (`ID_CACHE_TTL`, `PENDING_CACHE_TTL`) to prevent spamming Supabase on rapid re-renders.
4. **Throttle Polling Intervals:**
   * Acceptance checks: 3 seconds (was 1.5s).
   * Active ride tracking: 3–4 seconds.
   * Admin dispatch page: 12 seconds (was 6s) and only when tab is visible.
5. **Continuous Quota Verification:**
   * Regularly inspect and report egress to ensure bandwidth stays near zero.

