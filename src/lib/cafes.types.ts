import type { Database } from "@/integrations/supabase/types";

export type CafeRow = Database["public"]["Tables"]["cafes"]["Row"];
export type CafePhoto = { url: string | null; by: string[] };

export const LIST_COLS = "id,slug,name,area,area_class,address,rating,rating_count,price_level,photos,services,category,maps_url";

export type CafeListItem = {
  id: string;
  slug: string;
  name: string;
  area: string;
  area_class: string;
  address?: string | null;
  rating?: number | null;
  rating_count?: number | null;
  price_level?: number | null;
  photos: CafePhoto[];
  services: string[];
  category?: string | null;
  maps_url?: string | null;
  phone?: string | null;
  website?: string | null;
  hours?: any;
  source?: string | null;
  verified_at?: string | null;
};

export function toCompactCafe(c: any): CafeListItem {
  let photoUrl: string | null = null;
  if (Array.isArray(c.photos) && c.photos.length > 0) {
    photoUrl = typeof c.photos[0] === "string" ? c.photos[0] : (c.photos[0]?.url || null);
  }
  return {
    id: String(c.id),
    slug: String(c.slug),
    name: String(c.name),
    area: String(c.area || ""),
    area_class: String(c.area_class || ""),
    address: c.address ? String(c.address) : null,
    rating: c.rating !== undefined && c.rating !== null ? Number(c.rating) : 4.0,
    rating_count: c.rating_count !== undefined && c.rating_count !== null ? Number(c.rating_count) : 0,
    price_level: c.price_level !== undefined && c.price_level !== null ? Number(c.price_level) : null,
    photos: photoUrl ? [{ url: photoUrl, by: [] }] : [],
    services: Array.isArray(c.services) ? c.services : [],
    category: c.category ? String(c.category) : "",
    maps_url: c.maps_url ? String(c.maps_url) : null,
  };
}

export const AREA_CLASS_LABELS: Record<string, string> = {
  fifth_settlement: "التجمع الخامس",
  new_cairo_other: "القاهرة الجديدة — مناطق أخرى",
  new_cairo_unclassified: "القاهرة الجديدة — غير محدد الحي",
  sheikh_zayed: "الشيخ زايد",
  outside_coverage: "خارج النطاق",
  pending_verification: "قيد المراجعة",
};

export type MoodResult = CafeListItem & { moodScore: number; reasons: string[] };

export type HomepageData = {
  featuredCafes: CafeListItem[];
  totalCount: number;
  areaCounts: {
    fifth_settlement: number;
    sheikh_zayed: number;
    new_cairo: number;
  };
};

export type ListingInitialData = {
  initialCafes: CafeListItem[];
  totalCount: number;
};

export type DataQualityData = {
  total: number;
  byClass: Record<string, number>;
  withPhotos: number;
  withRating: number;
  withHours: number;
  withPhone: number;
  withPriceLevel: number;
  withAttributes: number;
  verifiedMenuItems: number;
  lastVerified: string | null;
};

