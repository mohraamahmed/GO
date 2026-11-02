// Shared admin constants and pure validation helpers (client-safe).

export const STAFF_ROLES = ["super_admin", "admin", "data_manager", "content_reviewer", "support"] as const;
export type AppRole = (typeof STAFF_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "مشرف عام",
  admin: "مدير",
  data_manager: "مدير بيانات",
  content_reviewer: "مراجع محتوى",
  support: "دعم",
};

export const AREA_CLASSES = [
  "fifth_settlement",
  "new_cairo_other",
  "new_cairo_unclassified",
  "sheikh_zayed",
  "outside_coverage",
  "pending_verification",
] as const;
export type AreaClass = (typeof AREA_CLASSES)[number];

export const AREA_CLASS_ADMIN_LABELS: Record<AreaClass, string> = {
  fifth_settlement: "التجمع الخامس",
  new_cairo_other: "القاهرة الجديدة — مناطق أخرى",
  new_cairo_unclassified: "القاهرة الجديدة — غير محدد الحي",
  sheikh_zayed: "الشيخ زايد",
  outside_coverage: "خارج نطاق المنصة",
  pending_verification: "يحتاج مراجعة",
};

export const MENU_CATEGORIES = [
  "Coffee",
  "Cold Drinks",
  "Tea",
  "Specialty Coffee",
  "Desserts",
  "Bakery",
  "Breakfast",
  "Brunch",
  "Food",
] as const;

export const PRICE_STATUSES = [
  "official_current",
  "owner_confirmed",
  "admin_verified",
  "user_reported",
  "unverified",
  "stale",
  "disputed",
  "discontinued",
] as const;
export type PriceStatus = (typeof PRICE_STATUSES)[number];

export const PRICE_STATUS_LABELS: Record<PriceStatus, string> = {
  official_current: "رسمي حالي",
  owner_confirmed: "مؤكد من المالك",
  admin_verified: "معتمد من الإدارة",
  user_reported: "بلاغ مستخدم",
  unverified: "غير مؤكد",
  stale: "قديم",
  disputed: "متعارض",
  discontinued: "متوقف",
};

// Statuses the public site may show as verified menu data.
export const PUBLIC_PRICE_STATUSES: PriceStatus[] = ["official_current", "owner_confirmed", "admin_verified"];

export const PHOTO_STATUSES = ["approved", "pending_review", "rejected", "permission_required", "expired"] as const;
export type PhotoStatus = (typeof PHOTO_STATUSES)[number];

export const PHOTO_STATUS_LABELS: Record<PhotoStatus, string> = {
  approved: "معتمدة",
  pending_review: "قيد المراجعة",
  rejected: "مرفوضة",
  permission_required: "تتطلب إذنًا",
  expired: "منتهية الصلاحية",
};

export const VERIFICATION_TYPES = [
  "new_cafe",
  "new_branch",
  "address",
  "photo",
  "menu",
  "price",
  "service",
  "hours",
  "correction",
  "conflict",
] as const;
export type VerificationType = (typeof VERIFICATION_TYPES)[number];

export const VERIFICATION_TYPE_LABELS: Record<VerificationType, string> = {
  new_cafe: "كافيه جديد",
  new_branch: "فرع جديد",
  address: "عنوان غير مؤكد",
  photo: "صورة تحتاج مراجعة",
  menu: "منيو مقدم للمراجعة",
  price: "سعر يحتاج تأكيدًا",
  service: "خدمة غير مؤكدة",
  hours: "ساعات عمل قديمة",
  correction: "طلب تصحيح",
  conflict: "بيانات متعارضة",
};

export const SOURCE_TYPES = [
  "official_site",
  "official_menu",
  "owner_confirmation",
  "maps_provider",
  "user_report",
  "licensed_photo",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  official_site: "الموقع الرسمي",
  official_menu: "المنيو الرسمي",
  owner_confirmation: "تأكيد صاحب النشاط",
  maps_provider: "مزود الخرائط",
  user_report: "تقرير مستخدم",
  licensed_photo: "صورة مرخصة",
};

export function isStaffRole(role: string): role is AppRole {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

export function isValidAreaClass(value: string): value is AreaClass {
  return (AREA_CLASSES as readonly string[]).includes(value);
}

export function isValidPriceStatus(value: string): value is PriceStatus {
  return (PRICE_STATUSES as readonly string[]).includes(value);
}

export function isValidPhotoStatus(value: string): value is PhotoStatus {
  return (PHOTO_STATUSES as readonly string[]).includes(value);
}

/** Area reclassification always requires a human reason and a source — never a guess. */
export function canReclassifyArea(input: { areaClass: string; reason: string; source: string }): boolean {
  return isValidAreaClass(input.areaClass) && input.reason.trim().length >= 3 && input.source.trim().length >= 3;
}

/** A price may only be published publicly when its status is a verified-equivalent one. */
export function isPubliclyVisiblePrice(status: string): boolean {
  return (PUBLIC_PRICE_STATUSES as readonly string[]).includes(status);
}
