import { prisma } from "./prisma";
import type { Subscription, Payment, SubscriptionStatus, PaymentStatus } from "@prisma/client";

export const DB_TRANSACTION_OPTIONS = {
  maxWait: 15000,
  timeout: 30000,
};

export const PAYMENT_CONFIG = {
  OFFICIAL_PAYMENT_NUMBER: "01005209667",
  SUPPORTED_METHODS: ["VODAFONE_CASH", "INSTAPAY"] as const,
  DEFAULT_MONTHLY_PRICE: 100,
  DEFAULT_DURATION_DAYS: 30,
  DEFAULT_CURRENCY: "EGP",
};

export const DEFAULT_PLANS_SEED = [
  {
    name: "اشتراك شهر",
    description: "وصول كامل وشامل لجميع أدوات كافيه لنس وحاسبة الميزانية وخدمات الـ VIP لمدة 30 يوماً",
    price: 100,
    durationDays: 30,
  },
  {
    name: "اشتراك شهرين",
    description: "باقة الـ 60 يوماً مع كافة المزايا المتقدمة وإمكانية استكشاف وتخصيص الخروجات",
    price: 200,
    durationDays: 60,
  },
  {
    name: "اشتراك 3 شهور",
    description: "باقة ربع سنوية مميزة (90 يوماً) لتجربة متكاملة بدون أي قيود",
    price: 280,
    durationDays: 90,
  },
  {
    name: "اشتراك سنوي (VIP)",
    description: "باقة العام الكامل (365 يوماً) بأعلى توفير مع كامل التحديثات والميزات الحصرية",
    price: 1000,
    durationDays: 365,
  },
];

/**
 * Ensures the default subscription plans exist in the database.
 */
export async function getOrCreateDefaultPlan() {
  const existing = await prisma.subscriptionPlan.findFirst({
    where: { isActive: true },
    orderBy: { price: "asc" },
  });

  if (existing) return existing;

  // Seed all plans
  for (const p of DEFAULT_PLANS_SEED) {
    await prisma.subscriptionPlan.create({
      data: {
        name: p.name,
        description: p.description,
        price: p.price,
        currency: PAYMENT_CONFIG.DEFAULT_CURRENCY,
        durationDays: p.durationDays,
        isActive: true,
      },
    });
  }

  return (await prisma.subscriptionPlan.findFirst({
    where: { isActive: true },
    orderBy: { price: "asc" },
  }))!;
}

/**
 * Checks if a user has an active, valid subscription.
 */
