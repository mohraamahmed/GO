import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { prisma } from "./prisma";
import {
  normalizeEgyptianPhone,
  validatePasswordStrength,
  hashPassword,
  verifyPassword,
  createSession,
  validateSession,
  revokeSession,
  revokeAllUserSessions,
  checkRateLimit,
  recordLoginAttempt,
} from "./auth-service";
import { getUserSubscriptionStatus } from "./subscription-service";
import {
  requireAuthMiddleware,
  SESSION_COOKIE_NAME,
  type AuthenticatedContext,
} from "./server-auth.server";

const registerSchema = z
  .object({
    fullName: z.string().trim().max(100).optional(),
    phoneNumber: z.string().trim().min(10, "رقم الهاتف غير صالح"),
    password: z.string().min(8, "كلمة المرور يجب أن لا تقل عن 8 أحرف"),
    passwordConfirm: z.string().optional(),
    email: z.string().email("البريد الإلكتروني غير صالح").optional().or(z.literal("")),
  })
  .refine((data) => !data.passwordConfirm || data.password === data.passwordConfirm, {
    message: "كلمتا المرور غير متطابقتين",
    path: ["passwordConfirm"],
  })
  .refine((data) => validatePasswordStrength(data.password).valid, {
    message: "كلمة المرور يجب أن تحتوي على حرف واحد ورقم واحد على الأقل",
    path: ["password"],
  });

const loginSchema = z.object({
  phoneNumber: z.string().min(10, "رقم الهاتف غير صالح"),
  password: z.string().min(1, "يرجى إدخال كلمة المرور"),
});

/**
 * Public User Registration
 */
export const registerUserFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => registerSchema.parse(data))
  .handler(async ({ data }) => {
    const { setCookie } = await import("@tanstack/react-start/server");
    const normalizedPhone = normalizeEgyptianPhone(data.phoneNumber);
    if (!normalizedPhone) {
      throw new Error("رقم الهاتف المصري غير صحيح. يجب أن يبدأ بـ 010 أو 011 أو 012 أو 015 ويتكون من 11 رقماً.");
    }

    const existingUser = await prisma.user.findUnique({
      where: { phoneNumber: normalizedPhone },
    });

    if (existingUser) {
      throw new Error("رقم الهاتف هذا مسجل بالفعل. يرجى تسجيل الدخول أو استخدام رقم آخر.");
    }

    const passwordHash = await hashPassword(data.password);

    // First user or official admin phone automatically becomes ADMIN
    const totalUsers = await prisma.user.count();
    const isFirstUser = totalUsers === 0;
    const isOfficialAdminPhone = normalizedPhone === "01005209667";
    const role = (isFirstUser || isOfficialAdminPhone) ? "ADMIN" : "USER";

    const user = await prisma.user.create({
      data: {
        fullName: data.fullName?.trim() || "عضو كافيلينز",
        phoneNumber: normalizedPhone,
        passwordHash,
        role,
        accountStatus: "ACTIVE",
        email: data.email?.trim() || null,
      },
    });

    // Create session and set cookie
    const { token, expiresAt } = await createSession(user.id);
    const isProduction = process.env["NODE_ENV"] === "production";
    setCookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    return {
      success: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        role: user.role,
        accountStatus: user.accountStatus,
        createdAt: user.createdAt,
      },
    };
  });

/**
 * Public User Login
 */
