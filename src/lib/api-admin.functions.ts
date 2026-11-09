import { createServerFn } from "@tanstack/react-start";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "./prisma";
import {
  getAdminAnalytics,
  approvePayment,
  rejectPayment,
  extendSubscription,
  cancelSubscription,
} from "./subscription-service";
import { revokeAllUserSessions } from "./auth-service";
import { readReceiptFile } from "./storage-service";
import { requireAdminMiddleware, type AuthenticatedContext } from "./server-auth.server";
import type { Role, AccountStatus, PaymentStatus } from "@prisma/client";

/**
 * Admin: Get SaaS Analytics Dashboard
 */
export const getAdminAnalyticsFn = createServerFn({ method: "GET" })
  .middleware([requireAdminMiddleware])
  .handler(async () => {
    return getAdminAnalytics();
  });

/**
 * Admin: List Users with Search and Pagination
 */
export const getAdminUsersFn = createServerFn({ method: "GET" })
  .middleware([requireAdminMiddleware])
  .validator((data: unknown) =>
    z.object({
      search: z.string().optional(),
      role: z.enum(["USER", "ADMIN"]).optional(),
      status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]).optional(),
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().max(100).default(20),
    }).optional().parse(data || {})
  )
  .handler(async ({ data }) => {
    const page = data?.page || 1;
    const pageSize = data?.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (data?.role) where.role = data.role;
    if (data?.status) where.accountStatus = data.status;
    if (data?.search) {
      where.OR = [
        { fullName: { contains: data.search, mode: "insensitive" } },
        { phoneNumber: { contains: data.search } },
        { email: { contains: data.search, mode: "insensitive" } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fullName: true,
          phoneNumber: true,
          email: true,
          role: true,
          accountStatus: true,
          createdAt: true,
          lastLoginAt: true,
          subscriptions: {
            where: { status: "ACTIVE" },
            orderBy: { endDate: "desc" },
            take: 1,
            select: { id: true, status: true, endDate: true },
          },
          _count: {
            select: { payments: true, subscriptions: true },
          },
        },
      }),
    ]);

    return {
      users: users.map((u) => {
        const sub = u.subscriptions[0];
        const isActive = u.subscriptions.length > 0 && (sub?.endDate ? sub.endDate > new Date() : false);
        const daysRemaining = sub?.endDate
          ? Math.max(0, Math.ceil((sub.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : 0;

        return {
          ...u,
          hasActiveSubscription: isActive,
          subscriptionEndDate: sub?.endDate || null,
          daysRemaining,
        };
      }),
      total,
      page,
      totalPages: Math.ceil(total / pageSize),
    };
  });

/**
 * Admin: Update User Account Status (Ban / Suspend / Activate)
 */
export const updateUserStatusFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .validator((data: unknown) =>
    z.object({
      userId: z.string().min(1),
      status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]),
      reason: z.string().optional(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthenticatedContext;

    if (data.userId === ctx.user.id) {
      throw new Error("لا يمكنك تعديل حالة حسابك الشخصي");
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!targetUser) throw new Error("المستخدم غير موجود");

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: data.userId },
        data: { accountStatus: data.status },
      });

      if (data.status !== "ACTIVE" && data.reason) {
        await tx.userRestriction.create({
          data: {
            userId: data.userId,
            restrictionType: data.status,
            reason: data.reason,
            createdBy: ctx.user.id,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: ctx.user.id,
          targetUserId: data.userId,
          action: `USER_STATUS_${data.status}`,
          entityType: "USER",
          entityId: data.userId,
          metadata: {
            previousStatus: targetUser.accountStatus,
            reason: data.reason,
            correlationId: crypto.randomUUID(),
          },
          ipAddress: ctx.clientIp || null,
        },
      });
    }, { maxWait: 15000, timeout: 30000 });

    // If banned or suspended, immediately revoke sessions
    if (data.status !== "ACTIVE") {
      await revokeAllUserSessions(data.userId);
    }

    return { success: true, message: `تم تحديث حالة المستخدم بنجاح إلى ${data.status}` };
  });