export async function getUserSubscriptionStatus(userId: string): Promise<{
  hasActiveSubscription: boolean;
  subscription: Subscription | null;
  daysRemaining: number;
}> {
  const now = new Date();

  const activeSub = await prisma.subscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      endDate: { gt: now },
    },
    orderBy: { endDate: "desc" },
    include: { plan: true },
  });

  if (!activeSub || !activeSub.endDate) {
    return {
      hasActiveSubscription: false,
      subscription: null,
      daysRemaining: 0,
    };
  }

  const daysRemaining = Math.max(
    0,
    Math.ceil((activeSub.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  return {
    hasActiveSubscription: true,
    subscription: activeSub,
    daysRemaining,
  };
}

/**
 * Creates a pending payment and subscription request.
 * Completely validates all server-side parameters (never trusts client amount or duration).
 */
export async function createPaymentRequest(params: {
  userId: string;
  planId?: string | undefined;
  paymentMethod: "VODAFONE_CASH" | "INSTAPAY";
  transactionReference?: string | undefined;
  receipt?: {
    originalFilename: string;
    mimeType: string;
    fileSize: number;
    storageKey: string;
  } | undefined;
}): Promise<{ payment: Payment; subscription: Subscription }> {
  const plan = params.planId
    ? await prisma.subscriptionPlan.findUnique({ where: { id: params.planId } })
    : await getOrCreateDefaultPlan();

  if (!plan || !plan.isActive) {
    throw new Error("خطة الاشتراك غير متوفرة حالياً");
  }

  // 1. Defend against pending queue flooding (max 2 pending requests per user)
  const pendingCount = await prisma.payment.count({
    where: {
      userId: params.userId,
      status: "PENDING",
    },
  });
  if (pendingCount >= 2) {
    throw new Error("لديك طلب اشتراك قيد المراجعة بالفعل. يرجى انتظار رد الإدارة قبل تقديم طلب جديد.");
  }

  // 2. Defend against Payment Reference Replay attacks
  const normalizedRef = params.transactionReference ? params.transactionReference.trim() : null;
  if (normalizedRef) {
    const existingWithRef = await prisma.payment.findFirst({
      where: {
        transactionReference: normalizedRef,
        status: { in: ["PENDING", "APPROVED"] },
      },
    });
    if (existingWithRef) {
      throw new Error("رقم العملية أو المرجع هذا مستخدم بالفعل في طلب سابق.");
    }
  }

  return prisma.$transaction(async (tx) => {
    // 1. Create PENDING Subscription
    const subscription = await tx.subscription.create({
      data: {
        userId: params.userId,
        planId: plan.id,
        status: "PENDING",
      },
    });

    // 2. Create PENDING Payment with verified server-side price
    const payment = await tx.payment.create({
      data: {
        userId: params.userId,
        subscriptionId: subscription.id,
        amount: plan.price,
        currency: plan.currency,
        paymentMethod: params.paymentMethod,
        transactionReference: params.transactionReference ? params.transactionReference.trim() : null,
        status: "PENDING",
      },
    });

    // 3. Attach receipt if provided
    if (params.receipt) {
      await tx.paymentReceipt.create({
        data: {
          paymentId: payment.id,
          storageKey: params.receipt.storageKey,
          originalFilename: params.receipt.originalFilename,
          mimeType: params.receipt.mimeType,
          fileSize: params.receipt.fileSize,
        },
      });
    }

    // 4. Create internal notification for admins
    await tx.notification.create({
      data: {
        userId: params.userId,
        title: "طلب اشتراك جديد قيد المراجعة",
        message: `تم استلام طلب اشتراكك بقيمة ${plan.price} ${plan.currency}. جاري مراجعة إيصال التحويل من قِبل الإدارة.`,
        type: "PAYMENT_SUBMITTED",
      },
    });

    return { payment, subscription };
  }, DB_TRANSACTION_OPTIONS);
}

/**
 * Idempotently approves a payment and activates the associated subscription.
 */
export async function approvePayment(
  paymentId: string,
  adminId: string
): Promise<{ payment: Payment; subscription: Subscription }> {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { subscription: { include: { plan: true } }, user: true },
    });

    if (!payment) {
      throw new Error("طلب الدفع غير موجود");
    }

    // 1. Prevent Self-Approval (Separation of Duties)
    if (payment.userId === adminId) {
      throw new Error("FORBIDDEN: لا يسمح للمشرف باعتماد مدفوعاته الخاصة.");
    }

    if (payment.status === "APPROVED") {
      throw new Error("تم اعتماد هذا الدفع مسبقاً");
    }

    const now = new Date();
    const durationDays = payment.subscription?.plan?.durationDays || PAYMENT_CONFIG.DEFAULT_DURATION_DAYS;
    const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // 2. Concurrency-Safe Atomic Conditional Update
    const updateCount = await tx.payment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: {
        status: "APPROVED",
        reviewedBy: adminId,
        reviewedAt: now,
        rejectionReason: null,
      },
    });

    if (updateCount.count === 0) {
      throw new Error("طلب الدفع غير موجود أو تمت معالجته مسبقاً بالتوازي.");
    }

    const updatedPayment = (await tx.payment.findUnique({
      where: { id: paymentId },
    })) as Payment;

    let updatedSubscription: Subscription;

    if (payment.subscriptionId) {
      updatedSubscription = await tx.subscription.update({
        where: { id: payment.subscriptionId },
        data: {
          status: "ACTIVE",
          startDate: now,
          endDate,
          activatedAt: now,
        },
      });
    } else {
      const plan = await getOrCreateDefaultPlan();
      updatedSubscription = await tx.subscription.create({
        data: {
          userId: payment.userId,
          planId: plan.id,
          status: "ACTIVE",
          startDate: now,
          endDate,
          activatedAt: now,
        },
      });
    }

    // User Notification
    await tx.notification.create({
      data: {
        userId: payment.userId,
        title: "تم تفعيل اشتراكك بنجاح! 🎉",
        message: `تم تأكيد دفعتك وتفعيل باقتك حتى ${endDate.toLocaleDateString("ar-EG")}. استمتع بجميع الميزات!`,
        type: "SUBSCRIPTION_ACTIVATED",
      },
    });

    // Audit Log
    await tx.auditLog.create({
      data: {
        actorId: adminId,
        targetUserId: payment.userId,
        action: "PAYMENT_APPROVED",
        entityType: "Payment",
        entityId: paymentId,
        metadata: {
          amount: Number(payment.amount),
          currency: payment.currency,
          durationDays,
          startDate: now.toISOString(),
          endDate: endDate.toISOString(),
        },
      },
    });

    return { payment: updatedPayment, subscription: updatedSubscription };
  }, DB_TRANSACTION_OPTIONS);
}

