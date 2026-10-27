/**
 * Geo helpers for attendance QA. Computes coordinates inside the configured
 * office radius and a clearly-outside fallback (~3x radius north).
 */

export type Coord = { lat: number; lng: number };

export type OfficeGeo = {
  inside: Coord;
  outside: Coord;
  radiusMeters: number;
  source: "settings" | "fallback";
};

const METERS_PER_DEG_LAT = 111_320;

/**
 * Returns inside/outside coordinates derived from the configured office point.
 * Falls back to a deterministic Bangalore default if office coords are unset
 * (geo steps then warn-skip in the spec).
 */
export function deriveGeo(
  officeLat: number | null,
  officeLng: number | null,
  radiusMeters: number | null,
): OfficeGeo {
  const radius = radiusMeters && radiusMeters > 0 ? radiusMeters : 100;
  if (officeLat == null || officeLng == null) {
    return {
      inside: { lat: 12.9716, lng: 77.5946 },
      outside: { lat: 13.0, lng: 77.7 },
      radiusMeters: radius,
      source: "fallback",
    };
  }
  // outside = office + ~3x radius north
  const deltaLat = (radius * 3) / METERS_PER_DEG_LAT;
  return {
    inside: { lat: officeLat, lng: officeLng },
    outside: { lat: officeLat + deltaLat, lng: officeLng },
    radiusMeters: radius,
    source: "settings",
  };
}
