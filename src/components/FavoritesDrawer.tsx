import { useEffect, useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { X, Heart, Bookmark, Trash2, Share2, MapPin, Star, ExternalLink, Calendar, Users, Coffee } from "lucide-react";
import { type CafeListItem } from "@/lib/cafes.functions";
import { getFavorites, toggleFavorite, getSavedPlans, deleteOutingPlan, type SavedOutingPlan } from "@/lib/user-storage";

interface FavoritesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  allCafes: CafeListItem[];
}

export function FavoritesDrawer({ isOpen, onClose, allCafes }: FavoritesDrawerProps) {
  const [activeTab, setActiveTab] = useState<"favorites" | "plans">("favorites");
  const [favIds, setFavIds] = useState<string[]>([]);
  const [plans, setPlans] = useState<SavedOutingPlan[]>([]);

  useEffect(() => {
    if (isOpen) {
      setFavIds(getFavorites());
      setPlans(getSavedPlans());
    }
    const onStorage = () => {
      setFavIds(getFavorites());
      setPlans(getSavedPlans());
    };
    window.addEventListener("cafelens_storage_update", onStorage);
    return () => window.removeEventListener("cafelens_storage_update", onStorage);
  }, [isOpen]);

  const favoriteCafes = useMemo(() => {
    return favIds
      .map((id) => allCafes.find((c) => c.id === id))
      .filter((c): c is CafeListItem => Boolean(c));
  }, [favIds, allCafes]);

  const handleRemoveFav = (cafeId: string) => {
    toggleFavorite(cafeId);
    setFavIds(getFavorites());
  };

  const handleDeletePlan = (planId: string) => {
    deleteOutingPlan(planId);
    setPlans(getSavedPlans());
  };

  const handleSharePlan = (plan: SavedOutingPlan) => {
    const text = encodeURIComponent(
      `خطة خروجة محفوظة من CaféLens:\n` +
      `المكان: ${plan.cafeName} (${plan.cafeArea})\n` +
      `عدد الأفراد: ${plan.peopleCount}\n` +
      `الميزانية المحددة: ${plan.budgetTotal} ج.م\n` +
      (plan.transportationBudget ? `ميزانية المواصلات: ${plan.transportationBudget} ج.م\n` : "") +
      `الأصناف المختارة:\n` +
      plan.items.map((i) => `• ${i.name} (عدد ${i.qty}) — ${i.price * i.qty} ج.م`).join("\n") +
      `\nالحساب الإجمالي التقريبي: ${plan.grandTotal} ج.م (شامل الخدمة والضريبة)\n` +
      (plan.mapsUrl ? `رابط الموقع: ${plan.mapsUrl}\n` : "") +
      `\nملاحظة: الأسعار تقديرية وفقاً لقوائم الأسعار المعتمدة على منصة CaféLens.`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Drawer Container */}
      <div
        className="relative z-10 flex h-full w-full max-w-md flex-col border-r border-border bg-card p-5 shadow-2xl overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Bookmark className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold">المفضلة وخططي</h2>
              <p className="text-xs text-muted-foreground">أماكنك المفضلة والخطط التي حفظتها</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-2 mt-4 p-1 rounded-2xl bg-muted/60">
          <button
            onClick={() => setActiveTab("favorites")}
            className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold transition ${
              activeTab === "favorites" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Heart className={`h-4 w-4 ${activeTab === "favorites" ? "text-rose-500 fill-rose-500" : ""}`} />
            الكافيهات المفضلة ({favoriteCafes.length})
          </button>
          <button
            onClick={() => setActiveTab("plans")}
            className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold transition ${
              activeTab === "plans" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calendar className="h-4 w-4 text-primary" />
            الخطط المحفوظة ({plans.length})
          </button>
        </div>

        {/* Tab 1: Favorite Cafes */}
        {activeTab === "favorites" && (
          <div className="flex-1 overflow-y-auto mt-4 space-y-3">
            {favoriteCafes.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <Heart className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <p className="text-sm font-medium text-foreground">قائمة المفضلة فارغة</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  اضغط على أيقونة القلب على أي كافيه لإضافته إلى قائمة الأماكن المفضلة للرجوع إليها سريعاً.
                </p>
              </div>
            ) : (
              favoriteCafes.map((c) => (
                <div key={c.id} className="glass rounded-2xl p-3 flex items-center justify-between gap-3 border border-border/80">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Link
                      to="/cafes/$slug"
                      params={{ slug: c.slug }}
                      onClick={onClose}
                      className="font-bold text-sm hover:text-primary transition truncate block"
                    >
                      {c.name}
                    </Link>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-primary" />{c.area}</span>
                      {c.rating != null && (
                        <span className="flex items-center gap-1 text-primary">
                          <Star className="h-3 w-3 fill-current" />{Number(c.rating).toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Link
                      to="/cafes/$slug"
                      params={{ slug: c.slug }}
                      onClick={onClose}
                      className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs text-primary font-medium hover:bg-primary/20 transition"
                    >
                      عرض
                    </Link>
                    <button
                      onClick={() => handleRemoveFav(c.id)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition"
                      title="حذف من المفضلة"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Saved Outing Plans */}
        {activeTab === "plans" && (
          <div className="flex-1 overflow-y-auto mt-4 space-y-3">
            {plans.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <p className="text-sm font-medium text-foreground">لا توجد خطط خروجة محفوظة</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  استخدم حاسبة الميزانية الذكية أو صفحة الكافيه واضغط "حفظ الخطة" للاحتفاظ بها ومشاركتها مع أصحابك.
                </p>
              </div>
            ) : (
              plans.map((p) => (
                <div key={p.id} className="glass rounded-2xl p-4 space-y-3 border border-border/80">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-foreground">{p.title || `خروجة ${p.cafeName}`}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 text-primary" /> {p.cafeName} — {p.cafeArea}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeletePlan(p.id)}
                      className="text-muted-foreground hover:text-rose-400 p-1 transition"
                      title="حذف الخطة"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Summary pills */}
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5">
                      <Users className="h-3 w-3 text-primary" /> {p.peopleCount} أفراد
                    </span>
                    <span className="rounded-md bg-primary/10 text-primary px-2 py-0.5 font-bold">
                      الإجمالي: {p.grandTotal} ج.م
                    </span>
                  </div>

                  {/* Items list preview */}
                  <div className="rounded-xl bg-background/60 p-2.5 space-y-1 text-xs">
                    {p.items.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="flex justify-between text-muted-foreground">
                        <span className="truncate">{item.name} × {item.qty}</span>
                        <span className="font-medium shrink-0">{item.price * item.qty} ج.م</span>
                      </div>
                    ))}
                    {p.items.length > 3 && (
                      <p className="text-[10px] text-muted-foreground text-left">+ {p.items.length - 3} أصناف أخرى</p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleSharePlan(p)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 text-white py-2 text-xs font-bold transition shadow-sm"
                    >
                      <Share2 className="h-3.5 w-3.5" /> مشاركة عبر واتساب
                    </button>
                    {p.cafeId && (
                      <Link
                        to="/cafes/$slug"
                        params={{ slug: p.cafeId }}
                        onClick={onClose}
                        className="rounded-xl border border-border/80 px-3 py-2 text-xs font-semibold hover:bg-primary/10 transition"
                      >
                        زيارة
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
