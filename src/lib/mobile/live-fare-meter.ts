import { calculateTotoFare, TotoPricingConfig, DEFAULT_TOTO_PRICING } from "@/lib/pricing/fare-calculator";

function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface LiveMeterReading {
  totalKm: number;
  liveFare: number;
  tripMinutes: number;
  currentSpeedKmh: number;
}

/**
 * High-precision GPS Odometer & Live Toto Fare Meter
 * Filters GPS jitter/drift and calculates strictly accurate cumulative road distance & dynamic fare.
 */
export class LiveFareMeter {
  private gpsPath: Array<{ lat: number; lng: number; ts: number }> = [];
  private totalKm: number = 0;
  private startTime: number = Date.now();
  private pricingConfig: TotoPricingConfig = DEFAULT_TOTO_PRICING;
  private passengerCount: number = 3;

  constructor(passengerCount: number = 3, config: TotoPricingConfig = DEFAULT_TOTO_PRICING, startTime?: Date | string) {
    this.passengerCount = Math.max(3, passengerCount);
    this.pricingConfig = config;
    if (startTime) {
      this.startTime = new Date(startTime).getTime();
    }
  }

  public setPricingConfig(config: TotoPricingConfig): void {
    this.pricingConfig = config;
  }

  public setPassengerCount(count: number): void {
    this.passengerCount = Math.max(3, count);
  }

  /**
   * Appends a real GPS coordinate reading to the cumulative trip path.
   * Discards jitter (< 5 meters) and teleport anomalies (> 500 meters per second).
   */
  public addGpsReading(lat: number, lng: number): LiveMeterReading {
    const now = Date.now();

    if (this.gpsPath.length > 0) {
      const prev = this.gpsPath[this.gpsPath.length - 1];
      const segKm = calculateHaversineKm(prev.lat, prev.lng, lat, lng);
      const timeDiffHrs = (now - prev.ts) / 3600000;

      // Filter: ignore if movement is < 5 meters (GPS station jitter while waiting at traffic)
      // And ignore unrealistic jumps (> 150 km/h for Toto)
      if (segKm >= 0.005 && segKm <= 0.6) {
        if (timeDiffHrs > 0) {
          const speedKmh = segKm / timeDiffHrs;
          if (speedKmh <= 120) {
            this.totalKm += segKm;
          }
        } else {
          this.totalKm += segKm;
        }
      }
    }

    this.gpsPath.push({ lat, lng, ts: now });
    return this.getReading();
  }

  public setManualDistance(km: number): LiveMeterReading {
    this.totalKm = Math.max(0, km);
    return this.getReading();
  }

  public getReading(): LiveMeterReading {
    const km = Math.round(this.totalKm * 100) / 100;
    const now = Date.now();
    const tripMinutes = Math.max(0, Math.floor((now - this.startTime) / 60000));

    // Calculate dynamic fare strictly using pricing configuration
    const fareResult = calculateTotoFare(
      km > 0 ? km : 1.0,
      this.passengerCount,
      this.pricingConfig,
      new Date(this.startTime)
    );

    let speed = 0;
    if (this.gpsPath.length >= 2) {
      const p2 = this.gpsPath[this.gpsPath.length - 1];
      const p1 = this.gpsPath[this.gpsPath.length - 2];
      const dist = calculateHaversineKm(p1.lat, p1.lng, p2.lat, p2.lng);
      const dt = (p2.ts - p1.ts) / 3600000;
      if (dt > 0) {
        speed = Math.min(60, Math.round(dist / dt));
      }
    }

    return {
      totalKm: km,
      liveFare: fareResult.totalFare,
      tripMinutes,
      currentSpeedKmh: speed,
    };
  }

  public getTotalKm(): number {
    return Math.round(this.totalKm * 100) / 100;
  }

  public getGpsPath(): Array<{ lat: number; lng: number }> {
    return this.gpsPath.map((p) => ({ lat: p.lat, lng: p.lng }));
  }

  public reset(): void {
    this.gpsPath = [];
    this.totalKm = 0;
    this.startTime = Date.now();
  }
}
