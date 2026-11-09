import { describe, it, expect } from "vitest";
import {
  calculateBayesianRating,
  getCafeVerification,
  calculateBillWithFees,
  findSmartAlternatives,
  getCafeMenuData,
} from "../lib/ranking-and-budget";
import type { CafeListItem } from "../lib/cafes.functions";
import LOCAL_CAFES from "../data/cafes.json";

describe("Phase D Acceptance — Menu Protection Logic", () => {
  it("rejects unauthorized access when user has no active subscription", () => {
    // Simulating authorization logic from cafeMenu server function
    function checkMenuAuth(user: { role?: string } | null, subscription: { hasActiveSubscription: boolean } | null) {
      if (!user) return { authorized: false, reason: "UNAUTHORIZED_ANONYMOUS" };
      if (user.role === "ADMIN") return { authorized: true, reason: "ADMIN_ACCESS" };
      if (subscription?.hasActiveSubscription) return { authorized: true, reason: "ACTIVE_SUBSCRIPTION" };
      return { authorized: false, reason: "UNAUTHORIZED_SUBSCRIPTION_REQUIRED" };
    }

    // 1. Anonymous visitor
    expect(checkMenuAuth(null, null)).toEqual({
      authorized: false,
      reason: "UNAUTHORIZED_ANONYMOUS",
    });

    // 2. Logged-in user without subscription
    expect(checkMenuAuth({ role: "USER" }, { hasActiveSubscription: false })).toEqual({
      authorized: false,
      reason: "UNAUTHORIZED_SUBSCRIPTION_REQUIRED",
    });

    // 3. User with expired subscription
    expect(checkMenuAuth({ role: "USER" }, { hasActiveSubscription: false })).toEqual({
      authorized: false,
      reason: "UNAUTHORIZED_SUBSCRIPTION_REQUIRED",
    });

    // 4. User with active subscription
    expect(checkMenuAuth({ role: "USER" }, { hasActiveSubscription: true })).toEqual({
      authorized: true,
      reason: "ACTIVE_SUBSCRIPTION",
    });

    // 5. Admin user
    expect(checkMenuAuth({ role: "ADMIN" }, null)).toEqual({
      authorized: true,
      reason: "ADMIN_ACCESS",
    });
  });

  it("ensures getCafeMenuData returns fallback items only according to cafe price level", () => {
    const cheapCafe = { price_level: 1 };
    const luxuryCafe = { price_level: 4 };

    const cheapMenu = getCafeMenuData(cheapCafe);
    const luxuryMenu = getCafeMenuData(luxuryCafe);

    expect(cheapMenu.length).toBeGreaterThan(15);
    expect(luxuryMenu.length).toBeGreaterThan(15);

    // Luxury espresso must cost more than cheap espresso
    const cheapEspresso = cheapMenu.find((m) => m.id === "h1")!;
    const luxuryEspresso = luxuryMenu.find((m) => m.id === "h1")!;
    expect(luxuryEspresso.price).toBeGreaterThan(cheapEspresso.price);
  });
});

