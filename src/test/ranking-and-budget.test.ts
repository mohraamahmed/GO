import { describe, it, expect } from "vitest";
import {
  calculateBayesianRating,
  getCafeVerification,
  calculateBillWithFees,
  calculateCafeScoreWithFacilities,
  findSmartAlternatives,
  getCafeMenuData,
} from "../lib/ranking-and-budget";
import type { CafeListItem } from "../lib/cafes.functions";

describe("Bayesian Weighted Rating Algorithm", () => {
  it("pulls low review count cafes towards the Cairo benchmark mean (4.35)", () => {
    // 5.0 rating with only 1 review should NOT be treated as 5.0
    const bayesian = calculateBayesianRating(5.0, 1, 40, 4.35);
    expect(bayesian).toBeLessThan(4.45);
    expect(bayesian).toBeGreaterThan(4.35);
  });

  it("rewards cafes with hundreds of reviews close to their true rating", () => {
    // 4.8 rating with 500 reviews should stay close to 4.8
    const bayesian = calculateBayesianRating(4.8, 500, 40, 4.35);
    expect(bayesian).toBeGreaterThan(4.75);
    expect(bayesian).toBeLessThan(4.81);
  });

  it("handles extreme low ratings properly", () => {
    const bayesian = calculateBayesianRating(2.0, 100, 40, 4.35);
    expect(bayesian).toBeLessThan(3.0);
  });
});

describe("Egyptian Restaurant & Cafe Fees (VAT & Service)", () => {
  it("calculates 12% service and 14% VAT accurately", () => {
    const bill = calculateBillWithFees(100, { hasServiceCharge: true, hasVat: true });
    expect(bill.subtotal).toBe(100);
    expect(bill.serviceAmount).toBe(12); // 12% of 100
    // VAT is applied to subtotal + service (112 * 0.14 = 15.68 -> rounds to 16)
    expect(bill.vatAmount).toBe(16);
    expect(bill.grandTotal).toBe(128);
  });

  it("allows turning off service charge or VAT", () => {
    const noService = calculateBillWithFees(200, { hasServiceCharge: false, hasVat: true });
    expect(noService.serviceAmount).toBe(0);
    expect(noService.vatAmount).toBe(28); // 14% of 200
    expect(noService.grandTotal).toBe(228);

    const netOnly = calculateBillWithFees(200, { hasServiceCharge: false, hasVat: false });
    expect(netOnly.grandTotal).toBe(200);
  });
});

describe("Verification Status Determination", () => {
  it("marks well-reviewed cafes with photos and phone as verified", () => {
    const cafe: CafeListItem = {
      id: "c1",
      slug: "specialty-hub",
      name: "Specialty Hub",
      area: "الشيخ زايد",
      area_class: "sheikh_zayed",
      address: "Arkan Plaza",
      rating: 4.7,
      rating_count: 120,
      price_level: 2,
      photos: [{ url: "https://example.com/p1.jpg", by: ["Google Maps"] }],
      services: ["جلسات خارجية", "واي فاي"],
      category: "coffee_roastery",
      phone: "01000000000",
      website: "https://hub.com",
      maps_url: "https://maps.google.com",
      hours: ["08:00 - 00:00"],
      source: "Google Maps",
      verified_at: "2024-10-15T00:00:00Z",
    };

    const ver = getCafeVerification(cafe);
    expect(ver.status).toBe("verified");
    expect(ver.statusLabel).toContain("موثّق");
  });

  it("marks low review count cafes as unconfirmed", () => {
    const cafe: CafeListItem = {
      id: "c2",
      slug: "tiny-corner",
      name: "Tiny Corner",
      area: "التجمع",
      area_class: "fifth_settlement",
      address: null,
      rating: 4.0,
      rating_count: 5,
      price_level: 1,
      photos: [],
      services: [],
      category: null,
      phone: null,
      website: null,
      maps_url: null,
      hours: [],
      source: "Google Maps",
      verified_at: "2024-10-15T00:00:00Z",
    };

    const ver = getCafeVerification(cafe);
    expect(ver.status).toBe("unconfirmed");
  });
});

describe("Multi-Factor Scoring & Facilities", () => {
  const sampleCafe: CafeListItem = {
    id: "cafe-work",
    slug: "work-lounge",
    name: "Work Lounge Cafe",
    area: "التجمع الخامس",
    area_class: "fifth_settlement",
    address: "شارع التسعين",
    rating: 4.6,
    rating_count: 85,
    price_level: 2,
    photos: [{ url: "https://example.com/1.jpg", by: [] }],
    services: ["جلسات خارجية", "واي فاي", "مناسب للعمل"],
    category: "work",
    phone: "0111111111",
    website: null,
    maps_url: "https://maps.google.com",
    hours: ["09:00 - 23:00"],
    source: "Google Maps",
    verified_at: "2024-10-15T00:00:00Z",
  };

  it("calculates high match score for within-budget request with matched facilities", () => {
    const res = calculateCafeScoreWithFacilities(sampleCafe, 300, "combo", ["wifi", "outdoor"]);
    expect(res.matchScore).toBeGreaterThanOrEqual(80);
    expect(res.budgetStatus).toBe("within_budget");
    expect(res.missingFacilities.length).toBe(0);
  });

  it("penalizes and detects over-budget situation when budget is very small", () => {
    const res = calculateCafeScoreWithFacilities(sampleCafe, 50, "combo");
    expect(res.budgetStatus).toBe("over_budget");
    expect(res.badge).toContain("الميزانية");
  });
});

describe("Smart Alternatives Recommendation", () => {
  const mockCafes: CafeListItem[] = [
    {
      id: "c-cheap",
      slug: "cheap-cozy",
      name: "Cheap Cozy",
      area: "الشيخ زايد",
      area_class: "sheikh_zayed",
      address: null,
      rating: 4.5,
      rating_count: 60,
      price_level: 1,
      photos: [],
      services: ["جلسات خارجية", "واي فاي"],
      category: "coffee_roastery",
      phone: null,
      website: null,
      maps_url: null,
      hours: [],
      source: "Google Maps",
      verified_at: "2024-10-15T00:00:00Z",
    },
    {
      id: "c-expensive",
      slug: "luxury-spot",
      name: "Luxury Spot",
      area: "الشيخ زايد",
      area_class: "sheikh_zayed",
      address: null,
      rating: 4.8,
      rating_count: 200,
      price_level: 4,
      photos: [],
      services: ["جلسات خارجية"],
      category: null,
      phone: null,
      website: null,
      maps_url: null,
      hours: [],
      source: "Google Maps",
      verified_at: "2024-10-15T00:00:00Z",
    },
  ];

  it("suggests affordable alternatives in the same area", () => {
    const alts = findSmartAlternatives("c-expensive", mockCafes, 150, "drink", ["wifi"], 2);
    expect(alts.length).toBeGreaterThan(0);
    expect(alts[0]!.cafe.id).toBe("c-cheap");
    expect(alts[0]!.rationale).toContain("الميزانية");
  });
});

describe("Menu Data Generation and Scaling", () => {
  it("scales prices based on cafe price level", () => {
    const cheapMenu = getCafeMenuData({ price_level: 1 });
    const luxuryMenu = getCafeMenuData({ price_level: 4 });

    const cheapEspresso = cheapMenu.find((i) => i.id === "h1")!;
    const luxuryEspresso = luxuryMenu.find((i) => i.id === "h1")!;

    expect(luxuryEspresso.price).toBeGreaterThan(cheapEspresso.price);
  });
});