/**
 * Admin: Update User Role (Promote / Demote)
 */
export const updateUserRoleFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .validator((data: unknown) =>
    z.object({
      userId: z.string().min(1),
      role: z.enum(["USER", "ADMIN"]),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthenticatedContext;

    if (data.userId === ctx.user.id) {
      throw new Error("لا يمكنك تغيير رتبة حسابك الشخصي");
    }

    await prisma.user.update({
      where: { id: data.userId },
      data: { role: data.role },
    });

    await prisma.auditLog.create({
      data: {
        actorId: ctx.user.id,
        targetUserId: data.userId,
        action: `USER_ROLE_${data.role}`,
        entityType: "USER",
        entityId: data.userId,
        metadata: { newRole: data.role, correlationId: crypto.randomUUID() },
        ipAddress: ctx.clientIp || null,
      },
    });

    return { success: true, message: `تم تحديث رتبة المستخدم إلى ${data.role}` };
  });

/**
 * Admin: Get Payment Verification Queue
 */
export const getAdminPaymentsQueueFn = createServerFn({ method: "GET" })
  .middleware([requireAdminMiddleware])
  .validator((data: unknown) =>
    z.object({
      status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
    }).optional().parse(data || {})
  )
  .handler(async ({ data }) => {
    const status = data?.status;

    const payments = await (status
      ? prisma.payment.findMany({
          where: { status },
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: { id: true, fullName: true, phoneNumber: true, email: true },
            },
            receipts: true,
            subscription: {
              include: { plan: true },
            },
          },
        })
      : prisma.payment.findMany({
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: { id: true, fullName: true, phoneNumber: true, email: true },
            },
            receipts: true,
            subscription: {
              include: { plan: true },
            },
          },
        }));

    return {
      payments: payments.map((p) => ({
        id: p.id,
        userId: p.userId,
        amount: Number(p.amount),
        currency: p.currency,
        paymentMethod: p.paymentMethod,
        transactionReference: p.transactionReference,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        user: p.user,
        receipt: p.receipts[0]
          ? {
              id: p.receipts[0].id,
              storageKey: p.receipts[0].storageKey,
              originalFilename: p.receipts[0].originalFilename,
              mimeType: p.receipts[0].mimeType,
              fileSize: p.receipts[0].fileSize,
              uploadedAt: p.receipts[0].uploadedAt.toISOString(),
            }
          : null,
        subscription: p.subscription
          ? {
              id: p.subscription.id,
              userId: p.subscription.userId,
              planId: p.subscription.planId,
              status: p.subscription.status,
              startDate: p.subscription.startDate ? p.subscription.startDate.toISOString() : null,
              endDate: p.subscription.endDate ? p.subscription.endDate.toISOString() : null,
              plan: p.subscription.plan
                ? {
                    id: p.subscription.plan.id,
                    name: p.subscription.plan.name,
                    description: p.subscription.plan.description,
                    price: Number(p.subscription.plan.price),
                    currency: p.subscription.plan.currency,
                    durationDays: p.subscription.plan.durationDays,
                    isActive: p.subscription.plan.isActive,
                  }
                : null,
            }
          : null,
      })),
    };
  });

/**
 * Admin: Approve or Reject Payment (Idempotent Transaction)
 */
