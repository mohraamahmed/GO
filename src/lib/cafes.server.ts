// server-only module: NEVER imported on the client side
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { moodScore, EMPTY_ATTRS, type AttrInput, type MoodKey } from "@/lib/mood";
import {
  LIST_COLS,
  toCompactCafe,
  type CafeRow,
  type CafeListItem,
  type MoodResult,
  type HomepageData,
  type ListingInitialData,
  type DataQualityData,
} from "./cafes.types";

// Local fallback datasets containing all 499 cafes and attributes
import LOCAL_CAFES from "@/data/cafes.json";
import LOCAL_ATTRS from "@/data/cafe_attributes.json";

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

function bayesianScore(rating: number, count: number): number {
  const v = Math.max(0, count);
  const r = Math.max(1, Math.min(5, rating));
  const m = 40;
  const c = 4.35;
  const weighted = (v / (v + m)) * r + (m / (v + m)) * c;
  return Number(weighted.toFixed(2));
}

// Map attributes by cafe_id for fast lookup
const attrsMap = new Map<string, any>();
for (const a of LOCAL_ATTRS as any[]) {
  if (a.cafe_id) attrsMap.set(a.cafe_id, a);
}

// Pre-initialize in-memory caches from local data so serverless instances NEVER cold-wait on external network
// Sorted identically to the client's default Bayesian ranking to eliminate any layout shift between SSR and hydration
const INITIAL_FALLBACK_CAFES: CafeListItem[] = (LOCAL_CAFES as unknown as any[])
  .map(toCompactCafe)
  .sort((a, b) => {
    const scoreB = bayesianScore(Number(b.rating ?? 4.0), Number(b.rating_count ?? 15));
    const scoreA = bayesianScore(Number(a.rating ?? 4.0), Number(a.rating_count ?? 15));
    return scoreB - scoreA;
  });

const localCafeMap = new Map<string, CafeRow>();
for (const c of LOCAL_CAFES as unknown as CafeRow[]) {
  if (c.slug) localCafeMap.set(c.slug, c);
}

function computeHomepageData(cafes: CafeListItem[]): HomepageData {
  const scoreMap = new Map<string, number>();
  for (const c of cafes) {
    scoreMap.set(c.id, bayesianScore(Number(c.rating ?? 4.0), Number(c.rating_count ?? 15)));
  }
  const featuredCafes = [...cafes]
    .sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0))
    .slice(0, 6);

  const fifth_settlement = cafes.filter((c) => c.area_class === "fifth_settlement").length;
  const sheikh_zayed = cafes.filter((c) => c.area_class === "sheikh_zayed").length;
  const new_cairo = cafes.filter((c) => (c.area_class || "").startsWith("new_cairo")).length;

  return {
    featuredCafes,
    totalCount: cafes.length,
    areaCounts: {
      fifth_settlement,
      sheikh_zayed,
      new_cairo,
    },
  };
}

let serverCafesCache: CafeListItem[] = INITIAL_FALLBACK_CAFES;
let serverCafesCacheTime = Date.now();
const SERVER_CACHE_TTL = 30 * 60_000; // 30 minutes in-memory cache

let serverHomepageCache: HomepageData = computeHomepageData(INITIAL_FALLBACK_CAFES);
let serverHomepageCacheTime = Date.now();

let serverListingInitialCache: ListingInitialData = {
  initialCafes: INITIAL_FALLBACK_CAFES.slice(0, 24),
  totalCount: INITIAL_FALLBACK_CAFES.length,
};
let serverListingInitialCacheTime = Date.now();

const serverCafeDetailCache = new Map<string, { data: CafeRow; time: number }>();

/** Invalidate server-side in-memory cache on demand (e.g. after admin updates) */
export function invalidateServerCafesCache(slug?: string) {
  serverCafesCacheTime = 0;
  serverHomepageCacheTime = 0;
  serverListingInitialCacheTime = 0;
  if (slug) {
    serverCafeDetailCache.delete(slug);
  } else {
    serverCafeDetailCache.clear();
  }
}

export async function handleListCafes(): Promise<CafeListItem[]> {
  const isExpired = Date.now() - serverCafesCacheTime >= SERVER_CACHE_TTL;
  if (!isExpired && serverCafesCache.length > 0) {
    return serverCafesCache;
  }
  try {
    const { data, error } = await publicClient()
      .from("cafes")
      .select(LIST_COLS)
      .order("rating_count", { ascending: false, nullsFirst: false })
      .limit(1000);
    if (!error && data && data.length > 0) {
      serverCafesCache = data.map(toCompactCafe);
      serverCafesCacheTime = Date.now();
      return serverCafesCache;
    }
  } catch {
    // fallback below
  }
  serverCafesCache = INITIAL_FALLBACK_CAFES;
  serverCafesCacheTime = Date.now();
  return serverCafesCache;
}

