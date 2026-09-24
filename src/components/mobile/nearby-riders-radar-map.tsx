"use client";

import { useEffect, useRef, useState } from "react";
import { Smartphone, Globe, Navigation, ExternalLink } from "lucide-react";
import "leaflet/dist/leaflet.css";

interface NearbyRidersRadarMapProps {
  pickupCoords: [number, number];
  dropCoords: [number, number];
  pickupName: string;
  dropName: string;
}

export function NearbyRidersRadarMap({
  pickupCoords,
  dropCoords,
  pickupName,
  dropName,
}: NearbyRidersRadarMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const driverMarkersRef = useRef<any[]>([]);
  const [realDrivers, setRealDrivers] = useState<any[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [mapViewOption, setMapViewOption] = useState<"inbuilt" | "google">("inbuilt");

  // Poll real registered drivers from database
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    async function loadRealDrivers() {
      try {
        const res = await fetch("/api/drivers");
        const json = await res.json();
        if (json.drivers && Array.isArray(json.drivers)) {
          const valid = json.drivers.filter((d: any) => {
            const lat = Number(d.latitude);
            const lng = Number(d.longitude);
            return (
              d.name &&
              d.is_active !== false &&
              !isNaN(lat) &&
              lat !== 0 &&
              !isNaN(lng) &&
              lng !== 0
            );
          });
          setRealDrivers(valid);
        }
      } catch (err) {
        console.error("Error loading real drivers:", err);
      } finally {
        setLoadingDrivers(false);
      }
    }

    loadRealDrivers();
    pollInterval = setInterval(loadRealDrivers, 3500);

    return () => clearInterval(pollInterval);
  }, []);

  // 1. Initialize Leaflet Map ONCE
  useEffect(() => {
    let isMounted = true;

    async function initRadarMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      const L = await import("leaflet");

      // Create map centered on Pickup
      const map = L.map(mapContainerRef.current, {
        center: pickupCoords,
        zoom: 14,
        zoomControl: false,
      });

      // Google Maps Clean Roads Layer
      L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
        maxZoom: 20,
        attribution: "© Google Maps",
      }).addTo(map);

      // Radar Sonar 5km Geofence Circles
      L.circle(pickupCoords, {
        radius: 2000,
        color: "#10b981",
        weight: 1.5,
        dashArray: "4, 6",
        fillColor: "#10b981",
        fillOpacity: 0.08,
      }).addTo(map);

      L.circle(pickupCoords, {
        radius: 800,
        color: "#059669",
        weight: 1.5,
        fillColor: "#059669",
        fillOpacity: 0.12,
      }).addTo(map);

      // Green Pickup Marker with Radar Wave
      const greenPickupIcon = L.divIcon({
        className: "radar-pickup-pin",
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
            <div style="background: #10b981; color: white; font-weight: 800; font-size: 11px; padding: 2px 8px; border-radius: 9999px; box-shadow: 0 4px 6px rgba(0,0,0,0.2); white-space: nowrap; margin-bottom: 3px; border: 1.5px solid white;">
              📍 আপনি এখানে
            </div>
            <div style="position: relative; width: 28px; height: 28px; background: #059669; border: 3px solid white; border-radius: 50%; box-shadow: 0 4px 12px rgba(16,185,129,0.6); display: flex; align-items: center; justify-content: center;">
              <div style="width: 10px; height: 10px; background: white; border-radius: 50%;"></div>
            </div>
          </div>
        `,
        iconSize: [0, 0],
      });
      L.marker(pickupCoords, { icon: greenPickupIcon }).addTo(map);

      // Red Drop Marker
      const redDropIcon = L.divIcon({
        className: "radar-drop-pin",
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
            <div style="background: #ef4444; color: white; font-weight: 800; font-size: 11px; padding: 2px 8px; border-radius: 9999px; box-shadow: 0 4px 6px rgba(0,0,0,0.2); white-space: nowrap; margin-bottom: 3px; border: 1.5px solid white;">
              🏁 গন্তব্য
            </div>
            <div style="width: 24px; height: 24px; background: #dc2626; border: 3px solid white; border-radius: 50%; box-shadow: 0 4px 10px rgba(239,68,68,0.5); display: flex; align-items: center; justify-content: center;">
              <div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
            </div>
          </div>
        `,
        iconSize: [0, 0],
      });
      L.marker(dropCoords, { icon: redDropIcon }).addTo(map);

      // Route Line
      L.polyline([pickupCoords, dropCoords], {
        color: "#059669",
        weight: 4,
        dashArray: "6, 8",
        opacity: 0.8,
      }).addTo(map);

      // Fit bounds to show route cleanly
      const bounds = L.latLngBounds([pickupCoords, dropCoords]);
      map.fitBounds(bounds, { padding: [60, 60] });

      mapInstanceRef.current = map;
    }

    initRadarMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [pickupCoords, dropCoords]);

  // 2. Dynamically Update Driver Markers on existing map without recreating map
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    import("leaflet").then((L) => {
      driverMarkersRef.current.forEach((m) => m.remove());
      driverMarkersRef.current = [];

      if (realDrivers.length > 0) {
        realDrivers.forEach((driver) => {
          const lat = Number(driver.latitude);
          const lng = Number(driver.longitude);
          if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

          const totoDriverIcon = L.divIcon({
            className: "toto-real-driver-icon",
            html: `
              <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%);">
                <div style="background: white; border: 1.5px solid #10b981; color: #065f46; font-weight: 800; font-size: 9px; padding: 2px 7px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.15); white-space: nowrap; margin-bottom: 2px;">
                  🛺 ${driver.name || "টোটো চালক"} (${driver.toto_number || "WB-96"})
                </div>
                <div style="width: 32px; height: 32px; background: #ecfdf5; border: 2.5px solid #10b981; border-radius: 50%; box-shadow: 0 4px 10px rgba(16,185,129,0.3); display: flex; align-items: center; justify-content: center; font-size: 16px;">
                  🛺
                </div>
              </div>
            `,
            iconSize: [0, 0],
          });

          const m = L.marker([lat, lng], { icon: totoDriverIcon }).addTo(map);
          driverMarkersRef.current.push(m);
        });
      }
    });
  }, [realDrivers]);

  return (
    <div className="space-y-3">
      {/* 2-Option Switcher: View Inbuilt Map vs View in Google Maps */}
      <div
        className="p-1 rounded-2xl grid grid-cols-2 gap-1"
        style={{
          background: "rgba(241, 245, 249, 0.95)",
          border: "1px solid rgba(203, 213, 225, 0.8)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <button
          type="button"
          onClick={() => setMapViewOption("inbuilt")}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            mapViewOption === "inbuilt"
              ? "bg-white text-emerald-700 shadow-sm border border-emerald-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
          <span>📱 ইনবিল্ট ম্যাপ দেখুন</span>
        </button>

        <button
          type="button"
          onClick={() => setMapViewOption("google")}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            mapViewOption === "google"
              ? "bg-white text-blue-700 shadow-sm border border-blue-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-blue-600" />
          <span>🌐 গুগল ম্যাপে খুলুন</span>
        </button>
      </div>

      {mapViewOption === "inbuilt" ? (
        <div className="relative w-full h-[320px] rounded-3xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100">
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* Floating Animated Radar Badge */}
          <div className="absolute top-4 left-4 z-20 pointer-events-none">
            <div className="bg-white/95 backdrop-blur px-3.5 py-1.5 rounded-full shadow-lg border border-slate-200 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-slate-800">
                {realDrivers.length > 0
                  ? `${realDrivers.length} জন নিবন্ধিত চালক অনলাইনে নজরদারি করা হচ্ছে`
                  : "৫ কিমি রেডিয়াসে লাইভ রাডার স্ক্যান চলছে..."}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Google Maps View with Embed & Navigation */
        <div className="space-y-3">
          <div className="relative w-full h-[320px] rounded-3xl overflow-hidden border-2 border-blue-400 shadow-xl bg-slate-100">
            <iframe
              title="Google Map Search View"
              src={`https://maps.google.com/maps?q=${pickupCoords[0]},${pickupCoords[1]}&hl=bn&z=14&output=embed`}
              className="w-full h-full border-0"
              loading="lazy"
              allowFullScreen
            />
            {/* Overlay Navigation Button */}
            <div className="absolute bottom-3 left-3 right-3 z-20">
              <a
                href={`https://www.google.com/maps/dir/?api=1&origin=${pickupCoords[0]},${pickupCoords[1]}&destination=${dropCoords[0]},${dropCoords[1]}&travelmode=driving`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <Navigation className="w-4 h-4" />
                <span>🌐 গুগল ম্যাপস অ্যাপে পিকআপ ও গন্তব্য খুলুন</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