export const loginUserFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => loginSchema.parse(data))
  .handler(async ({ data }) => {
    const { setCookie, getRequestIP } = await import("@tanstack/react-start/server");
    const clientIp = getRequestIP?.() || undefined;
    const normalizedPhone = normalizeEgyptianPhone(data.phoneNumber);

    if (!normalizedPhone) {
      throw new Error("رقم الهاتف غير صحيح. يرجى إدخال رقم هاتف مصري صالح (مثال: 01012345678)");
    }

    // Brute-force & rate-limiting check
    const rateLimit = await checkRateLimit(normalizedPhone, clientIp);
    if (!rateLimit.allowed) {
      throw new Error(`تم تجاوز عدد محاولات الدخول الخاطئة. تم قفل الحساب مؤقتاً لحمايته لمدة ${rateLimit.retryAfterMinutes} دقيقة.`);
    }

    const user = await prisma.user.findUnique({
      where: { phoneNumber: normalizedPhone },
    });

    if (!user) {
      await recordLoginAttempt(normalizedPhone, clientIp, false);
      throw new Error("رقم الهاتف أو كلمة المرور غير صحيحة.");
    }

    if (user.accountStatus === "BANNED") {
      throw new Error("تم حظر هذا الحساب من استخدام المنصة. يرجى التواصل مع الدعم الفني.");
    }

    if (user.accountStatus === "SUSPENDED") {
      throw new Error("هذا الحساب معلق مؤقتاً. يرجى مراجعة إدارة المنصة.");
    }

    const isPasswordValid = await verifyPassword(data.password, user.passwordHash);

    if (!isPasswordValid) {
      await recordLoginAttempt(normalizedPhone, clientIp, false);
      throw new Error("رقم الهاتف أو كلمة المرور غير صحيحة.");
    }

    // Successful login: record attempt & update last login
    await recordLoginAttempt(normalizedPhone, clientIp, true);
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { token, expiresAt } = await createSession(user.id);
    const isProduction = process.env["NODE_ENV"] === "production";
    setCookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    const subscriptionStatus = await getUserSubscriptionStatus(user.id);

    return {
      success: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        role: user.role,
        accountStatus: user.accountStatus,
      },
      subscription: subscriptionStatus,
    };
  });

/**
 * User Logout
 */
export const logoutUserFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const { getCookie, deleteCookie } = await import("@tanstack/react-start/server");
    const rawToken = getCookie(SESSION_COOKIE_NAME);
    if (rawToken) {
      await revokeSession(rawToken);
    }
    deleteCookie(SESSION_COOKIE_NAME, { path: "/" });
    return { success: true };
  });

/**
 * Get Current User Profile & Subscription Status
 */
export const getCurrentUserFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { getCookie, deleteCookie } = await import("@tanstack/react-start/server");
    const rawToken = getCookie(SESSION_COOKIE_NAME);
    if (!rawToken) {
      return { user: null, subscription: null };
    }

    const authResult = await validateSession(rawToken);
    if (!authResult) {
      deleteCookie(SESSION_COOKIE_NAME, { path: "/" });
      return { user: null, subscription: null };
    }

    const subscriptionStatus = await getUserSubscriptionStatus(authResult.user.id);

    return {
      user: {
        id: authResult.user.id,
        fullName: authResult.user.fullName,
        phoneNumber: authResult.user.phoneNumber,
        role: authResult.user.role,
        accountStatus: authResult.user.accountStatus,
        email: authResult.user.email,
        createdAt: authResult.user.createdAt,
      },
      subscription: subscriptionStatus,
    };
  });

/**
 * Change Password (Invalidates other sessions)
 */
export const changePasswordFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator((data: unknown) =>
    z.object({
      currentPassword: z.string().min(1, "يرجى إدخال كلمة المرور الحالية"),
      newPassword: z.string().min(8, "كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف"),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { setCookie } = await import("@tanstack/react-start/server");
    const ctx = context as unknown as AuthenticatedContext;
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.id },
    });

    if (!user) throw new Error("المستخدم غير موجود");

    const isMatch = await verifyPassword(data.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new Error("كلمة المرور الحالية غير صحيحة");
    }

    const strength = validatePasswordStrength(data.newPassword);
    if (!strength.valid) {
      throw new Error(strength.message || "كلمة المرور الجديدة غير مطابقة لمعايير الأمان");
    }

    const newHash = await hashPassword(data.newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    // Invalidate all other sessions for security
    await revokeAllUserSessions(user.id);

    // Create fresh session for current device
    const { token, expiresAt } = await createSession(user.id);
    const isProduction = process.env["NODE_ENV"] === "production";
    setCookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    return { success: true, message: "تم تغيير كلمة المرور بنجاح" };
  });