export async function handleGetHomepageData(): Promise<HomepageData> {
  const isExpired = Date.now() - serverHomepageCacheTime >= SERVER_CACHE_TTL;
  if (!isExpired && serverHomepageCache) {
    return serverHomepageCache;
  }
  const cafes = serverCafesCache.length > 0 ? serverCafesCache : INITIAL_FALLBACK_CAFES;
  serverHomepageCache = computeHomepageData(cafes);
  serverHomepageCacheTime = Date.now();
  return serverHomepageCache;
}

export async function handleGetListingInitialData(): Promise<ListingInitialData> {
  const isExpired = Date.now() - serverListingInitialCacheTime >= SERVER_CACHE_TTL;
  if (!isExpired && serverListingInitialCache) {
    return serverListingInitialCache;
  }
  const cafes = serverCafesCache.length > 0 ? serverCafesCache : INITIAL_FALLBACK_CAFES;
  serverListingInitialCache = {
    initialCafes: cafes.slice(0, 24),
    totalCount: cafes.length,
  };
  serverListingInitialCacheTime = Date.now();
  return serverListingInitialCache;
}

export async function handleGetCafe(slug: string): Promise<CafeRow | null> {
  const cached = serverCafeDetailCache.get(slug);
  if (cached && Date.now() - cached.time < SERVER_CACHE_TTL) {
    return cached.data;
  }
  const localFound = localCafeMap.get(slug);
  if (localFound) {
    serverCafeDetailCache.set(slug, { data: localFound, time: Date.now() });
    return localFound;
  }
  try {
    const { data: row, error } = await publicClient().from("cafes").select("*").eq("slug", slug).maybeSingle();
    if (!error && row) {
      const item = row as CafeRow;
      serverCafeDetailCache.set(slug, { data: item, time: Date.now() });
      return item;
    }
  } catch {
    // fallback below
  }
  return null;
}

export async function handleMoodCafes(mood: MoodKey, areaClass?: string | null): Promise<MoodResult[]> {
  try {
    let q = publicClient()
      .from("cafes")
      .select(`${LIST_COLS},cafe_attributes(*)`)
      .order("rating_count", { ascending: false, nullsFirst: false })
      .limit(1000);
    if (areaClass) q = q.eq("area_class", areaClass);
    const { data: rows, error } = await q;
    if (!error && rows && rows.length > 0) {
      const out: MoodResult[] = rows.map((r) => {
        const { cafe_attributes, ...cafe } = r as Record<string, unknown> & { cafe_attributes: AttrInput[] | AttrInput | null };
        const attr = Array.isArray(cafe_attributes) ? (cafe_attributes[0] ?? EMPTY_ATTRS) : (cafe_attributes ?? EMPTY_ATTRS);
        const { score, reasons } = moodScore(mood, attr);
        return { ...toCompactCafe(cafe), moodScore: score, reasons };
      });
      out.sort((a, b) => b.moodScore - a.moodScore || Number(b.rating_count ?? 0) - Number(a.rating_count ?? 0));
      return out;
    }
  } catch {
    // fallback below
  }

  // Fallback using local JSON
  let filtered = LOCAL_CAFES as unknown as any[];
  if (areaClass) {
    filtered = filtered.filter((c) => c.area_class === areaClass);
  }
  const out: MoodResult[] = filtered.map((cafe) => {
    const attr = attrsMap.get(cafe.id) ?? EMPTY_ATTRS;
    const { score, reasons } = moodScore(mood, attr);
    return { ...toCompactCafe(cafe), moodScore: score, reasons };
  });
  out.sort((a, b) => b.moodScore - a.moodScore || Number(b.rating_count ?? 0) - Number(a.rating_count ?? 0));
  return out;
}

export async function handleCafeMenu(cafeId: string): Promise<{ items: any[]; fees: any | null }> {
  try {
    const c = publicClient();
    const [items, fees] = await Promise.all([
      c.from("menu_items").select("*").eq("cafe_id", cafeId).eq("verification_status", "verified").order("category").order("name"),
      c.from("cafe_fees").select("*").eq("cafe_id", cafeId).maybeSingle(),
    ]);
    if (!items.error && !fees.error && items.data) {
      return { items: items.data ?? [], fees: fees.data ?? null };
    }
  } catch {
    // fallback below
  }
  return { items: [], fees: null };
}

export async function handleDataQuality(): Promise<DataQualityData> {
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
}
