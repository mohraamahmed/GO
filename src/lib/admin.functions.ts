import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  isValidAreaClass,
  isValidPriceStatus,
  isValidPhotoStatus,
  canReclassifyArea,
  MENU_CATEGORIES,
  VERIFICATION_TYPES,
  SOURCE_TYPES,
} from "@/lib/admin-shared";

type Ctx = { supabase: any; userId: string };

async function requireStaff(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("is_staff", { _user_id: ctx.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: staff access required");
}

async function audit(
  ctx: Ctx,
  entry: {
    action: string;
    table_name: string;
    record_id: string;
    old_value?: unknown;
    new_value?: unknown;
    reason?: string;
    source?: string;
  },
) {
  const { error } = await ctx.supabase.from("audit_log").insert({
    actor_id: ctx.userId,
    action: entry.action,
    table_name: entry.table_name,
    record_id: entry.record_id,
    old_value: (entry.old_value ?? null) as Database["public"]["Tables"]["audit_log"]["Insert"]["old_value"],
    new_value: (entry.new_value ?? null) as Database["public"]["Tables"]["audit_log"]["Insert"]["new_value"],
    reason: entry.reason ?? null,
    source: entry.source ?? null,
  });
  if (error) throw new Error(error.message);
}

const str = (v: unknown, max = 500) => String(v ?? "").slice(0, max);

// ---------- Roles ----------

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const { data, error } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: { role: string }) => r.role) as string[];
  });

// ---------- Dashboard ----------

export const adminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    await requireStaff(ctx);
    const c = ctx.supabase;
    const [cafes, attrs, menus, prices, photos, requests, audit] = await Promise.all([
      c.from("cafes").select("area_class, photos, archived_at, verified_at"),
      c.from("cafe_attributes").select("cafe_id", { count: "exact", head: true }),
      c.from("menu_items").select("verification_status, retrieved_at"),
      c.from("menu_item_price_history").select("id", { count: "exact", head: true }),
      c.from("cafe_photos").select("status"),
      c.from("verification_requests").select("status, type"),
      c.from("audit_log").select("id", { count: "exact", head: true }),
    ]);
    if (cafes.error) throw new Error(cafes.error.message);
    const rows = cafes.data ?? [];
    const active = rows.filter((r: any) => !r.archived_at);
    const byClass: Record<string, number> = {};
    for (const r of active) byClass[r.area_class] = (byClass[r.area_class] ?? 0) + 1;
    const menuRows = (menus.data ?? []) as any[];
    const byPriceStatus: Record<string, number> = {};
    for (const m of menuRows) byPriceStatus[m.verification_status] = (byPriceStatus[m.verification_status] ?? 0) + 1;
    const photoRows = (photos.data ?? []) as any[];
    const byPhotoStatus: Record<string, number> = {};
    for (const p of photoRows) byPhotoStatus[p.status] = (byPhotoStatus[p.status] ?? 0) + 1;
    const reqRows = (requests.data ?? []) as any[];
    const pendingByType: Record<string, number> = {};
    for (const r of reqRows.filter((r) => r.status === "pending"))
      pendingByType[r.type] = (pendingByType[r.type] ?? 0) + 1;
    return {
      totalCafes: rows.length,
      activeCafes: active.length,
      archivedCafes: rows.length - active.length,
      byClass,
      withoutPhotos: active.filter((r: any) => !Array.isArray(r.photos) || r.photos.length === 0).length,
      withAttributes: attrs.count ?? 0,
      menuItems: menuRows.length,
      byPriceStatus,
      priceChanges: prices.count ?? 0,
      photos: photoRows.length,
      byPhotoStatus,
      pendingRequests: reqRows.filter((r) => r.status === "pending").length,
      pendingByType,
      auditEntries: audit.count ?? 0,
    };
  });

// ---------- Cafés ----------