/**
 * Rejects a payment with a clear reason.
 */
export async function rejectPayment(
  paymentId: string,
  adminId: string,
  rejectionReason: string
): Promise<Payment> {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { user: true },
    });

    if (!payment) {
      throw new Error("طلب الدفع غير موجود");
    }

    // 1. Prevent Self-Action
    if (payment.userId === adminId) {
      throw new Error("FORBIDDEN: لا يمكن للمشرف اتخاذ إجراء على مدفوعاته الشخصية.");
    }

    if (payment.status !== "PENDING") {
      throw new Error("لا يمكن رفض طلب تمت معالجته بالفعل");
    }

    // 2. Concurrency-Safe Atomic Conditional Update
    const updateCount = await tx.payment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: {
        status: "REJECTED",
        reviewedBy: adminId,
        reviewedAt: new Date(),
        rejectionReason: rejectionReason.trim().slice(0, 500),
      },
    });

    if (updateCount.count === 0) {
      throw new Error("طلب الدفع غير موجود أو تمت معالجته مسبقاً بالتوازي.");
    }

    const updatedPayment = (await tx.payment.findUnique({
      where: { id: paymentId },
    })) as Payment;

    if (payment.subscriptionId) {
      await tx.subscription.update({
        where: { id: payment.subscriptionId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
        },
      });
    }

    // Notify User
    await tx.notification.create({
      data: {
        userId: payment.userId,
        title: "تعذر اعتماد طلب الدفع",
        message: `سبب الرفض: ${rejectionReason.trim()}. يرجى التحقق من صحة التحويل أو إعادة المحاولة.`,
        type: "PAYMENT_REJECTED",
      },
    });

    // Audit Log
    await tx.auditLog.create({
      data: {
        actorId: adminId,
        targetUserId: payment.userId,
        action: "PAYMENT_REJECTED",
        entityType: "Payment",
        entityId: paymentId,
        metadata: {
          rejectionReason: rejectionReason.trim(),
        },
      },
    });

    return updatedPayment;
  }, DB_TRANSACTION_OPTIONS);
}

/**
 * Extends an active subscription by a given number of days.
 */
