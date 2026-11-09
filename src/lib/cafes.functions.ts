import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { moodScore, EMPTY_ATTRS, type AttrInput, type MoodKey } from "@/lib/mood";

// Local fallback datasets containing all 499 cafes and attributes
import LOCAL_CAFES from "@/data/cafes.json";
import LOCAL_ATTRS from "@/data/cafe_attributes.json";

export type CafeRow = Database["public"]["Tables"]["cafes"]["Row"];
export type CafePhoto = { url: string | null; by: string[] };

const DEFAULT_SUPABASE_URL = "https://buhbubmzprbggxtltteb.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_5kPsk_UJcA8Y6Qd4dDnmKA_5fhxYRRL";

function publicClient() {
  const url =
    (typeof process !== "undefined" && process.env && (process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"])) ||
    DEFAULT_SUPABASE_URL;
  const key =
    (typeof process !== "undefined" && process.env && (process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"])) ||
    DEFAULT_SUPABASE_KEY;

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const LIST_COLS = "id,slug,name,area,area_class,address,rating,rating_count,price_level,photos,services,category,phone,website,maps_url,hours,source,verified_at";
export type CafeListItem = Pick<
  CafeRow,
  "id" | "slug" | "name" | "area" | "area_class" | "address" | "rating" | "rating_count" | "price_level" | "photos" | "services" | "category" | "phone" | "website" | "maps_url" | "hours" | "source" | "verified_at"
>;

export const AREA_CLASS_LABELS: Record<string, string> = {
  fifth_settlement: "التجمع الخامس",
  new_cairo_other: "القاهرة الجديدة — مناطق أخرى",
  new_cairo_unclassified: "القاهرة الجديدة — غير محدد الحي",
  sheikh_zayed: "الشيخ زايد",
  outside_coverage: "خارج النطاق",
  pending_verification: "قيد المراجعة",
};

// Map attributes by cafe_id for fast lookup
const attrsMap = new Map<string, any>();
for (const a of LOCAL_ATTRS as any[]) {
  if (a.cafe_id) attrsMap.set(a.cafe_id, a);
}

export const listCafes = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { data, error } = await publicClient()
      .from("cafes")
      .select(LIST_COLS)
      .order("rating_count", { ascending: false, nullsFirst: false })
      .limit(1000);
    if (!error && data && data.length > 0) {
      return data as CafeListItem[];
    }
  } catch {
    // fallback below
  }
  return (LOCAL_CAFES as unknown as CafeListItem[]).sort(
    (a, b) => Number(b.rating_count ?? 0) - Number(a.rating_count ?? 0)
  );
});

export const getCafe = createServerFn({ method: "GET" })
  .validator((d: { slug: string }) => ({ slug: String(d.slug).slice(0, 120) }))
  .handler(async ({ data }) => {
    try {
      const { data: row, error } = await publicClient().from("cafes").select("*").eq("slug", data.slug).maybeSingle();
      if (!error && row) return row as CafeRow;
    } catch {
      // fallback below
    }
    const found = (LOCAL_CAFES as unknown as CafeRow[]).find((c) => c.slug === data.slug);
    return found ?? null;
  });

export type MoodResult = CafeListItem & { moodScore: number; reasons: string[] };

export const moodCafes = createServerFn({ method: "GET" })
  .validator((d: { mood: string; areaClass?: string | null }) => ({
    mood: String(d.mood) as MoodKey,
    areaClass: d.areaClass ? String(d.areaClass) : null,
  }))
  .handler(async ({ data }) => {
    try {
      let q = publicClient()
        .from("cafes")
        .select(`${LIST_COLS},cafe_attributes(*)`)
        .order("rating_count", { ascending: false, nullsFirst: false })
        .limit(1000);
      if (data.areaClass) q = q.eq("area_class", data.areaClass);
      const { data: rows, error } = await q;
      if (!error && rows && rows.length > 0) {
        const out: MoodResult[] = rows.map((r) => {
          const { cafe_attributes, ...cafe } = r as Record<string, unknown> & { cafe_attributes: AttrInput[] | AttrInput | null };
          const attr = Array.isArray(cafe_attributes) ? (cafe_attributes[0] ?? EMPTY_ATTRS) : (cafe_attributes ?? EMPTY_ATTRS);
          const { score, reasons } = moodScore(data.mood, attr);
          return { ...(cafe as unknown as CafeListItem), moodScore: score, reasons };
        });
        out.sort((a, b) => b.moodScore - a.moodScore || Number(b.rating_count ?? 0) - Number(a.rating_count ?? 0));
        return out;
      }
    } catch {
      // fallback below
    }

    // Fallback using local JSON
    let filtered = LOCAL_CAFES as unknown as CafeListItem[];
    if (data.areaClass) {
      filtered = filtered.filter((c) => c.area_class === data.areaClass);
    }
    const out: MoodResult[] = filtered.map((cafe) => {
      const attr = attrsMap.get(cafe.id) ?? EMPTY_ATTRS;
      const { score, reasons } = moodScore(data.mood, attr);
      return { ...cafe, moodScore: score, reasons };
    });
    out.sort((a, b) => b.moodScore - a.moodScore || Number(b.rating_count ?? 0) - Number(a.rating_count ?? 0));
    return out;
  });

export const cafeMenu = createServerFn({ method: "GET" })
  .validator((d: { cafeId: string }) => ({ cafeId: String(d.cafeId).slice(0, 120) }))
  .handler(async ({ data, context }) => {
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

    try {
      const c = publicClient();
      const [items, fees] = await Promise.all([
        c.from("menu_items").select("*").eq("cafe_id", data.cafeId).eq("verification_status", "verified").order("category").order("name"),
        c.from("cafe_fees").select("*").eq("cafe_id", data.cafeId).maybeSingle(),
      ]);
      if (!items.error && !fees.error && items.data) {
        return { items: items.data ?? [], fees: fees.data ?? null };
      }
    } catch {
      // fallback below
    }
    return { items: [], fees: null };
  });

export const dataQuality = createServerFn({ method: "GET" }).handler(async () => {
  let rows: any[] = [];
  let attrsCount = 0;
  let menuCount = 0;

  try {
    const c = publicClient();
    const [cafes, attrs, menus] = await Promise.all([
      c.from("cafes").select("area_class,photos,rating,hours,phone,price_level,verified_at"),
      c.from("cafe_attributes").select("cafe_id", { count: "exact", head: true }),
      c.from("menu_items").select("id", { count: "exact", head: true }),
    ]);
    if (!cafes.error && cafes.data && cafes.data.length > 0) {
      rows = cafes.data;
      attrsCount = attrs.count ?? 0;
      menuCount = menus.count ?? 0;
    }
  } catch {
    // fallback below
  }

  if (rows.length === 0) {
    rows = LOCAL_CAFES as any[];
    attrsCount = (LOCAL_ATTRS as any[]).length;
    menuCount = 0;
  }

  const byClass: Record<string, number> = {};
  for (const r of rows) {
    const key = r.area_class || "unclassified";
    byClass[key] = (byClass[key] ?? 0) + 1;
  }

  return {
    total: rows.length,
    byClass,
    withPhotos: rows.filter((r) => Array.isArray(r.photos) && (r.photos as unknown[]).length > 0).length,
    withRating: rows.filter((r) => r.rating != null).length,
    withHours: rows.filter((r) => Array.isArray(r.hours) && (r.hours as unknown[]).length > 0).length,
    withPhone: rows.filter((r) => r.phone != null).length,
    withPriceLevel: rows.filter((r) => r.price_level != null).length,
    withAttributes: attrsCount,
    verifiedMenuItems: menuCount,
    lastVerified: rows.map((r) => r.verified_at).filter(Boolean).sort().at(-1) ?? null,
  };
});
