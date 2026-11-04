import { describe, it, expect } from "vitest";
import {
  normalizeEgyptianPhone,
  isValidEgyptianPhone,
  hashPassword,
  verifyPassword,
  hashToken,
} from "../lib/auth-service";
import { PAYMENT_CONFIG } from "../lib/subscription-service";
import { saveReceiptFile } from "../lib/storage-service";

describe("Enterprise Security & Auth Suite", () => {
  describe("Egyptian Phone Normalization", () => {
    it("should normalize local 11-digit numbers", () => {
      expect(normalizeEgyptianPhone("01012345678")).toBe("01012345678");
      expect(normalizeEgyptianPhone("01112345678")).toBe("01112345678");
      expect(normalizeEgyptianPhone("01212345678")).toBe("01212345678");
      expect(normalizeEgyptianPhone("01512345678")).toBe("01512345678");
    });

    it("should normalize numbers with international +20 prefix", () => {
      expect(normalizeEgyptianPhone("+201012345678")).toBe("01012345678");
      expect(normalizeEgyptianPhone("00201012345678")).toBe("01012345678");
      expect(normalizeEgyptianPhone("201012345678")).toBe("01012345678");
    });

    it("should strip spaces, dashes, and parentheses", () => {
      expect(normalizeEgyptianPhone("010 1234 5678")).toBe("01012345678");
      expect(normalizeEgyptianPhone("+20-10-1234-5678")).toBe("01012345678");
      expect(normalizeEgyptianPhone("(010) 1234-5678")).toBe("01012345678");
    });

    it("should reject invalid numbers or non-Egyptian codes", () => {
      expect(normalizeEgyptianPhone("01312345678")).toBeNull(); // 013 is not mobile
      expect(normalizeEgyptianPhone("0101234567")).toBeNull(); // 10 digits (too short)
      expect(normalizeEgyptianPhone("010123456789")).toBeNull(); // 12 digits (too long)
      expect(normalizeEgyptianPhone("+966501234567")).toBeNull(); // Saudi number
      expect(normalizeEgyptianPhone("abcdefghijk")).toBeNull();
      expect(isValidEgyptianPhone("01012345678")).toBe(true);
      expect(isValidEgyptianPhone("invalid")).toBe(false);
    });
  });

  describe("Password Hashing & Argon2/Bcrypt Security", () => {
    it("should hash and verify passwords correctly", async () => {
      const rawPassword = "SuperSecurePassword123!";
      const hashed = await hashPassword(rawPassword);

      expect(hashed).not.toBe(rawPassword);
      expect(hashed.length).toBeGreaterThan(30);

      const isValid = await verifyPassword(rawPassword, hashed);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPassword("WrongPassword", hashed);
      expect(isInvalid).toBe(false);
    });
  });

  describe("Cryptographic Token Management", () => {
    it("should generate consistent SHA-256 token hashes for database lookup", () => {
      const token1 = "abcdef1234567890abcdef1234567890";
      const hash1 = hashToken(token1);
      const hash2 = hashToken(token1);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex string length
    });
  });

  describe("Subscription & Pricing Configuration", () => {
    it("should enforce official payment coordinates and price integrity", () => {
      expect(PAYMENT_CONFIG.OFFICIAL_PAYMENT_NUMBER).toBe("01005209667");
      expect(PAYMENT_CONFIG.DEFAULT_MONTHLY_PRICE).toBe(100);
      expect(PAYMENT_CONFIG.DEFAULT_DURATION_DAYS).toBe(30);
      expect(PAYMENT_CONFIG.DEFAULT_CURRENCY).toBe("EGP");
      expect(PAYMENT_CONFIG.SUPPORTED_METHODS).toContain("VODAFONE_CASH");
      expect(PAYMENT_CONFIG.SUPPORTED_METHODS).toContain("INSTAPAY");
    });
  });

  describe("Receipt File Validation & Storage Security", () => {
    it("should reject disallowed file types", async () => {
      const fakeExe = Buffer.from("MZ malicious file");
      await expect(
        saveReceiptFile({
          filename: "malware.exe",
          mimeType: "application/x-msdownload",
          fileBuffer: fakeExe,
        })
      ).rejects.toThrow("نوع الملف غير مسموح به");
    });

    it("should reject files exceeding 5MB", async () => {
      // 6MB buffer
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024);
      await expect(
        saveReceiptFile({
          filename: "huge.jpg",
          mimeType: "image/jpeg",
          fileBuffer: largeBuffer,
        })
      ).rejects.toThrow("حجم الصورة كبير جداً");
    });

    it("should accept and safely save valid image receipts with UUID storage key", async () => {
      const validImageBuffer = Buffer.from("FakeJPEGImageData");
      const result = await saveReceiptFile({
        filename: "receipt_vodafone.png",
        mimeType: "image/png",
        fileBuffer: validImageBuffer,
      });

      expect(result.storageKey).toBeDefined();
      expect(result.storageKey).toContain(".png");
      expect(result.mimeType).toBe("image/png");
      expect(result.fileSize).toBe(validImageBuffer.byteLength);
    });
  });
});
