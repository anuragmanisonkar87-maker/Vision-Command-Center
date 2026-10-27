// Pure helpers for attendance geofence + work-seconds calculation.
// Browser-safe, no Supabase imports — easy to unit test.

export type LatLng = { lat: number; lng: number };

/**
 * Haversine distance between two coordinates, in meters.
 * Returns Infinity if any input is missing or non-finite.
 */
export function distanceMeters(a: LatLng | null | undefined, b: LatLng | null | undefined): number {
  if (!a || !b) return Infinity;
  if (![a.lat, a.lng, b.lat, b.lng].every((n) => Number.isFinite(n))) return Infinity;
  const R = 6371000; // earth radius (m)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export type CheckInDecision =
  | { allowed: true; locationStatus: "inside" | "not_required" | "no_office_set" }
  | { allowed: false; reason: string; locationStatus: "outside" | "denied" | "low_accuracy" };

export type CheckInInputs = {
  position: { lat: number; lng: number; accuracy?: number } | null;
  permissionDenied?: boolean;
  settings: {
    office_lat: number | null;
    office_lng: number | null;
    allowed_radius_meters: number;
    enable_location_required: boolean;
  };
  /** Reject if the device-reported accuracy is worse than this many meters. */
  maxAccuracyMeters?: number;
};

const DEFAULT_MAX_ACCURACY = 200;

/**
 * Decide whether a check-in should be allowed based on geolocation and admin settings.
 * Pure function — no side effects. Easy to test.
 */
export function decideCheckIn(input: CheckInInputs): CheckInDecision {
  const { position, permissionDenied, settings } = input;
  const maxAcc = input.maxAccuracyMeters ?? DEFAULT_MAX_ACCURACY;

  // No geofence configured. If location isn't required, allow.
  const officeSet =
    Number.isFinite(settings.office_lat) && Number.isFinite(settings.office_lng);

  if (!settings.enable_location_required) {
    if (!officeSet) return { allowed: true, locationStatus: "no_office_set" };
    if (!position) return { allowed: true, locationStatus: "no_office_set" };
    // We still compute distance below to report inside/outside.
  } else {
    if (permissionDenied) {
      return {
        allowed: false,
        reason: "Location permission is required to check in.",
        locationStatus: "denied",
      };
    }
    if (!position) {
      return {
        allowed: false,
        reason: "We couldn't read your location. Please try again.",
        locationStatus: "denied",
      };
    }
    if (!officeSet) {
      // Required but not configured — fail safe: allow but flag.
      return { allowed: true, locationStatus: "no_office_set" };
    }
    if (position.accuracy != null && position.accuracy > maxAcc) {
      return {
        allowed: false,
        reason: "Location accuracy is too low. Please try again.",
        locationStatus: "low_accuracy",
      };
    }
  }

  if (officeSet && position) {
    const d = distanceMeters(
      { lat: position.lat, lng: position.lng },
      { lat: settings.office_lat!, lng: settings.office_lng! },
    );
    if (d <= settings.allowed_radius_meters) {
      return { allowed: true, locationStatus: "inside" };
    }
    if (settings.enable_location_required) {
      return {
        allowed: false,
        reason: "You are outside the allowed office location radius.",
        locationStatus: "outside",
      };
    }
    // not required — allow but report outside
    return { allowed: true, locationStatus: "inside" };
  }

  return { allowed: true, locationStatus: "not_required" };
}

/** Seconds between check_in_at and check_out_at, clamped to >= 0. */
export function workSeconds(checkInIso: string | null, checkOutIso: string | null): number {
  if (!checkInIso || !checkOutIso) return 0;
  const a = new Date(checkInIso).getTime();
  const b = new Date(checkOutIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 1000));
}

export function formatWorkDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}