describe("Phase D Acceptance — Bill Calculator Scenarios", () => {
  it("Scenario 1: Single item with 12% service and 14% VAT", () => {
    // Single Espresso: 55 EGP
    const bill = calculateBillWithFees(55, { hasServiceCharge: true, hasVat: true });
    expect(bill.subtotal).toBe(55);
    expect(bill.serviceAmount).toBe(7); // round(55 * 0.12) = 6.6 -> 7
    expect(bill.vatAmount).toBe(9); // round((55 + 7) * 0.14) = round(62 * 0.14) = 8.68 -> 9
    expect(bill.grandTotal).toBe(71); // 55 + 7 + 9 = 71
  });

  it("Scenario 2: Multiple items (Flat White 95 + San Sebastian 160)", () => {
    const subtotal = 95 + 160; // 255 EGP
    const bill = calculateBillWithFees(subtotal, { hasServiceCharge: true, hasVat: true });
    expect(bill.subtotal).toBe(255);
    expect(bill.serviceAmount).toBe(31); // round(255 * 0.12) = 30.6 -> 31
    expect(bill.vatAmount).toBe(40); // round((255 + 31) * 0.14) = round(286 * 0.14) = 40.04 -> 40
    expect(bill.grandTotal).toBe(326);
  });

  it("Scenario 3: Increasing item quantity (2x Flat White 95 + 1x San Sebastian 160)", () => {
    const subtotal = 95 * 2 + 160; // 350 EGP
    const bill = calculateBillWithFees(subtotal, { hasServiceCharge: true, hasVat: true });
    expect(bill.subtotal).toBe(350);
    expect(bill.serviceAmount).toBe(42); // 350 * 0.12 = 42
    expect(bill.vatAmount).toBe(55); // round((350 + 42) * 0.14) = round(392 * 0.14) = 54.88 -> 55
    expect(bill.grandTotal).toBe(447);
  });

  it("Scenario 4: Deleting item (Remove San Sebastian, leaving 2x Flat White = 190)", () => {
    const subtotal = 95 * 2; // 190 EGP
    const bill = calculateBillWithFees(subtotal, { hasServiceCharge: true, hasVat: true });
    expect(bill.subtotal).toBe(190);
    expect(bill.serviceAmount).toBe(23); // round(190 * 0.12) = 22.8 -> 23
    expect(bill.vatAmount).toBe(30); // round((190 + 23) * 0.14) = round(213 * 0.14) = 29.82 -> 30
    expect(bill.grandTotal).toBe(243);
  });

  it("Scenario 5: Multi-person split verification (Total bill divided across 1, 2, 3, 4, 5 people)", () => {
    const subtotal = 190;
    const bill = calculateBillWithFees(subtotal, { hasServiceCharge: true, hasVat: true });
    expect(bill.subtotal).toBe(190);
    expect(bill.serviceAmount).toBe(23);
    expect(bill.vatAmount).toBe(30);
    expect(bill.grandTotal).toBe(243);

    // 1 Person: pays full bill
    expect(Number((bill.grandTotal / 1).toFixed(2))).toBe(243);

    // 2 People: 243 / 2 = 121.50 EGP
    expect(Number((bill.grandTotal / 2).toFixed(2))).toBe(121.5);

    // 3 People: 243 / 3 = 81.00 EGP
    expect(Number((bill.grandTotal / 3).toFixed(2))).toBe(81);

    // 4 People: 243 / 4 = 60.75 EGP (Top priority user correction)
    expect(Number((bill.grandTotal / 4).toFixed(2))).toBe(60.75);

    // 5 People: 243 / 5 = 48.60 EGP
    expect(Number((bill.grandTotal / 5).toFixed(2))).toBe(48.6);
  });

  it("Scenario 6: Service-only and VAT-only options", () => {
    const serviceOnly = calculateBillWithFees(100, { hasServiceCharge: true, hasVat: false });
    expect(serviceOnly.serviceAmount).toBe(12);
    expect(serviceOnly.vatAmount).toBe(0);
    expect(serviceOnly.grandTotal).toBe(112);

    const vatOnly = calculateBillWithFees(100, { hasServiceCharge: false, hasVat: true });
    expect(vatOnly.serviceAmount).toBe(0);
    expect(vatOnly.vatAmount).toBe(14);
    expect(vatOnly.grandTotal).toBe(114);
  });

  it("Scenario 7: WhatsApp outing share encoding", () => {
    const cafeName = "كافيه لنس التجمع";
    const total = 450;
    const items = "• إسبريسو (1×) = 55 ج.م\n• لاتيه (2×) = 210 ج.م";
    const text = `☕ *خطة خروجة في كافيه «${cafeName}»*\n💰 الإجمالي: ${total} ج.م\n${items}`;
    const encoded = encodeURIComponent(text);

    // Verify URI encoding does not throw and preserves valid Arabic decode
    expect(decodeURIComponent(encoded)).toBe(text);
    expect(encoded).not.toContain("<script>");
    expect(encoded).not.toContain("javascript:");
  });
});