export async function extendSubscription(
  targetId: string,
  extraDays: number,
  adminId: string,
  reason?: string
): Promise<Subscription> {
  if (extraDays <= 0) throw new Error("عدد الأيام يجب أن يكون أكبر من صفر");

  return prisma.$transaction(async (tx) => {
    let sub = await tx.subscription.findUnique({
      where: { id: targetId },
    });

    if (!sub) {
      // Prioritize currently ACTIVE subscription with future endDate
      sub = await tx.subscription.findFirst({
        where: {
          userId: targetId,
          status: "ACTIVE",
          endDate: { gt: new Date() },
        },
        orderBy: { endDate: "desc" },
      });
    }

    if (!sub) {
      // Fallback to any latest subscription with an endDate
      sub = await tx.subscription.findFirst({
        where: {
          userId: targetId,
          endDate: { not: null },
        },
        orderBy: { endDate: "desc" },
      });
    }

    if (!sub) {
      const plan = await getOrCreateDefaultPlan();
      const now = new Date();
      const endDate = new Date(now.getTime() + extraDays * 24 * 60 * 60 * 1000);
      sub = await tx.subscription.create({
        data: {
          userId: targetId,
          planId: plan.id,
          status: "ACTIVE",
          startDate: now,
          endDate,
          activatedAt: now,
        },
      });

      await tx.notification.create({
        data: {
          userId: targetId,
          title: "تم تفعيل اشتراكك!",
          message: `تم تفعيل اشتراكك لمدة ${extraDays} يومًا إضافيًا حتى ${endDate.toLocaleDateString("ar-EG")}.`,
          type: "SUBSCRIPTION_EXTENDED",
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          targetUserId: targetId,
          action: "SUBSCRIPTION_EXTENDED",
          entityType: "Subscription",
          entityId: sub.id,
          metadata: { extraDays, newEndDate: endDate.toISOString(), reason },
        },
      });

      return sub;
    }

    const baseDate = sub.endDate && sub.endDate.getTime() > Date.now() ? sub.endDate : new Date();
    const newEndDate = new Date(baseDate.getTime() + extraDays * 24 * 60 * 60 * 1000);

    const updated = await tx.subscription.update({
      where: { id: sub.id },
      data: {
        endDate: newEndDate,
        status: "ACTIVE",
      },
    });

    await tx.notification.create({
      data: {
        userId: sub.userId,
        title: "تم تمديد اشتراكك!",
        message: `تم تمديد اشتراكك لمدة ${extraDays} يومًا إضافيًا حتى ${newEndDate.toLocaleDateString("ar-EG")}.`,
        type: "SUBSCRIPTION_EXTENDED",
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        targetUserId: sub.userId,
        action: "SUBSCRIPTION_EXTENDED",
        entityType: "Subscription",
        entityId: sub.id,
        metadata: { extraDays, newEndDate: newEndDate.toISOString(), reason },
      },
    });

    return updated;
  }, DB_TRANSACTION_OPTIONS);
}

/**
 * Cancels a subscription immediately.
 */
export async function cancelSubscription(
  subscriptionId: string,
  adminId: string,
  reason?: string
): Promise<Subscription> {
  return prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!sub) throw new Error("الاشتراك غير موجود");

    const updated = await tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
    });

    await tx.notification.create({
      data: {
        userId: sub.userId,
        title: "تم إلغاء الاشتراك",
        message: `تم إلغاء باقة الاشتراك. ${reason ? `السبب: ${reason}` : ""}`,
        type: "SUBSCRIPTION_CANCELLED",
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        targetUserId: sub.userId,
        action: "SUBSCRIPTION_CANCELLED",
        entityType: "Subscription",
        entityId: subscriptionId,
        metadata: { reason },
      },
    });

    return updated;
  }, DB_TRANSACTION_OPTIONS);
}

/**
 * Background routine to process and expire past subscriptions.
 */
export async function processExpiredSubscriptions(): Promise<number> {
  const now = new Date();
  const result = await prisma.subscription.updateMany({
    where: {
      status: "ACTIVE",
      endDate: { lte: now },
    },
    data: {
      status: "EXPIRED",
    },
  });

  return result.count;
}

/**
 * Returns real database analytics for the Admin Super Control Center.
 */
export async function getAdminAnalytics() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeSubscribers,
    expiredSubscribers,
    bannedUsers,
    pendingPayments,
    approvedPaymentsCount,
    rejectedPaymentsCount,
    expiringInThreeDays,
    recentRegistrations,
    approvedRevenueRaw,
    monthlyRevenueRaw,
    recentAuditLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count({ where: { status: "ACTIVE", endDate: { gt: now } } }),
    prisma.subscription.count({ where: { status: "EXPIRED" } }),
    prisma.user.count({ where: { accountStatus: "BANNED" } }),
    prisma.payment.count({ where: { status: "PENDING" } }),
    prisma.payment.count({ where: { status: "APPROVED" } }),
    prisma.payment.count({ where: { status: "REJECTED" } }),
    prisma.subscription.count({
      where: { status: "ACTIVE", endDate: { gt: now, lte: threeDaysFromNow } },
    }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "APPROVED" },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "APPROVED", reviewedAt: { gte: thirtyDaysAgo } },
    }),
    prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        entityType: true,
        targetUserId: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    totalUsers,
    activeSubscribers,
    expiredSubscribers,
    bannedUsers,
    pendingPayments,
    approvedPaymentsCount,
    rejectedPaymentsCount,
    expiringInThreeDays,
    recentRegistrations,
    totalRevenueEGP: Number(approvedRevenueRaw._sum.amount ?? 0),
    monthlyRevenueEGP: Number(monthlyRevenueRaw._sum.amount ?? 0),
    recentAuditLogs,
  };
}

