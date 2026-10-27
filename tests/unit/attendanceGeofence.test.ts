import { describe, it, expect } from "vitest";
import {
  distanceMeters,
  decideCheckIn,
  workSeconds,
  formatWorkDuration,
} from "@/lib/attendance/geofence";

describe("distanceMeters", () => {
  it("returns ~0 for same point", () => {
    expect(distanceMeters({ lat: 12.97, lng: 77.59 }, { lat: 12.97, lng: 77.59 })).toBeLessThan(1);
  });
  it("computes ~111km per degree of latitude", () => {
    const d = distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });
  it("returns Infinity for missing input", () => {
    expect(distanceMeters(null, { lat: 1, lng: 1 })).toBe(Infinity);
  });
});

const office = {
  office_lat: 12.9716,
  office_lng: 77.5946,
  allowed_radius_meters: 100,
  enable_location_required: true,
};

describe("decideCheckIn", () => {
  it("allows when inside radius", () => {
    const r = decideCheckIn({
      position: { lat: 12.9716, lng: 77.5946, accuracy: 10 },
      settings: office,
    });
    expect(r.allowed).toBe(true);
    expect(r.locationStatus).toBe("inside");
  });
  it("blocks when outside radius", () => {
    const r = decideCheckIn({
      position: { lat: 13.0, lng: 77.7, accuracy: 10 },
      settings: office,
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.locationStatus).toBe("outside");
  });
  it("blocks when location required but permission denied", () => {
    const r = decideCheckIn({
      position: null,
      permissionDenied: true,
      settings: office,
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.locationStatus).toBe("denied");
  });
  it("blocks when accuracy too low", () => {
    const r = decideCheckIn({
      position: { lat: 12.9716, lng: 77.5946, accuracy: 9999 },
      settings: office,
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.locationStatus).toBe("low_accuracy");
  });
  it("allows when location not required and no office set", () => {
    const r = decideCheckIn({
      position: null,
      settings: { office_lat: null as any, office_lng: null as any, allowed_radius_meters: 100, enable_location_required: false },
    });
    expect(r.allowed).toBe(true);
  });
  it("allows when location not required even if outside radius", () => {
    const r = decideCheckIn({
      position: { lat: 13.5, lng: 77.9, accuracy: 10 },
      settings: { ...office, enable_location_required: false },
    });
    expect(r.allowed).toBe(true);
  });
});

describe("workSeconds", () => {
  it("computes positive seconds between in/out", () => {
    const a = "2026-06-13T09:00:00Z";
    const b = "2026-06-13T17:30:00Z";
    expect(workSeconds(a, b)).toBe(8 * 3600 + 30 * 60);
  });
  it("returns 0 for missing inputs", () => {
    expect(workSeconds(null, null)).toBe(0);
    expect(workSeconds("2026-06-13T09:00:00Z", null)).toBe(0);
  });
  it("clamps negative to 0", () => {
    expect(workSeconds("2026-06-13T17:00:00Z", "2026-06-13T09:00:00Z")).toBe(0);
  });
});

describe("formatWorkDuration", () => {
  it("formats HH:MM:SS", () => {
    expect(formatWorkDuration(3661)).toBe("01:01:01");
    expect(formatWorkDuration(0)).toBe("00:00:00");
  });
});
