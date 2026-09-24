"use client";

import { useEffect, useRef } from "react";
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

  useEffect(() => {
    let isMounted = true;

    async function initRadarMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;
      const L = await import("leaflet");

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

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

      // 4 Nearby Live Toto Riders (Simulated within 500m - 2.5km)
      const nearbyOffsets = [
        { latOffset: 0.005, lngOffset: 0.004, number: "WB-96-T-8421", dist: "0.6 কিমি" },
        { latOffset: -0.006, lngOffset: 0.005, number: "WB-96-T-3120", dist: "0.9 কিমি" },
        { latOffset: 0.008, lngOffset: -0.007, number: "WB-96-T-7704", dist: "1.4 কিমি" },
        { latOffset: -0.009, lngOffset: -0.005, number: "WB-96-T-1955", dist: "1.8 কিমি" },
      ];

      nearbyOffsets.forEach((d) => {
        const driverLat = pickupCoords[0] + d.latOffset;
        const driverLng = pickupCoords[1] + d.lngOffset;

        const totoDriverIcon = L.divIcon({
          className: "toto-nearby-icon",
          html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%);">
              <div style="background: white; border: 1.5px solid #10b981; color: #065f46; font-weight: 800; font-size: 9px; padding: 1px 5px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.15); white-space: nowrap; margin-bottom: 2px;">
                🛺 ${d.number}
              </div>
              <div style="width: 32px; height: 32px; background: white; border: 2.5px solid #10b981; border-radius: 50%; box-shadow: 0 4px 10px rgba(16,185,129,0.4); display: flex; align-items: center; justify-content: center; font-size: 16px;">
                🛺
              </div>
            </div>
          `,
          iconSize: [0, 0],
        });

        L.marker([driverLat, driverLng], { icon: totoDriverIcon }).addTo(map);
      });

      // Fit bounds to show pickup and nearby drivers
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
  }, [pickupCoords, dropCoords, pickupName, dropName]);

  return (
    <div className="relative w-full h-full min-h-[320px] rounded-3xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100">
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Floating Animated Radar Badge */}
      <div className="absolute top-4 left-4 z-20 pointer-events-none">
        <div className="bg-white/95 backdrop-blur px-3.5 py-1.5 rounded-full shadow-lg border border-slate-200 flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-bold text-slate-800">
            নিকটস্থ ৪টি টোটো ট্র্যাকিং হচ্ছে
          </span>
        </div>
      </div>
    </div>
  );
}