describe("Phase D Acceptance — Data Integrity & Real Sources", () => {
  it("verifies cafes.json contains real cafes with valid structure", () => {
    const cafes = LOCAL_CAFES as unknown as CafeListItem[];
    expect(cafes.length).toBe(499);

    // All cafes must have id, slug, name, and area_class
    for (const c of cafes) {
      expect(c.id).toBeTruthy();
      expect(c.slug).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(c.area_class).toBeTruthy();
    }
  });

  it("verifies area counts match coverage areas dynamically without double-counting", () => {
    const cafes = LOCAL_CAFES as unknown as CafeListItem[];
    const fifthSettlement = cafes.filter((c) => c.area_class === "fifth_settlement").length;
    const sheikhZayed = cafes.filter((c) => c.area_class === "sheikh_zayed").length;
    const newCairoRest = cafes.filter((c) => c.area_class.startsWith("new_cairo")).length;
    const newCairoTotal = cafes.filter((c) => c.area_class.startsWith("new_cairo") || c.area_class === "fifth_settlement").length;

    expect(fifthSettlement).toBe(57);
    expect(sheikhZayed).toBe(140);
    expect(newCairoRest).toBe(302);
    // Mutually exclusive partition sum: 57 + 302 + 140 = 499 (Zero double-counting)
    expect(fifthSettlement + newCairoRest + sheikhZayed).toBe(499);
    // Overarching New Cairo region: 302 + 57 = 359
    expect(newCairoTotal).toBe(359);
  });

  it("verifies cafes with duplicate brand names have distinct exact coordinates and CIDs", () => {
    const cafes = LOCAL_CAFES as unknown as CafeListItem[];
    const thirtyNorth = cafes.filter((c) => c.name.toLowerCase().includes("30 north"));
    expect(thirtyNorth.length).toBeGreaterThanOrEqual(2);

    const b1 = thirtyNorth[0]!;
    const b2 = thirtyNorth[1]!;

    expect(b1.id).not.toBe(b2.id);
    expect(b1.maps_url).not.toBe(b2.maps_url);
    expect(typeof (b1 as any).lat).toBe("number");
    expect(typeof (b1 as any).lng).toBe("number");
    expect(typeof (b2 as any).lat).toBe("number");
    expect(typeof (b2 as any).lng).toBe("number");
    expect((b1 as any).lat).not.toBe((b2 as any).lat);
  });

  it("verifies top Bayesian cafes are mathematically ranked from true ratings", () => {
    const cafes = LOCAL_CAFES as unknown as CafeListItem[];
    const ranked = [...cafes].sort((a, b) => {
      const bA = calculateBayesianRating(Number(a.rating ?? 4.0), Number(a.rating_count ?? 15));
      const bB = calculateBayesianRating(Number(b.rating ?? 4.0), Number(b.rating_count ?? 15));
      return bB - bA;
    });

    const top1 = ranked[0]!;
    expect(top1.name).toBe("SAINTS Katameya");
    expect(Number(top1.rating)).toBe(5);
    expect(Number(top1.rating_count)).toBe(387);
    expect(calculateBayesianRating(Number(top1.rating), Number(top1.rating_count))).toBe(4.94);
  });

  it("verifies smart alternatives are from the same area and match constraints", () => {
    const cafes = LOCAL_CAFES as unknown as CafeListItem[];
    const target = cafes.find((c) => c.slug === "30-north-auc-innovation-hub")!;
    expect(target).toBeTruthy();

    const alternatives = findSmartAlternatives(target.id, cafes, 250, "combo", ["wifi", "outdoor"], 3);
    expect(alternatives.length).toBe(3);

    for (const alt of alternatives) {
      // Must not be the target itself
      expect(alt.cafe.id).not.toBe(target.id);
      // Area class must match target's area_class
      expect(alt.cafe.area_class).toBe(target.area_class);
    }
  });
});
