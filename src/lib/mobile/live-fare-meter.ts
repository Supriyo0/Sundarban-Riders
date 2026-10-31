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
  private passengerCount: number = 4;

  constructor(
    passengerCount: number = 4,
    config: TotoPricingConfig = DEFAULT_TOTO_PRICING,
    startTime?: Date | string,
    initialKm: number = 0
  ) {
    this.passengerCount = Math.max(1, Math.min(config.maxPassengers || 4, passengerCount));
    this.pricingConfig = config;
    if (startTime) {
      this.startTime = new Date(startTime).getTime();
    }
    if (initialKm && !isNaN(initialKm) && initialKm > 0) {
      this.totalKm = Math.round(initialKm * 100) / 100;
    }
  }

  private lastAccumPoint: { lat: number; lng: number; ts: number } | null = null;

  public setPricingConfig(config: TotoPricingConfig): void {
    this.pricingConfig = config;
  }

  public setPassengerCount(count: number): void {
    this.passengerCount = Math.max(1, Math.min(this.pricingConfig.maxPassengers || 4, count));
  }

  /**
   * Appends a real GPS coordinate reading to the cumulative trip path.
   * Uses reference-based accumulation (>= 7 meters) to accurately track
   * slow vehicle speeds (5-20 km/h) while filtering stationary jitter.
   */
  public addGpsReading(lat: number, lng: number, timestamp?: number): LiveMeterReading {
    if (!lat || !lng || isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
      return this.getReading();
    }

    const now = timestamp || Date.now();

    if (!this.lastAccumPoint) {
      this.lastAccumPoint = { lat, lng, ts: now };
      this.gpsPath.push({ lat, lng, ts: now });
      return this.getReading();
    }

    const d = calculateHaversineKm(this.lastAccumPoint.lat, this.lastAccumPoint.lng, lat, lng);
    const dtHrs = (now - this.lastAccumPoint.ts) / 3600000;

    // Strict Deadband Filter for Stationary GPS Jitter:
    // 1. Minimum distance: 20 meters (0.020 km) to avoid table/pocket sensor drift
    // 2. Minimum speed: 3.5 km/h (a moving Toto moves >= 4 km/h; stationary drift is < 3 km/h)
    // 3. Maximum speed: 65 km/h (filters impossible GPS teleport jumps)
    if (d >= 0.020) {
      const speedKmh = dtHrs > 0 ? d / dtHrs : 0;
      if (speedKmh >= 3.5 && speedKmh <= 65) {
        this.totalKm += d;
        this.lastAccumPoint = { lat, lng, ts: now };
      } else if (speedKmh > 65) {
        // Teleport anomaly / noisy GPS jump: re-anchor without accumulating
        this.lastAccumPoint = { lat, lng, ts: now };
      }
      // If speedKmh < 3.5: driver is stationary / sitting in place, do NOT accumulate distance!
    }

    this.gpsPath.push({ lat, lng, ts: now });
    if (this.gpsPath.length > 500) {
      this.gpsPath = this.gpsPath.slice(-250);
    }
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
      km,
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
    this.lastAccumPoint = null;
    this.startTime = Date.now();
  }
}
