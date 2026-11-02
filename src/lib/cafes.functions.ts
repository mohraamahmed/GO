import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { moodScore, EMPTY_ATTRS, type AttrInput, type MoodKey } from "@/lib/mood";

export type CafeRow = Database["public"]["Tables"]["cafes"]["Row"];
export type CafePhoto = { url: string | null; by: string[] };

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
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

export const listCafes = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicClient()
    .from("cafes")
    .select(LIST_COLS)
    .order("rating_count", { ascending: false, nullsFirst: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []) as CafeListItem[];
});

export const getCafe = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => ({ slug: String(d.slug).slice(0, 120) }))
  .handler(async ({ data }) => {
    const { data: row, error } = await publicClient().from("cafes").select("*").eq("slug", data.slug).maybeSingle();
    if (error) throw new Error(error.message);
    return row as CafeRow | null;
  });

export type MoodResult = CafeListItem & { moodScore: number; reasons: string[] };

export const moodCafes = createServerFn({ method: "GET" })
  .inputValidator((d: { mood: string; areaClass?: string | null }) => ({
    mood: String(d.mood) as MoodKey,
    areaClass: d.areaClass ? String(d.areaClass) : null,
  }))
  .handler(async ({ data }) => {
    let q = publicClient()
      .from("cafes")
      .select(`${LIST_COLS},cafe_attributes(*)`)
      .order("rating_count", { ascending: false, nullsFirst: false })
      .limit(1000);
    if (data.areaClass) q = q.eq("area_class", data.areaClass);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const out: MoodResult[] = (rows ?? []).map((r) => {
      const { cafe_attributes, ...cafe } = r as Record<string, unknown> & { cafe_attributes: AttrInput[] | AttrInput | null };
      const attr = Array.isArray(cafe_attributes) ? (cafe_attributes[0] ?? EMPTY_ATTRS) : (cafe_attributes ?? EMPTY_ATTRS);
      const { score, reasons } = moodScore(data.mood, attr);
      return { ...(cafe as unknown as CafeListItem), moodScore: score, reasons };
    });
    // Rank: mood match first, then popularity. Unknown data never boosts a café.
    out.sort((a, b) => b.moodScore - a.moodScore || Number(b.rating_count ?? 0) - Number(a.rating_count ?? 0));
    return out;
  });

export const cafeMenu = createServerFn({ method: "GET" })
  .inputValidator((d: { cafeId: string }) => ({ cafeId: String(d.cafeId).slice(0, 120) }))
  .handler(async ({ data }) => {
    const c = publicClient();
    const [items, fees] = await Promise.all([
      c.from("menu_items").select("*").eq("cafe_id", data.cafeId).eq("verification_status", "verified").order("category").order("name"),
      c.from("cafe_fees").select("*").eq("cafe_id", data.cafeId).maybeSingle(),
    ]);
    if (items.error) throw new Error(items.error.message);
    if (fees.error) throw new Error(fees.error.message);
    return { items: items.data ?? [], fees: fees.data ?? null };
  });

export const dataQuality = createServerFn({ method: "GET" }).handler(async () => {
  const c = publicClient();
  const [cafes, attrs, menus] = await Promise.all([
    c.from("cafes").select("area_class,photos,rating,hours,phone,price_level,verified_at"),
    c.from("cafe_attributes").select("cafe_id", { count: "exact", head: true }),
    c.from("menu_items").select("id", { count: "exact", head: true }),
  ]);
  if (cafes.error) throw new Error(cafes.error.message);
  const rows = cafes.data ?? [];
  const byClass: Record<string, number> = {};
  for (const r of rows) byClass[r.area_class] = (byClass[r.area_class] ?? 0) + 1;
  return {
    total: rows.length,
    byClass,
    withPhotos: rows.filter((r) => Array.isArray(r.photos) && (r.photos as unknown[]).length > 0).length,
    withRating: rows.filter((r) => r.rating != null).length,
    withHours: rows.filter((r) => r.hours.length > 0).length,
    withPhone: rows.filter((r) => r.phone != null).length,
    withPriceLevel: rows.filter((r) => r.price_level != null).length,
    withAttributes: attrs.count ?? 0,
    verifiedMenuItems: menus.count ?? 0,
    lastVerified: rows.map((r) => r.verified_at).sort().at(-1) ?? null,
  };
});
