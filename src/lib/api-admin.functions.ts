import { createServerFn } from "@tanstack/react-start";
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
      users: users.map((u) => ({
        ...u,
        hasActiveSubscription: u.subscriptions.length > 0 && (u.subscriptions[0]?.endDate ? u.subscriptions[0].endDate > new Date() : false),
        subscriptionEndDate: u.subscriptions[0]?.endDate || null,
      })),
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
          metadata: { previousStatus: targetUser.accountStatus, reason: data.reason },
          ipAddress: ctx.clientIp || null,
        },
      });
    });

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
        metadata: { newRole: data.role },
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

    const payments = await prisma.payment.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, fullName: true, phoneNumber: true, email: true },
        },
        receipt: true,
        subscription: {
          include: { plan: true },
        },
      },
    });

    return { payments };
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
        payment: result.payment,
      };
    } else {
      if (!data.rejectionReason) {
        throw new Error("يرجى كتابة سبب الرفض لتوضيحه للمستخدم");
      }
      const result = await rejectPayment(data.paymentId, ctx.user.id, data.rejectionReason);
      return {
        success: true,
        message: "تم رفض الدفع وتسجيل السبب بنجاح",
        payment: result,
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
 * Admin: View Receipt Image Securely
 */
export const adminGetReceiptImageFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .validator((data: unknown) => z.object({ storageKey: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const file = await readReceiptFile(data.storageKey);
    if (!file) {
      throw new Error("ملف الإيصال غير موجود على السيرفر");
    }

    const base64 = file.buffer.toString("base64");
    return {
      dataUrl: `data:${file.contentType};base64,${base64}`,
    };
  });