export const adminListCafes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; areaClass?: string; archived?: boolean }) => ({
    search: d.search ? str(d.search, 120) : "",
    areaClass: d.areaClass ? str(d.areaClass, 40) : "",
    archived: Boolean(d.archived),
  }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireStaff(ctx);
    let q = ctx.supabase
      .from("cafes")
      .select(
        "id,slug,name,area,area_class,address,rating,rating_count,price_level,category,source,verified_at,archived_at,area_classified_by,area_review_reason,photos",
      )
      .order("verified_at", { ascending: false })
      .limit(1000);
    q = data.archived ? q.not("archived_at", "is", null) : q.is("archived_at", null);
    if (data.areaClass) q = q.eq("area_class", data.areaClass);
    if (data.search) q = q.or(`name.ilike.%${data.search}%,address.ilike.%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminUpdateCafe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: Record<string, unknown>; reason: string; source?: string }) => ({
    id: str(d.id, 120),
    patch: d.patch ?? {},
    reason: str(d.reason, 500),
    source: d.source ? str(d.source, 500) : "",
  }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireStaff(ctx);
    if (data.reason.trim().length < 3) throw new Error("سبب التعديل مطلوب");
    const allowed = ["name", "address", "area", "phone", "website", "hours", "services", "category", "price_level", "lat", "lng"] as const;
    const patch: Record<string, unknown> = {};
    for (const k of allowed) if (k in data.patch) patch[k] = data.patch[k];
    if (Object.keys(patch).length === 0) throw new Error("لا توجد حقول قابلة للتعديل");
    const { data: old, error: e1 } = await ctx.supabase.from("cafes").select("*").eq("id", data.id).maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!old) throw new Error("الكافيه غير موجود");
    const { error } = await ctx.supabase.from("cafes").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(ctx, {
      action: "update",
      table_name: "cafes",
      record_id: data.id,
      old_value: Object.fromEntries(Object.keys(patch).map((k) => [k, (old as any)[k]])),
      new_value: patch,
      reason: data.reason,
      source: data.source,
    });
    return { ok: true };
  });

export const adminArchiveCafe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; reason: string; restore?: boolean }) => ({
    id: str(d.id, 120),
    reason: str(d.reason, 500),
    restore: Boolean(d.restore),
  }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireStaff(ctx);
    if (data.reason.trim().length < 3) throw new Error("السبب مطلوب");
    const patch = data.restore ? { archived_at: null } : { archived_at: new Date().toISOString() };
    const { error } = await ctx.supabase.from("cafes").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(ctx, {
      action: data.restore ? "restore" : "archive",
      table_name: "cafes",
      record_id: data.id,
      new_value: patch,
      reason: data.reason,
    });
    return { ok: true };
  });

// ---------- Area review ----------

export const adminReclassifyArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; areaClass: string; reason: string; source: string }) => ({
    id: str(d.id, 120),
    areaClass: str(d.areaClass, 40),
    reason: str(d.reason, 500),
    source: str(d.source, 500),
  }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireStaff(ctx);
    if (!canReclassifyArea(data)) throw new Error("التصنيف يتطلب سببًا ومصدرًا واضحين — لا تصنيف بالتخمين");
    const { data: old, error: e1 } = await ctx.supabase
      .from("cafes")
      .select("area_class")
      .eq("id", data.id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!old) throw new Error("الكافيه غير موجود");
    const patch = {
      area_class: data.areaClass,
      area_class_source: data.source,
      area_classified_at: new Date().toISOString(),
      area_classified_by: ctx.userId,
      area_review_reason: data.reason,
    };
    const { error } = await ctx.supabase.from("cafes").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(ctx, {
      action: "reclassify_area",
      table_name: "cafes",
      record_id: data.id,
      old_value: { area_class: old.area_class },
      new_value: { area_class: data.areaClass },
      reason: data.reason,
      source: data.source,
    });
    return { ok: true };
  });

// ---------- Menu & prices ----------

export const adminListMenu = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cafeId: string }) => ({ cafeId: str(d.cafeId, 120) }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireStaff(ctx);
    const { data: items, error } = await ctx.supabase
      .from("menu_items")
      .select("*")
      .eq("cafe_id", data.cafeId)
      .order("category")
      .order("name");
    if (error) throw new Error(error.message);
    return items ?? [];
  });

export const adminUpsertMenuItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      cafeId: string;
      name: string;
      nameAr?: string;
      category: string;
      size?: string;
      price: number;
      priceStatus: string;
      source: string;
      reason: string;
    }) => ({
      id: d.id ? str(d.id, 60) : undefined,
      cafeId: str(d.cafeId, 120),
      name: str(d.name, 200),
      nameAr: d.nameAr ? str(d.nameAr, 200) : "",
      category: str(d.category, 60),
      size: d.size ? str(d.size, 60) : "",
      price: Number(d.price),
      priceStatus: str(d.priceStatus, 40),
      source: str(d.source, 500),
      reason: str(d.reason, 500),
    }),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireStaff(ctx);
    if (!data.name.trim()) throw new Error("اسم الصنف مطلوب");
    if (!(data.price > 0)) throw new Error("السعر يجب أن يكون أكبر من صفر");
    if (!isValidPriceStatus(data.priceStatus)) throw new Error("حالة السعر غير صالحة");
    if (!(MENU_CATEGORIES as readonly string[]).includes(data.category)) throw new Error("التصنيف غير صالح");
    if (data.source.trim().length < 3) throw new Error("مصدر السعر مطلوب");
    if (data.reason.trim().length < 3) throw new Error("سبب التعديل مطلوب");

    const row = {
      name: data.nameAr ? `${data.name} / ${data.nameAr}` : data.name,
      category: data.category,
      size: data.size || null,
      price: data.price,
      currency: "EGP",
      price_source: data.source,
      verification_status: data.priceStatus,
      retrieved_at: new Date().toISOString(),
      verified_at: ["official_current", "owner_confirmed", "admin_verified"].includes(data.priceStatus)
        ? new Date().toISOString()
        : null,
    };

    if (data.id) {
      const { data: old, error: e1 } = await ctx.supabase.from("menu_items").select("*").eq("id", data.id).maybeSingle();
      if (e1) throw new Error(e1.message);
      if (!old) throw new Error("الصنف غير موجود");
      const { error } = await ctx.supabase.from("menu_items").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      if (Number(old.price) !== data.price) {
        const { error: he } = await ctx.supabase.from("menu_item_price_history").insert({
          menu_item_id: data.id,
          price: old.price,
          currency: old.currency,
          source: old.price_source,
          changed_by: ctx.userId,
          reason: `سعر سابق قبل التحديث: ${data.reason}`,
        });
        if (he) throw new Error(he.message);
      }
      await audit(ctx, {
        action: "update",
        table_name: "menu_items",
        record_id: data.id,
        old_value: { name: old.name, price: old.price, verification_status: old.verification_status },
        new_value: row,
        reason: data.reason,
        source: data.source,
      });
      return { ok: true, id: data.id };
    }

    const { data: inserted, error } = await ctx.supabase
      .from("menu_items")
      .insert({ ...row, cafe_id: data.cafeId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(ctx, {
      action: "create",
      table_name: "menu_items",
      record_id: inserted.id,
      new_value: { ...row, cafe_id: data.cafeId },
      reason: data.reason,
      source: data.source,
    });
    return { ok: true, id: inserted.id as string };
  });

export const adminPriceHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { menuItemId: string }) => ({ menuItemId: str(d.menuItemId, 60) }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireStaff(ctx);
    const { data: rows, error } = await ctx.supabase
      .from("menu_item_price_history")
      .select("*")
      .eq("menu_item_id", data.menuItemId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- Photos ----------

export const adminListPhotos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; cafeId?: string }) => ({
    status: d.status ? str(d.status, 40) : "",
    cafeId: d.cafeId ? str(d.cafeId, 120) : "",
  }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireStaff(ctx);
    let q = ctx.supabase
      .from("cafe_photos")
      .select("*, cafes(name, slug)")
      .order("uploaded_at", { ascending: false })
      .limit(500);
    if (data.status) q = q.eq("status", data.status);
    if (data.cafeId) q = q.eq("cafe_id", data.cafeId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminAddPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { cafeId: string; url: string; source: string; rightsHolder?: string; licenseType?: string; permissionProof?: string }) => ({
      cafeId: str(d.cafeId, 120),
      url: str(d.url, 1000),
      source: str(d.source, 500),
      rightsHolder: d.rightsHolder ? str(d.rightsHolder, 300) : "",
      licenseType: d.licenseType ? str(d.licenseType, 120) : "",
      permissionProof: d.permissionProof ? str(d.permissionProof, 1000) : "",
    }),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireStaff(ctx);
    if (!/^https:\/\//.test(data.url)) throw new Error("رابط الصورة يجب أن يبدأ بـ https");
    if (data.source.trim().length < 3) throw new Error("مصدر الصورة مطلوب");
    const { data: inserted, error } = await ctx.supabase
      .from("cafe_photos")
      .insert({
        cafe_id: data.cafeId,
        url: data.url,
        source: data.source,
        rights_holder: data.rightsHolder || null,
        license_type: data.licenseType || null,
        permission_proof: data.permissionProof || null,
        status: "pending_review",
        uploaded_by: ctx.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(ctx, {
      action: "create",
      table_name: "cafe_photos",
      record_id: inserted.id,
      new_value: { cafe_id: data.cafeId, url: data.url },
      source: data.source,
    });
    return { ok: true, id: inserted.id as string };
  });

export const adminReviewPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: string; reason: string }) => ({
    id: str(d.id, 60),
    status: str(d.status, 40),
    reason: str(d.reason, 500),
  }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireStaff(ctx);
    if (!isValidPhotoStatus(data.status)) throw new Error("حالة الصورة غير صالحة");
    if (data.reason.trim().length < 3) throw new Error("سبب القرار مطلوب");
    const { data: old, error: e1 } = await ctx.supabase.from("cafe_photos").select("status").eq("id", data.id).maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!old) throw new Error("الصورة غير موجودة");
    const { error } = await ctx.supabase
      .from("cafe_photos")
      .update({ status: data.status, reviewed_by: ctx.userId, reviewed_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(ctx, {
      action: "review_photo",
      table_name: "cafe_photos",
      record_id: data.id,
      old_value: { status: old.status },
      new_value: { status: data.status },
      reason: data.reason,
    });
    return { ok: true };
  });

// ---------- Verification center ----------

export const adminListVerification = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; type?: string }) => ({
    status: d.status ? str(d.status, 40) : "pending",
    type: d.type ? str(d.type, 40) : "",
  }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireStaff(ctx);
    let q = ctx.supabase
      .from("verification_requests")
      .select("*, cafes(name, slug)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status) q = q.eq("status", data.status);
    if (data.type) q = q.eq("type", data.type);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminDecideVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; decision: string; reason: string }) => ({
    id: str(d.id, 60),
    decision: str(d.decision, 20),
    reason: str(d.reason, 500),
  }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireStaff(ctx);
    if (!["approved", "rejected"].includes(data.decision)) throw new Error("القرار غير صالح");
    if (data.reason.trim().length < 3) throw new Error("سبب القبول أو الرفض مطلوب");
    const { data: old, error: e1 } = await ctx.supabase
      .from("verification_requests")
      .select("status")
      .eq("id", data.id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!old) throw new Error("الطلب غير موجود");
    const { error } = await ctx.supabase
      .from("verification_requests")
      .update({ status: data.decision, reviewed_by: ctx.userId, reviewed_at: new Date().toISOString(), decision_reason: data.reason })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(ctx, {
      action: `verification_${data.decision}`,
      table_name: "verification_requests",
      record_id: data.id,
      old_value: { status: old.status },
      new_value: { status: data.decision },
      reason: data.reason,
    });
    return { ok: true };
  });

// ---------- Sources registry ----------

export const adminListSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    await requireStaff(ctx);
    const { data: rows, error } = await ctx.supabase
      .from("sources")
      .select("*, cafes(name, slug)")
      .order("retrieved_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminAddSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { name: string; type: string; url?: string; cafeId?: string; supportsField?: string; notes?: string }) => ({
      name: str(d.name, 300),
      type: str(d.type, 60),
      url: d.url ? str(d.url, 1000) : "",
      cafeId: d.cafeId ? str(d.cafeId, 120) : "",
      supportsField: d.supportsField ? str(d.supportsField, 120) : "",
      notes: d.notes ? str(d.notes, 1000) : "",
    }),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireStaff(ctx);
    if (data.name.trim().length < 2) throw new Error("اسم المصدر مطلوب");
    if (!(SOURCE_TYPES as readonly string[]).includes(data.type)) throw new Error("نوع المصدر غير صالح");
    const { data: inserted, error } = await ctx.supabase
      .from("sources")
      .insert({
        name: data.name,
        type: data.type,
        url: data.url || null,
        cafe_id: data.cafeId || null,
        supports_field: data.supportsField || null,
        notes: data.notes || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(ctx, {
      action: "create",
      table_name: "sources",
      record_id: inserted.id,
      new_value: { name: data.name, type: data.type },
    });
    return { ok: true, id: inserted.id as string };
  });

// ---------- Audit log ----------

export const adminAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number }) => ({ limit: Math.min(Number(d.limit) || 200, 500) }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireStaff(ctx);
    const { data: rows, error } = await ctx.supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- Public: signed-in users submit correction requests ----------

export const submitCorrectionRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { type: string; cafeId?: string; message: string }) => ({
    type: str(d.type, 40),
    cafeId: d.cafeId ? str(d.cafeId, 120) : "",
    message: str(d.message, 2000),
  }))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    if (!(VERIFICATION_TYPES as readonly string[]).includes(data.type)) throw new Error("نوع الطلب غير صالح");
    if (data.message.trim().length < 10) throw new Error("اكتب تفاصيل كافية (10 أحرف على الأقل)");
    const { error } = await ctx.supabase.from("verification_requests").insert({
      type: data.type,
      cafe_id: data.cafeId || null,
      payload: { message: data.message },
      submitted_by: ctx.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
