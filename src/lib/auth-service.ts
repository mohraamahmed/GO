import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { User, Session } from "@prisma/client";

const SESSION_DURATION_DAYS = 30;
const MAX_FAILED_ATTEMPTS = 5;
const MAX_IP_FAILED_ATTEMPTS = 15;
const LOCKOUT_MINUTES = 15;
const MAX_CONCURRENT_SESSIONS_PER_USER = 5;

/**
 * Validates and normalizes Egyptian phone numbers.
 * Supports:
 * - 010xxxxxxxx, 011xxxxxxxx, 012xxxxxxxx, 015xxxxxxxx
 * - +2010xxxxxxxx, +2011xxxxxxxx, etc.
 * - 2010xxxxxxxx, 002010xxxxxxxx
 * Returns normalized 11-digit string '01xxxxxxxxx' or null if invalid.
 */
export function normalizeEgyptianPhone(input: string): string | null {
  if (!input) return null;
  // Remove all non-digit characters except leading +
  let cleaned = input.trim().replace(/[\s\-\(\)]/g, "");

  // If starts with +20 or 0020 or 20
  if (cleaned.startsWith("+20")) {
    cleaned = "0" + cleaned.slice(3);
  } else if (cleaned.startsWith("0020")) {
    cleaned = "0" + cleaned.slice(4);
  } else if (cleaned.startsWith("20") && cleaned.length === 12) {
    cleaned = "0" + cleaned.slice(2);
  }

  // Must now be 11 digits starting with 010, 011, 012, or 015
  const regex = /^01[0125][0-9]{8}$/;
  if (regex.test(cleaned)) {
    return cleaned;
  }

  return null;
}

export function isValidEgyptianPhone(phone: string): boolean {
  return normalizeEgyptianPhone(phone) !== null;
}

/**
 * Password Policy: Minimum 8 characters, at least 1 letter and 1 number.
 */
export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < 8) {
    return { valid: false, message: "كلمة المرور يجب أن لا تقل عن 8 أحرف" };
  }
  if (!/[a-zA-Z\u0600-\u06FF]/.test(password)) {
    return { valid: false, message: "كلمة المرور يجب أن تحتوي على حرف واحد على الأقل" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "كلمة المرور يجب أن تحتوي على رقم واحد على الأقل" };
  }
  return { valid: true };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Dual-layer rate limiting: Account-level and IP-level throttling.
 */
export async function checkRateLimit(
  phoneNumber: string,
  ipAddress?: string
): Promise<{ allowed: boolean; remainingAttempts?: number; retryAfterMinutes?: number; reason?: string }> {
  const since = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000);

  // 1. Check IP-level spray attacks
  if (ipAddress) {
    const failedByIp = await prisma.loginAttempt.count({
      where: {
        ipAddress,
        success: false,
        createdAt: { gte: since },
      },
    });

    if (failedByIp >= MAX_IP_FAILED_ATTEMPTS) {
      return {
        allowed: false,
        retryAfterMinutes: LOCKOUT_MINUTES,
        reason: "IP_LOCKOUT",
      };
    }
  }

  // 2. Check Account-level targeted brute force
  const failedByPhone = await prisma.loginAttempt.count({
    where: {
      phoneNumber,
      success: false,
      createdAt: { gte: since },
    },
  });

  if (failedByPhone >= MAX_FAILED_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterMinutes: LOCKOUT_MINUTES,
      reason: "ACCOUNT_LOCKOUT",
    };
  }

  return {
    allowed: true,
    remainingAttempts: MAX_FAILED_ATTEMPTS - failedByPhone,
  };
}

export async function recordLoginAttempt(
  phoneNumber: string,
  ipAddress: string | undefined,
  success: boolean
): Promise<void> {
  try {
    await prisma.loginAttempt.create({
      data: {
        phoneNumber,
        ipAddress: ipAddress || null,
        success,
      },
    });
  } catch (err) {
    console.error("Failed to record login attempt:", err);
  }
}

export async function createSession(
  userId: string
): Promise<{ token: string; expiresAt: Date; session: Session }> {
  // 1. Session Limiting: keep only newest N active sessions per user
  try {
    const userSessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    if (userSessions.length >= MAX_CONCURRENT_SESSIONS_PER_USER) {
      const toDelete = userSessions.slice(MAX_CONCURRENT_SESSIONS_PER_USER - 1);
      await prisma.session.deleteMany({
        where: { id: { in: toDelete.map((s) => s.id) } },
      });
    }
  } catch (err) {
    console.error("Session limit cleanup warning:", err);
  }

  // 2. Generate high-entropy 256-bit cryptographically secure random session token
  const token = crypto.randomBytes(32).toString("hex");
  const sessionTokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      userId,
      sessionTokenHash,
      expiresAt,
    },
  });

  return { token, expiresAt, session };
}

export async function validateSession(
  rawToken: string
): Promise<{ user: User; session: Session } | null> {
  if (!rawToken || rawToken.length < 32) return null;

  const sessionTokenHash = hashToken(rawToken);

  const session = await prisma.session.findUnique({
    where: { sessionTokenHash },
    include: { user: true },
  });

  if (!session) return null;

  // Check expiration
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Check account status
  if (session.user.accountStatus !== "ACTIVE") {
    return null;
  }

  // Update last used periodically (every 1 hour)
  if (Date.now() - session.lastUsedAt.getTime() > 60 * 60 * 1000) {
    await prisma.session
      .update({
        where: { id: session.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {});
  }

  return {
    user: session.user,
    session,
  };
}

export async function revokeSession(rawToken: string): Promise<void> {
  if (!rawToken) return;
  const sessionTokenHash = hashToken(rawToken);
  await prisma.session.deleteMany({
    where: { sessionTokenHash },
  });
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId },
  });
}