export const reviewPaymentFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .validator((data: unknown) =>
    z.object({
      paymentId: z.string().min(1),
      action: z.enum(["APPROVE", "REJECT"]),
      rejectionReason: z.string().optional(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthenticatedContext;

    if (data.action === "APPROVE") {
      const result = await approvePayment(data.paymentId, ctx.user.id);
      return {
        success: true,
        message: "تم اعتماد الدفع وتفعيل الاشتراك بنجاح",
        paymentId: result.payment.id,
      };
    } else {
      if (!data.rejectionReason) {
        throw new Error("يرجى كتابة سبب الرفض لتوضيحه للمستخدم");
      }
      const result = await rejectPayment(data.paymentId, ctx.user.id, data.rejectionReason);
      return {
        success: true,
        message: "تم رفض الدفع وتسجيل السبب بنجاح",
        paymentId: result.id,
      };
    }
  });

/**
 * Admin: Manually Extend User Subscription
 */
export const adminExtendSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .validator((data: unknown) =>
    z.object({
      userId: z.string().min(1),
      additionalDays: z.number().int().positive().max(365),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthenticatedContext;
    const subscription = await extendSubscription(data.userId, data.additionalDays, ctx.user.id);

    return {
      success: true,
      message: `تم تمديد الاشتراك بنجاح لمدة ${data.additionalDays} يوماً`,
      subscription,
    };
  });

/**
 * Admin: Activate or Cancel Subscription Directly
 */
export const adminToggleSubscriptionStatusFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .validator((data: unknown) =>
    z.object({
      userId: z.string().min(1),
      action: z.enum(["ACTIVATE", "CANCEL"]),
      days: z.number().int().positive().optional().default(30),
      reason: z.string().optional(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthenticatedContext;

    if (data.action === "CANCEL") {
      const activeSub = await prisma.subscription.findFirst({
        where: { userId: data.userId, status: "ACTIVE" },
        orderBy: { endDate: "desc" },
      });
      if (!activeSub) throw new Error("لا يوجد اشتراك نشط لهذا المستخدم لإلغائه");
      await cancelSubscription(activeSub.id, ctx.user.id, data.reason || "تم إيقاف الاشتراك يدوياً بواسطة الإدارة");
      return { success: true, message: "تم إلغاء الاشتراك وإيقاف الخدمة عن المستخدم بنجاح" };
    } else {
      // ACTIVATE
      const defaultPlan = await (await import("./subscription-service")).getOrCreateDefaultPlan();
      const now = new Date();
      const endDate = new Date(now.getTime() + (data.days || 30) * 24 * 60 * 60 * 1000);

      await prisma.subscription.create({
        data: {
          userId: data.userId,
          planId: defaultPlan.id,
          status: "ACTIVE",
          startDate: now,
          endDate,
          activatedAt: now,
        },
      });

      await prisma.notification.create({
        data: {
          userId: data.userId,
          title: "تم تفعيل اشتراكك!",
          message: `تم تفعيل اشتراكك يدوياً بواسطة الإدارة لمدة ${data.days} يوم حتى ${endDate.toLocaleDateString("ar-EG")}.`,
          type: "SUBSCRIPTION_ACTIVATED",
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: ctx.user.id,
          targetUserId: data.userId,
          action: "SUBSCRIPTION_MANUALLY_ACTIVATED",
          entityType: "Subscription",
          metadata: { days: data.days, endDate: endDate.toISOString() },
        },
      });

      return { success: true, message: `تم تفعيل الاشتراك بنجاح لمدة ${data.days} يوم` };
    }
  });

/**
 * Admin: View Receipt Image Securely
 */
export const adminGetReceiptImageFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .validator((data: unknown) => z.object({ storageKey: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    // 1. Verify existence and authenticity in PostgreSQL
    const receiptRecord = await prisma.paymentReceipt.findUnique({
      where: { storageKey: data.storageKey },
    });
    if (!receiptRecord) {
      throw new Error("سجل الإيصال غير مسجل في قاعدة البيانات");
    }

    const file = await readReceiptFile(data.storageKey);
    if (!file) {
      throw new Error("ملف الإيصال غير موجود على السيرفر");
    }

    const base64 = file.buffer.toString("base64");
    return {
      dataUrl: `data:${file.contentType};base64,${base64}`,
    };
  });
