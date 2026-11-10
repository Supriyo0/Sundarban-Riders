<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:supabase-egress-rules -->
# 🛡️ Supabase Quota & Egress Guard
* Keep project permanently within Supabase Free Tier (< 5 GB egress, < 1 GB log ingestion).
* In any polling loop (< 10s), NEVER use `select('*')`. Only select minimal required columns (`id, status, driver_lat, driver_lng, actual_distance_km, final_fare`). Never query `route_coordinates` or full feedback JSON in polling.
* Always enforce `document.hidden` guards so polling stops when app/browser is in background.
* Regularly report egress status to the user.
<!-- END:supabase-egress-rules -->
