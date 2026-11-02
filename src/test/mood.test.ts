import { describe, it, expect } from "vitest";
import { moodScore, EMPTY_ATTRS, type AttrInput } from "@/lib/mood";

const attrs = (over: Partial<AttrInput>): AttrInput => ({ ...EMPTY_ATTRS, ...over });

describe("mood matching engine", () => {
  it("unknown data never scores positive for any mood", () => {
    for (const mood of ["quiet", "friends", "romantic", "relax", "work"] as const) {
      const { score, reasons } = moodScore(mood, EMPTY_ATTRS);
      expect(score).toBe(0);
      expect(reasons).toEqual([]);
    }
  });

  it("disputed and outdated data count as zero", () => {
    const a = attrs({ wifi_available: true, wifi_available_status: "disputed", power_outlets: true, power_outlets_status: "outdated" });
    expect(moodScore("work", a).score).toBe(0);
  });

  it("confirmed wifi + outlets beats user-reported for work mood", () => {
    const confirmed = attrs({ wifi_available: true, wifi_available_status: "confirmed", power_outlets: true, power_outlets_status: "owner_confirmed" });
    const reported = attrs({ wifi_available: true, wifi_available_status: "user_reported", power_outlets: true, power_outlets_status: "user_reported" });
    expect(moodScore("work", confirmed).score).toBeGreaterThan(moodScore("work", reported).score);
  });

  it("false flag (e.g. no outdoor seating) adds nothing", () => {
    const a = attrs({ outdoor_seating: false, outdoor_seating_status: "confirmed" });
    expect(moodScore("relax", a).score).toBe(0);
  });

  it("reasons only come from contributing confirmed data", () => {
    const a = attrs({ group_seating: true, group_seating_status: "confirmed", noise_level: null, noise_level_status: "unknown" });
    const { reasons } = moodScore("friends", a);
    expect(reasons).toEqual(["جلسات جماعية متاحة"]);
  });

  it("quiet mood rewards low confirmed noise, not high", () => {
    const calm = attrs({ noise_level: 1, noise_level_status: "confirmed" });
    const loud = attrs({ noise_level: 5, noise_level_status: "confirmed" });
    expect(moodScore("quiet", calm).score).toBeGreaterThan(moodScore("quiet", loud).score);
  });
});
