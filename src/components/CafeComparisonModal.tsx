import { useEffect, useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { X, Star, MapPin, Check, Minus, ExternalLink, ShieldCheck, GitCompareArrows, Trash2 } from "lucide-react";
import { type CafeListItem } from "@/lib/cafes.functions";
import { getCompareList, toggleCompareCafe, clearCompareList } from "@/lib/user-storage";
import { calculateBayesianRating, getCafeVerification, FACILITIES_LIST } from "@/lib/ranking-and-budget";

interface CafeComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  allCafes: CafeListItem[];
}

export function CafeComparisonModal({ isOpen, onClose, allCafes }: CafeComparisonModalProps) {
  const [compareIds, setCompareIds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setCompareIds(getCompareList());
    }
    const onStorage = () => setCompareIds(getCompareList());
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("cafelens_storage_update", onStorage);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("cafelens_storage_update", onStorage);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  const comparedCafes = useMemo(() => {
    return compareIds
      .map((id) => allCafes.find((c) => c.id === id))
      .filter((c): c is CafeListItem => Boolean(c));
  }, [compareIds, allCafes]);

  const handleRemove = (cafeId: string) => {
    toggleCompareCafe(cafeId);
    setCompareIds(getCompareList());
  };

  const handleClearAll = () => {
    clearCompareList();
    setCompareIds([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-md" onClick={onClose} />

      <div
        className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-2xl overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <GitCompareArrows className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold">مقارنة الكافيهات المباشرة</h2>
              <p className="text-xs text-muted-foreground">قارن حتى 3 كافيهات جنباً إلى جنب في التقييم والأسعار والخدمات</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {comparedCafes.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-rose-400 transition px-2 py-1"
              >
                <Trash2 className="h-3.5 w-3.5" /> مسح الكل
              </button>
            )}
            <button
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {comparedCafes.length === 0 ? (
          <div className="py-16 text-center space-y-4">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
              <GitCompareArrows className="h-8 w-8" />
            </div>
            <p className="font-semibold text-foreground text-lg">لم تقم بإضافة أي كافيه للمقارنة بعد</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              اضغط على زر "قارن" الموجود على أي كافيه في الموقع لمقارنته مع غيره واختيار الأنسب لخروجتك.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto flex-1 mt-4">
            <div className={`grid gap-4 min-w-[650px] ${comparedCafes.length === 1 ? "grid-cols-1" : comparedCafes.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
              {comparedCafes.map((c) => {
                const rawRating = Number(c.rating ?? 4.0);
                const reviewCount = Number(c.rating_count ?? 15);
                const bayesian = calculateBayesianRating(rawRating, reviewCount);
                const verification = getCafeVerification(c);
                const pLevel = c.price_level ?? 2;
                const priceLabels = ["", "اقتصادي ($)", "متوسط ($$)", "مرتفع ($$$)", "فاخر ($$$$)"];
                const servicesText = (c.services || []).join(" ").toLowerCase();

                return (
                  <div key={c.id} className="glass rounded-2xl p-4 flex flex-col justify-between border border-border/80">
                    <div>
                      {/* Top actions */}
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${verification.badgeClass}`}>
                          {verification.statusLabel}
                        </span>
                        <button
                          onClick={() => handleRemove(c.id)}
                          className="text-muted-foreground hover:text-rose-400 p-1"
                          title="حذف من المقارنة"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Photo & Name */}
                      <div className="space-y-2 mb-4">
                        <h3 className="font-display font-bold text-base sm:text-lg">{c.name}</h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-primary" /> {c.area}
                        </p>
                      </div>

                      {/* Key metrics grid */}
                      <div className="space-y-3 border-t border-border/60 pt-3 text-xs">
                        {/* Bayesian rating */}
                        <div className="flex items-center justify-between bg-primary/5 rounded-xl p-2.5">
                          <span className="text-muted-foreground">التقييم البيزي المعتمد:</span>
                          <span className="font-bold text-primary flex items-center gap-1 text-sm">
                            <Star className="h-4 w-4 fill-primary" /> {bayesian}
                            <span className="text-[10px] text-muted-foreground">({reviewCount} تقييم)</span>
                          </span>
                        </div>

                        {/* Price Level */}
                        <div className="flex items-center justify-between py-1 border-b border-border/40">
                          <span className="text-muted-foreground">مستوى الأسعار:</span>
                          <span className="font-semibold">{priceLabels[Number(pLevel)] || "متوسط ($$)"}</span>
                        </div>

                        {/* Source & Last Update */}
                        <div className="flex items-center justify-between py-1 border-b border-border/40">
                          <span className="text-muted-foreground">المصدر والتحديث:</span>
                          <span className="text-[11px] font-medium text-foreground">{verification.source}</span>
                        </div>

                        {/* Facilities Check */}
                        <div className="space-y-1.5 pt-2">
                          <span className="font-semibold block text-muted-foreground">توفر الخدمات والمرافق:</span>
                          <div className="space-y-1">
                            {FACILITIES_LIST.map((fac) => {
                              let hasIt = false;
                              if (fac.key === "outdoor" && (servicesText.includes("خارجية") || servicesText.includes("outdoor") || servicesText.includes("تراس"))) hasIt = true;
                              if (fac.key === "wifi" && (servicesText.includes("واي فاي") || servicesText.includes("wifi") || c.category === "work")) hasIt = true;
                              if (fac.key === "power_outlets" && (c.category === "work" || servicesText.includes("عمل") || servicesText.includes("مقابس"))) hasIt = true;
                              if (fac.key === "work_friendly" && (c.category === "work" || servicesText.includes("عمل"))) hasIt = true;
                              if (fac.key === "quiet" && (c.category === "work" || servicesText.includes("هدوء"))) hasIt = true;
                              if (fac.key === "ac") hasIt = true;
                              if (fac.key === "parking" && (servicesText.includes("مواقف") || c.name.toLowerCase().includes("mall") || (c.area || "").includes("مول"))) hasIt = true;

                              return (
                                <div key={fac.key} className="flex items-center justify-between text-[11px]">
                                  <span className="text-muted-foreground">{fac.label}</span>
                                  {hasIt ? (
                                    <span className="text-emerald-400 flex items-center gap-0.5 font-medium"><Check className="h-3.5 w-3.5" /> متوفر</span>
                                  ) : (
                                    <span className="text-muted-foreground/60 flex items-center gap-0.5"><Minus className="h-3.5 w-3.5" /> غير محدد</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom CTA */}
                    <div className="mt-4 pt-3 border-t border-border/60 flex gap-2">
                      <Link
                        to="/cafes/$slug"
                        params={{ slug: c.slug }}
                        onClick={onClose}
                        className="flex-1 text-center rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-glow"
                      >
                        عرض التفاصيل
                      </Link>
                      {c.maps_url && (
                        <a
                          href={c.maps_url}
                          target="_blank"
                          rel="noreferrer"
                          className="grid h-8 w-8 place-items-center rounded-xl border border-border/80 hover:bg-primary/10 transition"
                          title="خرائط جوجل"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
