import { createServerFn } from "@tanstack/react-start";
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
    defaultPlan,
    plans: allActivePlans,
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
      base64Clean = base64Clean.split(",")[1];
    }
    const fileBuffer = Buffer.from(base64Clean, "base64");

    // Save receipt to private storage
    const uploadResult = await saveReceiptFile({
      filename: data.receiptFilename,
      mimeType: data.receiptMimeType,
      fileBuffer,
    });

    // Create payment request with database transaction
    const { payment, subscription } = await createPaymentRequest({
      userId: ctx.user.id,
      planId: data.planId,
      paymentMethod: data.paymentMethod,
      transactionReference: data.transactionReference,
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
          amount: payment.amount,
          reference: data.transactionReference,
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
        receipt: {
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
      payments,
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
