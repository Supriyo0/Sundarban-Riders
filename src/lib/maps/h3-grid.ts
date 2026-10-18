import * as h3 from "h3-js";

export interface HexCellInfo {
  cellId: string;
  boundary: [number, number][]; // [lat, lng][]
  center: [number, number];
  driverCount: number;
  isCenter: boolean;
}

/**
 * Computes an Uber-style H3 hexagonal grid around a given coordinate.
 * @param centerLat Center latitude
 * @param centerLng Center longitude
 * @param resolution H3 resolution (default 8, ~460m edge length / 0.73 km2)
 * @param ringRadius Number of rings around center (1 = 7 hexagons, 2 = 19 hexagons)
 * @param drivers List of active drivers with { latitude, longitude }
 */
export function getNearbyHexGrid(
  centerLat: number,
  centerLng: number,
  drivers: Array<{ latitude?: number | string; longitude?: number | string; lat?: number; lng?: number }> = [],
  resolution = 8,
  ringRadius = 1
): HexCellInfo[] {
  if (isNaN(centerLat) || isNaN(centerLng) || centerLat === 0 || centerLng === 0) {
    return [];
  }

  try {
    const centerCell = h3.latLngToCell(centerLat, centerLng, resolution);
    const diskCells = h3.gridDisk(centerCell, ringRadius);

    // Map drivers to their H3 cells for lightning-fast density lookup
    const driverCellCounts = new Map<string, number>();
    for (const d of drivers) {
      const dLat = Number(d.latitude ?? d.lat);
      const dLng = Number(d.longitude ?? d.lng);
      if (!isNaN(dLat) && !isNaN(dLng) && dLat !== 0 && dLng !== 0) {
        try {
          const dCell = h3.latLngToCell(dLat, dLng, resolution);
          driverCellCounts.set(dCell, (driverCellCounts.get(dCell) || 0) + 1);
        } catch {}
      }
    }

    const hexCells: HexCellInfo[] = [];

    for (const cellId of diskCells) {
      const boundary = h3.cellToBoundary(cellId); // Array of [lat, lng]
      const center = h3.cellToLatLng(cellId); // [lat, lng]
      const driverCount = driverCellCounts.get(cellId) || 0;

      hexCells.push({
        cellId,
        boundary: boundary as [number, number][],
        center: center as [number, number],
        driverCount,
        isCenter: cellId === centerCell,
      });
    }

    return hexCells;
  } catch (err) {
    console.warn("[h3-grid] Error calculating H3 hexagonal grid:", err);
    return [];
  }
}
