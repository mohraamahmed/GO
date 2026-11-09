import { createServerFn } from "@tanstack/react-start";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "./prisma";
import {
  PAYMENT_CONFIG,
  getOrCreateDefaultPlan,
  getUserSubscriptionStatus,
  createPaymentRequest,
} from "./subscription-service";
import { saveReceiptFile } from "./storage-service";
import { requireAuthMiddleware, type AuthenticatedContext } from "./server-auth.server";

/**
 * Public/User: Get active plans & official payment info
 */
export const getSubscriptionInfoFn = createServerFn({ method: "GET" }).handler(async () => {
  const defaultPlan = await getOrCreateDefaultPlan();
  const allActivePlans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { price: "asc" },
  });

  return {
    officialPaymentNumber: PAYMENT_CONFIG.OFFICIAL_PAYMENT_NUMBER,
    supportedMethods: PAYMENT_CONFIG.SUPPORTED_METHODS,
    defaultPlan: { ...defaultPlan, price: Number(defaultPlan.price) },
    plans: allActivePlans.map((p) => ({ ...p, price: Number(p.price) })),
  };
});

const submitPaymentSchema = z.object({
  planId: z.string().optional(),
  paymentMethod: z.enum(["VODAFONE_CASH", "INSTAPAY"]),
  transactionReference: z.string().max(100).optional(),
  receiptFilename: z.string().min(1, "اسم ملف الإيصال مطلوب"),
  receiptMimeType: z.string().min(1, "نوع ملف الإيصال مطلوب"),
  receiptBase64: z.string().min(1, "بيانات الإيصال مطلوبة"),
});

/**
 * User: Submit Payment & Receipt
 */
export const submitSubscriptionPaymentFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator((data: unknown) => submitPaymentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthenticatedContext;

    // Decode base64 receipt
    let base64Clean = data.receiptBase64;
    if (base64Clean.includes(",")) {
      base64Clean = base64Clean.split(",")[1] || "";
    }
    const fileBuffer = Buffer.from(base64Clean, "base64");

    // Save receipt to private storage with magic-byte verification
    const uploadResult = await saveReceiptFile({
      filename: data.receiptFilename,
      mimeType: data.receiptMimeType,
      fileBuffer,
    });

    // Create payment request with database transaction
    const { payment, subscription } = await createPaymentRequest({
      userId: ctx.user.id,
      planId: data.planId || undefined,
      paymentMethod: data.paymentMethod,
      transactionReference: data.transactionReference || undefined,
      receipt: uploadResult,
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        actorId: ctx.user.id,
        targetUserId: ctx.user.id,
        action: "PAYMENT_SUBMITTED",
        entityType: "PAYMENT",
        entityId: payment.id,
        metadata: {
          paymentMethod: data.paymentMethod,
          amount: Number(payment.amount),
          reference: data.transactionReference,
          correlationId: crypto.randomUUID(),
        },
        ipAddress: ctx.clientIp || null,
      },
    });

    return {
      success: true,
      paymentId: payment.id,
      subscriptionId: subscription.id,
      message: "تم إرسال طلب الاشتراك بنجاح وهو الآن قيد المراجعة والاعتماد من الإدارة.",
    };
  });

/**
 * User: Get User Payment & Subscription History
 */
export const getMyPaymentsFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    const ctx = context as unknown as AuthenticatedContext;

    const payments = await prisma.payment.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        receipts: {
          select: {
            id: true,
            originalFilename: true,
            mimeType: true,
            fileSize: true,
            uploadedAt: true,
          },
        },
        subscription: {
          include: { plan: true },
        },
      },
    });

    const status = await getUserSubscriptionStatus(ctx.user.id);

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
        receipt: p.receipts[0]
          ? {
              id: p.receipts[0].id,
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
      currentStatus: status,
    };
  });

/**
 * User: Get User Notifications
 */
export const getMyNotificationsFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    const ctx = context as unknown as AuthenticatedContext;

    const notifications = await prisma.notification.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return { notifications };
  });

/**
 * User: Mark Notification as Read
 */
export const markNotificationReadFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthenticatedContext;

    await prisma.notification.updateMany({
      where: { id: data.id, userId: ctx.user.id },
      data: { isRead: true },
    });

    return { success: true };
  });

/**
 * User: View own uploaded receipt safely (Zero-Trust IDOR Prevention)
 */
export const getUserReceiptImageFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator((data: unknown) => z.object({ storageKey: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthenticatedContext;

    const receipt = await prisma.paymentReceipt.findUnique({
      where: { storageKey: data.storageKey },
      include: { payment: true },
    });

    if (!receipt) {
      throw new Error("سجل الإيصال غير موجود في النظام");
    }

    // Strict Ownership verification (IDOR protection)
    if (receipt.payment.userId !== ctx.user.id && ctx.user.role !== "ADMIN") {
      throw new Error("FORBIDDEN: غير مصرح لك باستعراض هذا الإيصال");
    }

    const { readReceiptFile } = await import("./storage-service");
    const file = await readReceiptFile(data.storageKey);
    if (!file) {
      throw new Error("ملف الإيصال غير متوفر على السيرفر");
    }

    const base64 = file.buffer.toString("base64");
    return {
      dataUrl: `data:${file.contentType};base64,${base64}`,
    };
  });
