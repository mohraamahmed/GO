import { describe, it, expect } from "vitest";
import {
  normalizeEgyptianPhone,
  isValidEgyptianPhone,
  validatePasswordStrength,
  hashPassword,
  verifyPassword,
  hashToken,
} from "../lib/auth-service";
import { PAYMENT_CONFIG } from "../lib/subscription-service";
import {
  saveReceiptFile,
  detectFileTypeFromMagicBytes,
  readReceiptFile,
} from "../lib/storage-service";

describe("Enterprise Security & Auth Suite", () => {
  describe("Egyptian Phone Normalization & Input Sanitization", () => {
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

  describe("Password Policy & Complexity", () => {
    it("should reject passwords shorter than 8 characters", () => {
      expect(validatePasswordStrength("Pass1").valid).toBe(false);
    });

    it("should reject passwords without numbers", () => {
      expect(validatePasswordStrength("PasswordWithoutNumbers").valid).toBe(false);
    });

    it("should reject passwords without letters", () => {
      expect(validatePasswordStrength("1234567890").valid).toBe(false);
    });

    it("should accept strong passwords with letters and numbers", () => {
      expect(validatePasswordStrength("SecurePass2026!").valid).toBe(true);
      expect(validatePasswordStrength("CaféLens010052").valid).toBe(true);
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
    }, 15000);
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

  describe("Receipt File Security & Magic-Bytes Validation", () => {
    it("should accurately detect valid PNG magic headers", () => {
      // 89 50 4E 47 0D 0A 1A 0A
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      const detected = detectFileTypeFromMagicBytes(pngHeader);
      expect(detected).not.toBeNull();
      expect(detected?.mimeType).toBe("image/png");
      expect(detected?.extension).toBe(".png");
    });

    it("should accurately detect valid JPEG magic headers", () => {
      // FF D8 FF
      const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      const detected = detectFileTypeFromMagicBytes(jpegHeader);
      expect(detected).not.toBeNull();
      expect(detected?.mimeType).toBe("image/jpeg");
      expect(detected?.extension).toBe(".jpg");
    });

    it("should accurately detect valid WEBP magic headers", () => {
      // RIFF (bytes 0-3) + WEBP (bytes 8-11)
      const webpHeader = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20
      ]);
      const detected = detectFileTypeFromMagicBytes(webpHeader);
      expect(detected).not.toBeNull();
      expect(detected?.mimeType).toBe("image/webp");
      expect(detected?.extension).toBe(".webp");
    });

    it("should reject malicious disguised payloads (e.g. Executable or HTML disguised as PNG)", async () => {
      // Disguised Windows MZ PE executable
      const fakeExecutable = Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff");
      await expect(
        saveReceiptFile({
          filename: "innocent.png",
          mimeType: "image/png",
          fileBuffer: fakeExecutable,
        })
      ).rejects.toThrow("محتوى الملف غير صالح أو تالف");

      // Disguised HTML / script payload
      const scriptPayload = Buffer.from("<script>alert('xss')</script>");
      await expect(
        saveReceiptFile({
          filename: "receipt.jpg",
          mimeType: "image/jpeg",
          fileBuffer: scriptPayload,
        })
      ).rejects.toThrow("محتوى الملف غير صالح أو تالف");
    });

    it("should reject files exceeding 5MB size limit", async () => {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024);
      await expect(
        saveReceiptFile({
          filename: "huge.jpg",
          mimeType: "image/jpeg",
          fileBuffer: largeBuffer,
        })
      ).rejects.toThrow("حجم الصورة كبير جداً");
    });

    it("should safely accept genuine image buffers and generate randomized UUID keys", async () => {
      const validPng = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52
      ]);
      const result = await saveReceiptFile({
        filename: "my_vodafone_transfer.png",
        mimeType: "image/png",
        fileBuffer: validPng,
      });

      expect(result.storageKey).toBeDefined();
      expect(result.storageKey).toMatch(/^[0-9a-f\-]+\.png$/i);
      expect(result.mimeType).toBe("image/png");
    });

    it("should prevent Path Traversal attacks when reading files", async () => {
      expect(await readReceiptFile("../../../etc/passwd")).toBeNull();
      expect(await readReceiptFile("..\\..\\windows\\win.ini")).toBeNull();
      expect(await readReceiptFile("arbitrary-name.txt")).toBeNull();
    });
  });
});
