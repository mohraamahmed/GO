import { createServerFn } from "@tanstack/react-start";
import type { MoodKey } from "@/lib/mood";
import type { DataQualityData } from "./cafes.types";

// Re-export all types and constants from cafes.types so existing imports continue to work seamlessly
export * from "./cafes.types";

export const listCafes = createServerFn({ method: "GET" }).handler(async () => {
  const { handleListCafes } = await import("./cafes.server");
  return handleListCafes();
});

export const getHomepageData = createServerFn({ method: "GET" }).handler(async () => {
  const { handleGetHomepageData } = await import("./cafes.server");
  return handleGetHomepageData();
});

export const getListingInitialData = createServerFn({ method: "GET" }).handler(async () => {
  const { handleGetListingInitialData } = await import("./cafes.server");
  return handleGetListingInitialData();
});

export const getCafe = createServerFn({ method: "GET" })
  .validator((d: { slug: string }) => ({ slug: String(d.slug).slice(0, 120) }))
  .handler(async ({ data }) => {
    const { handleGetCafe } = await import("./cafes.server");
    return handleGetCafe(data.slug);
  });

export const moodCafes = createServerFn({ method: "GET" })
  .validator((d: { mood: string; areaClass?: string | null }) => ({
    mood: String(d.mood) as MoodKey,
    areaClass: d.areaClass ? String(d.areaClass) : null,
  }))
  .handler(async ({ data }) => {
    const { handleMoodCafes } = await import("./cafes.server");
    return handleMoodCafes(data.mood, data.areaClass);
  });

export const cafeMenu = createServerFn({ method: "GET" })
  .validator((d: { cafeId: string }) => ({ cafeId: String(d.cafeId).slice(0, 120) }))
  .handler(async ({ data }) => {
    // 1. Subscription Check on the Server: Verify user has active subscription or is ADMIN
    let isAuthorized = false;
    try {
      const { getCookie } = await import("@tanstack/react-start/server");
      const { SESSION_COOKIE_NAME } = await import("./server-auth.server");
      const { validateSession } = await import("./auth-service");
      const { getUserSubscriptionStatus } = await import("./subscription-service");

      const token = getCookie(SESSION_COOKIE_NAME);
      if (token) {
        const auth = await validateSession(token);
        if (auth?.user) {
          if (auth.user.role === "ADMIN") {
            isAuthorized = true;
          } else {
            const sub = await getUserSubscriptionStatus(auth.user.id);
            if (sub.hasActiveSubscription) {
              isAuthorized = true;
            }
          }
        }
      }
    } catch {
      // not logged in or error
    }

    if (!isAuthorized) {
      throw new Error("UNAUTHORIZED_SUBSCRIPTION_REQUIRED: عرض قائمة الأسعار والمنيو الكامل يتطلب اشتراكاً نشطاً في باقات CaféLens.");
    }

    const { handleCafeMenu } = await import("./cafes.server");
    return handleCafeMenu(data.cafeId);
  });

export const dataQuality = createServerFn({ method: "GET" }).handler(async (): Promise<DataQualityData> => {
  const { handleDataQuality } = await import("./cafes.server");
  return handleDataQuality();
});

/** Invalidate server-side in-memory cache on demand */
export async function invalidateServerCafesCache(slug?: string) {
  const { invalidateServerCafesCache: invalidate } = await import("./cafes.server");
  invalidate(slug);
}
