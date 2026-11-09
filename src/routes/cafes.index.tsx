import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import {
  MapPin, Search, Star, Heart, GitCompareArrows, ShieldCheck,
  Filter, RotateCcw, ChevronLeft, Sparkles, Coffee, Laptop, Wind, Wifi, Car,
} from "lucide-react";
import { AREA_CLASS_LABELS, type CafePhoto, type CafeListItem } from "@/lib/cafes.functions";
import { cafesQuery } from "@/lib/queries";
import { getCafeVerification, calculateBayesianRating } from "@/lib/ranking-and-budget";
import { isFavorite, toggleFavorite, isInCompareList, toggleCompareCafe } from "@/lib/user-storage";
import { SmartImage } from "@/components/SmartImage";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";

export type CafesSort = "popular" | "rating" | "bayesian" | "price_asc" | "price_desc";

export interface CafesSearch {
  q?: string | undefined;
  area?: string | undefined;
  sort?: CafesSort | undefined;
  service?: string | undefined;
  price?: string | undefined;
}

export const Route = createFileRoute("/cafes/")({
  validateSearch: (search: Record<string, unknown>): CafesSearch => {
    const rawQ = search["q"];
    const rawArea = search["area"];
    const rawSort = search["sort"];
    const rawService = search["service"];
    const rawPrice = search["price"];

    const q = typeof rawQ === "string" && rawQ.trim() ? rawQ.trim() : undefined;
    const area = typeof rawArea === "string" && rawArea.trim() ? rawArea.trim() : undefined;
    const sort = typeof rawSort === "string" && ["popular", "rating", "bayesian", "price_asc", "price_desc"].includes(rawSort)
      ? (rawSort as CafesSort)
      : undefined;
    const service = typeof rawService === "string" && rawService.trim() ? rawService.trim() : undefined;
    const price = typeof rawPrice === "string" && rawPrice.trim() ? rawPrice.trim() : undefined;

    return { q, area, sort, service, price };
  },
  head: () => ({
    meta: [
      { title: "دليل الكافيهات الموثقة — القاهرة الجديدة والشيخ زايد | CaféLens" },
      { name: "description", content: "دليل حقيقي موثق لكافيهات القاهرة الجديدة والتجمع الخامس والشيخ زايد بالعناوين والمواعيد والصور والتقييمات الموثقة والمنيو." },
      { property: "og:title", content: "دليل الكافيهات الموثقة | CaféLens" },
      { property: "og:description", content: "كافيهات حقيقية في القاهرة الجديدة والشيخ زايد، بالمواعيد والصور والتقييمات وحساب الفاتورة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(cafesQuery),
  component: CafesPage,
});

const PAGE_SIZE = 24;

const AREA_FILTERS = [
  { value: "all", label: "كل المناطق" },
  { value: "fifth_settlement", label: "التجمع الخامس" },
  { value: "new_cairo", label: "القاهرة الجديدة" },
  { value: "sheikh_zayed", label: "الشيخ زايد" },
];

const SERVICE_FILTERS = [
  { key: "specialty", label: "قهوة مختصة", icon: Coffee },
  { key: "work", label: "مناسب للعمل", icon: Laptop },
  { key: "outdoor", label: "جلسات خارجية", icon: Wind },
  { key: "wifi", label: "واي فاي", icon: Wifi },
  { key: "parking", label: "موقف سيارات", icon: Car },
];

function CafesPage() {
  const { data } = useSuspenseQuery(cafesQuery);
  const searchParams = Route.useSearch();
  const navigate = useNavigate();

  const q = searchParams.q ?? "";
  const areaFilter = searchParams.area ?? "all";
  const sort = searchParams.sort ?? "bayesian";
  const serviceFilter = searchParams.service ?? null;
  const priceFilter = searchParams.price ? Number(searchParams.price) : null;

  const [shown, setShown] = useState(PAGE_SIZE);
  const [searchInput, setSearchInput] = useState(q);
  const [storageCounter, setStorageCounter] = useState(0);

  // Sync internal input when URL query changes
  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  // Listen for favorites / compare updates
  useEffect(() => {
    const onStorage = () => setStorageCounter((c) => c + 1);
    window.addEventListener("cafelens_storage_update", onStorage);
    return () => window.removeEventListener("cafelens_storage_update", onStorage);
  }, []);

  const updateFilters = (updates: Record<string, string | undefined>) => {
    navigate({
      to: "/cafes",
      search: (prev: any) => {
        const next = { ...prev, ...updates };
        if (next.area === "all") delete next.area;
        Object.keys(next).forEach((key) => {
          if (!next[key]) delete next[key];
        });
        return next;
      },
    });
    setShown(PAGE_SIZE);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ q: searchInput.trim() || undefined });
  };

  const hasActiveFilters = Boolean(
    q || (areaFilter && areaFilter !== "all") || serviceFilter || priceFilter || sort !== "bayesian"
  );

  const resetAllFilters = () => {
    setSearchInput("");
    navigate({ to: "/cafes", search: {} as any });
    setShown(PAGE_SIZE);
  };

  // Filter and sort the list
  const filteredList = useMemo(() => {
    const term = q.trim().toLowerCase();

    let l = data.filter((c) => {
      // Area filter
      if (areaFilter && areaFilter !== "all") {
        if (areaFilter === "new_cairo") {
          if (!c.area_class.startsWith("new_cairo")) return false;
        } else if (c.area_class !== areaFilter) {
          return false;
        }
      }

      // Keyword / Text Search
      if (term) {
        const nameMatches = c.name.toLowerCase().includes(term);
        const addressMatches = (c.address ?? "").toLowerCase().includes(term);
        const areaMatches = (c.area ?? "").toLowerCase().includes(term);
        const serviceMatches = c.services.some((s) => s.toLowerCase().includes(term));
        if (!nameMatches && !addressMatches && !areaMatches && !serviceMatches) return false;
      }

      // Services filter (Real fields only)
      if (serviceFilter) {
        if (serviceFilter === "specialty") {
          const isRoastery = c.category === "coffee_roastery";
          const hasSpecialty = c.services.some((s) => s.includes("مختصة") || s.toLowerCase().includes("specialty"));
          if (!isRoastery && !hasSpecialty) return false;
        } else if (serviceFilter === "outdoor") {
          const hasOutdoor = c.services.some((s) => s.includes("خارجية") || s.toLowerCase().includes("outdoor"));
          if (!hasOutdoor) return false;
        } else if (serviceFilter === "work") {
          const hasWork = c.services.some((s) => s.includes("عمل") || s.includes("مذاكرة") || s.toLowerCase().includes("work"));
          const hasWifi = c.services.some((s) => s.includes("واي فاي") || s.toLowerCase().includes("wifi"));
          if (!hasWork && !hasWifi) return false;
        } else if (serviceFilter === "wifi") {
          const hasWifi = c.services.some((s) => s.includes("واي فاي") || s.toLowerCase().includes("wifi"));
          if (!hasWifi) return false;
        } else if (serviceFilter === "parking") {
          const hasParking = c.services.some((s) => s.includes("سيارات") || s.includes("باركينج") || s.toLowerCase().includes("parking") || s.toLowerCase().includes("valet"));
          if (!hasParking) return false;
        }
      }

      // Price filter
      if (priceFilter != null) {
        if (c.price_level !== priceFilter) return false;
      }

      return true;
    });

    // Sorting
    if (sort === "bayesian") {
      l = [...l].sort((a, b) => {
        const bA = calculateBayesianRating(Number(a.rating ?? 4.0), Number(a.rating_count ?? 15));
        const bB = calculateBayesianRating(Number(b.rating ?? 4.0), Number(b.rating_count ?? 15));
        return bB - bA;
      });
    } else if (sort === "rating") {
      l = [...l].sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0));
    } else if (sort === "price_asc") {
      l = [...l].sort((a, b) => Number(a.price_level ?? 2) - Number(b.price_level ?? 2));
    } else if (sort === "price_desc") {
      l = [...l].sort((a, b) => Number(b.price_level ?? 2) - Number(a.price_level ?? 2));
    } else if (sort === "popular") {
      l = [...l].sort((a, b) => Number(b.rating_count ?? 0) - Number(a.rating_count ?? 0));
    }

    return l;
  }, [data, q, areaFilter, serviceFilter, priceFilter, sort]);

  const visibleList = useMemo(() => filteredList.slice(0, shown), [filteredList, shown]);

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <main className="mx-auto max-w-6xl px-4 sm:px-6 pb-24 pt-6 sm:pt-10">

        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/70 pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-0.5 text-xs font-bold text-primary mb-2">
              <Sparkles className="h-3.5 w-3.5" /> الدليل الرسمي المعتمد
            </div>
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold">
              دليل <span className="text-gold">كافيهات القاهرة</span>
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">
              {data.length} كافيه حقيقي موثق بالأسعار الرسمية والتقييم البيزي في التجمع الخامس، القاهرة الجديدة، والشيخ زايد.
            </p>
          </div>

          {/* Quick Counter */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <span className="rounded-2xl border border-border/80 bg-card/60 px-4 py-2 text-xs font-semibold text-foreground">
              النتائج المتاحة: <strong className="text-primary font-bold">{filteredList.length}</strong> كافيه
            </span>
          </div>
        </div>

        {/* Filter Toolbar */}
        <section aria-label="شريط البحث والفلاتر" className="mt-6 space-y-4">

          {/* Search Input & Sort Selector */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary pointer-events-none" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="ابحث بالاسم، المكان، أو المنطقة (مثل Waterway، Arkan، التسعين)..."
                className="w-full rounded-2xl border border-border/80 bg-card/70 py-3 pr-11 pl-20 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
              />
              <Button
                type="submit"
                variant="gold"
                size="sm"
                className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-xl text-xs font-bold px-3 h-8"
              >
                بحث
              </Button>
            </form>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">ترتيب حسب:</span>
              <select
                value={sort}
                onChange={(e) => updateFilters({ sort: e.target.value as any })}
                className="rounded-2xl border border-border/80 bg-card/80 py-2.5 px-3 text-xs font-semibold text-foreground outline-none focus:border-primary transition cursor-pointer"
              >
                <option value="bayesian">الأعلى تقييماً بيزياً (Bayesian)</option>
                <option value="popular">الأكثر شهرة وزيارات</option>
                <option value="rating">التقييم الخام من جوجل</option>
                <option value="price_asc">السعر: من الأقل للأعلى</option>
                <option value="price_desc">السعر: من الأعلى للأقل</option>
              </select>
            </div>
          </div>

          {/* Area Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1 ml-1">
              <MapPin className="h-3.5 w-3.5 text-primary" /> المنطقة:
            </span>
            {AREA_FILTERS.map((a) => {
              const isActive = areaFilter === a.value || (a.value === "all" && !areaFilter);
              return (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => updateFilters({ area: a.value })}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium transition cursor-pointer ${isActive
                      ? "bg-primary text-primary-foreground font-bold shadow-sm"
                      : "border border-border/70 bg-card/50 text-foreground/80 hover:bg-card/90 hover:border-primary/40"
                    }`}
                >
                  {a.label}
                </button>
              );
            })}
          </div>

          {/* Services & Price Level Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border/40">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="text-xs font-semibold text-muted-foreground ml-1">الخدمات:</span>
              {SERVICE_FILTERS.map((s) => {
                const isActive = serviceFilter === s.key;
                const Icon = s.icon;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => updateFilters({ service: isActive ? undefined : s.key })}
                    className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs transition cursor-pointer ${isActive
                        ? "bg-primary/20 border border-primary text-primary font-bold shadow-sm"
                        : "border border-border/60 bg-card/40 text-muted-foreground hover:text-foreground hover:bg-card/80"
                      }`}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Price Level Badges */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">السعر:</span>
              {[
                { level: 1, label: "$" },
                { level: 2, label: "$$" },
                { level: 3, label: "$$$" },
                { level: 4, label: "$$$$" },
              ].map((p) => {
                const isActive = priceFilter === p.level;
                return (
                  <button
                    key={p.level}
                    type="button"
                    onClick={() => updateFilters({ price: isActive ? undefined : String(p.level) })}
                    className={`rounded-lg px-2 py-0.5 text-xs font-mono font-bold transition cursor-pointer ${isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "border border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    {p.label}
                  </button>
                );
              })}

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="mr-2 inline-flex items-center gap-1 text-xs text-destructive hover:underline cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" /> إعادة تعيين
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Results Grid or Empty State */}
        <section aria-label="قائمة الكافيهات" className="mt-8">
          {filteredList.length === 0 ? (
            <EmptyState
              title="لم نجد كافيهات مطابقة لبحثك"
              description="جرب البحث بكلمات بديلة أو تغيير المنطقة أو إزالة بعض الفلاتر لعرض نتائج أوسع."
              actionLabel="إعادة ضبط جميع الفلاتر"
              onAction={resetAllFilters}
              className="my-12 py-12"
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleList.map((c, idx) => {
                const photo = (c.photos as CafePhoto[])[0];
                const verification = getCafeVerification(c);
                const isFav = isFavorite(c.id);
                const inCompare = isInCompareList(c.id);
                const ratingNum = Number(c.rating ?? 4.0);
                const reviewsNum = Number(c.rating_count ?? 10);
                const bayesian = calculateBayesianRating(ratingNum, reviewsNum);

                const handleToggleFav = (e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleFavorite(c.id);
                  setStorageCounter((v) => v + 1);
                };

                const handleToggleCompare = (e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const res = toggleCompareCafe(c.id);
                  setStorageCounter((v) => v + 1);
                  if (res.error) {
                    toast.error(res.error);
                  } else {
                    toast.success(res.inList ? "تمت إضافة الكافيه إلى المقارنة" : "تمت إزالة الكافيه من المقارنة");
                  }
                };

                return (
                  <div
                    key={c.id}
                    className="group relative rounded-2xl border border-border/70 bg-card overflow-hidden hover:border-primary/50 transition duration-300 shadow-sm hover:shadow-lg flex flex-col justify-between"
                  >
                    <div>
                      {/* Media container */}
                      <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-muted">
                        <SmartImage
                          src={photo?.url}
                          alt={c.name}
                          priority={idx < 6}
                          className="h-full w-full object-cover group-hover:scale-105 transition duration-500"
                        />
                        <span className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />

                        {/* Top-right: Verification badge */}
                        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-md border ${verification.badgeClass}`}>
                            {verification.statusLabel}
                          </span>
                        </div>

                        {/* Top-left: Favorite & Compare buttons */}
                        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleToggleFav}
                            aria-label={isFav ? "إزالة من المفضلة" : "إضافة للمفضلة"}
                            className={`grid h-8 w-8 place-items-center rounded-full backdrop-blur-md transition cursor-pointer ${isFav
                                ? "bg-rose-500 text-white shadow-md shadow-rose-500/30"
                                : "bg-background/80 text-foreground/80 hover:bg-background hover:text-rose-500"
                              }`}
                            title="إضافة للمفضلة"
                          >
                            <Heart className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
                          </button>
                          <button
                            type="button"
                            onClick={handleToggleCompare}
                            aria-label={inCompare ? "إزالة من المقارنة" : "إضافة للمقارنة"}
                            className={`grid h-8 w-8 place-items-center rounded-full backdrop-blur-md transition cursor-pointer ${inCompare
                                ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                                : "bg-background/80 text-foreground/80 hover:bg-background hover:text-primary"
                              }`}
                            title="إضافة للمقارنة"
                          >
                            <GitCompareArrows className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Bottom-left: Rating & Price */}
                        <div className="absolute bottom-2.5 left-3 z-10 flex items-center gap-1.5">
                          {c.price_level != null && (
                            <span className="rounded-full bg-background/80 backdrop-blur-md px-2 py-0.5 text-xs font-mono font-bold text-primary">
                              {"$".repeat(c.price_level)}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 rounded-full bg-background/80 backdrop-blur-md px-2 py-0.5 text-xs font-bold text-foreground">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            <span>★{bayesian}</span>
                            <span className="text-[10px] text-muted-foreground font-normal">({reviewsNum})</span>
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4 space-y-2.5">
                        <Link
                          to="/cafes/$slug"
                          params={{ slug: c.slug }}
                          className="font-latin text-lg font-bold text-foreground hover:text-primary transition line-clamp-1 block"
                          dir="auto"
                        >
                          {c.name}
                        </Link>

                        <p className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="truncate">{AREA_CLASS_LABELS[c.area_class] ?? c.area}</span>
                        </p>

                        {/* Services tags */}
                        <div className="flex flex-wrap gap-1 pt-1 min-h-[22px]">
                          {c.services.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className="rounded-md bg-secondary/80 px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Link */}
                    <div className="px-4 py-3 border-t border-border/50 flex items-center justify-between text-xs bg-muted/20">
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <ShieldCheck className="h-3.5 w-3.5 text-primary" /> موثق رسمياً
                      </span>
                      <Link
                        to="/cafes/$slug"
                        params={{ slug: c.slug }}
                        className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
                      >
                        التفاصيل والمنيو <ChevronLeft className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination / View More */}
          {shown < filteredList.length && (
            <div className="mt-10 flex flex-col items-center gap-2">
              <span className="text-xs text-muted-foreground">
                عرض {shown} من أصل {filteredList.length} كافيه
              </span>
              <Button
                variant="gold-outline"
                size="lg"
                onClick={() => setShown((s) => s + PAGE_SIZE)}
                className="rounded-2xl font-bold px-8 shadow-sm"
              >
                عرض المزيد من الكافيهات (+{PAGE_SIZE})
              </Button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
