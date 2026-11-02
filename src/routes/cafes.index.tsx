import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { Aperture, MapPin, Search, Star, Heart, GitCompareArrows, Bookmark, ShieldCheck } from "lucide-react";
import { AREA_CLASS_LABELS, type CafePhoto, type CafeListItem } from "@/lib/cafes.functions";
import { cafesQuery } from "@/lib/queries";
import { getCafeVerification, calculateBayesianRating } from "@/lib/ranking-and-budget";
import { isFavorite, toggleFavorite, isInCompareList, toggleCompareCafe, getCompareList } from "@/lib/user-storage";
import { CafeComparisonModal } from "@/components/CafeComparisonModal";
import { FavoritesDrawer } from "@/components/FavoritesDrawer";

export const Route = createFileRoute("/cafes/")({
  head: () => ({
    meta: [
      { title: "كل الكافيهات — القاهرة الجديدة والشيخ زايد | CaféLens" },
      { name: "description", content: "دليل حقيقي لكافيهات القاهرة الجديدة والتجمع الخامس والشيخ زايد بالعناوين والمواعيد والصور والتقييمات الموثقة." },
      { property: "og:title", content: "كل الكافيهات | CaféLens" },
      { property: "og:description", content: "كافيهات حقيقية في القاهرة الجديدة والشيخ زايد، بالمواعيد والصور والتقييمات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(cafesQuery),
  component: CafesPage,
});

const CLASS_ORDER = ["fifth_settlement", "new_cairo_other", "new_cairo_unclassified", "sheikh_zayed"] as const;
const PAGE = 48;

function CafesPage() {
  const { data } = useSuspenseQuery(cafesQuery);
  const [areaClass, setAreaClass] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"popular" | "rating" | "bayesian">("popular");
  const [shown, setShown] = useState(PAGE);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [updateCounter, setUpdateCounter] = useState(0);

  useEffect(() => {
    const onStorage = () => setUpdateCounter((c) => c + 1);
    window.addEventListener("cafelens_storage_update", onStorage);
    return () => window.removeEventListener("cafelens_storage_update", onStorage);
  }, []);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of data) m[c.area_class] = (m[c.area_class] ?? 0) + 1;
    return m;
  }, [data]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    let l = data.filter(
      (c) =>
        (!areaClass || c.area_class === areaClass) &&
        (!t || c.name.toLowerCase().includes(t) || (c.address ?? "").toLowerCase().includes(t)),
    );
    if (sort === "rating") {
      l = [...l].sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0));
    } else if (sort === "bayesian") {
      l = [...l].sort((a, b) => {
        const bA = calculateBayesianRating(Number(a.rating ?? 4.0), Number(a.rating_count ?? 10));
        const bB = calculateBayesianRating(Number(b.rating ?? 4.0), Number(b.rating_count ?? 10));
        return bB - bA;
      });
    }
    return l;
  }, [data, areaClass, q, sort]);

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 pt-6">
        <Link to="/" className="flex items-center gap-3" dir="ltr">
          <Aperture className="h-9 w-9 text-primary" strokeWidth={1.5} />
          <span className="font-latin text-2xl font-semibold">CaféLens</span>
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsFavoritesOpen(true)}
            className="glass flex items-center gap-1.5 rounded-full px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <Bookmark className="h-3.5 w-3.5 text-primary" /> المفضلة والخطط
          </button>
          <button
            onClick={() => setIsCompareOpen(true)}
            className="glass flex items-center gap-1.5 rounded-full px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <GitCompareArrows className="h-3.5 w-3.5 text-primary" /> المقارنة ({getCompareList().length})
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20 pt-10">
        <h1 className="font-display text-4xl font-bold md:text-5xl">
          كل <span className="text-gold">الكافيهات</span>
        </h1>
        <p className="mt-2 text-muted-foreground">{data.length} كافيه حقيقي موثق من خرائط جوجل — القاهرة الجديدة والشيخ زايد فقط.</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label className="glass flex flex-1 items-center gap-2 rounded-full px-4 py-2.5 min-w-[220px]">
            <Search className="h-4 w-4 text-primary shrink-0" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setShown(PAGE); }}
              placeholder="ابحث باسم الكافيه أو المكان (مثلاً Waterway أو Arkan)"
              className="w-full bg-transparent outline-none placeholder:text-muted-foreground text-sm"
            />
          </label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "popular" | "rating" | "bayesian")}
            className="glass rounded-full px-4 py-2.5 outline-none text-xs font-semibold bg-background cursor-pointer"
          >
            <option value="popular" className="bg-background">الأكثر شهرة وتجربة</option>
            <option value="bayesian" className="bg-background">الأعلى تقييماً بيزياً (Bayesian)</option>
            <option value="rating" className="bg-background">التقييم الخام</option>
          </select>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => { setAreaClass(null); setShown(PAGE); }}
            className={`rounded-full px-4 py-1.5 text-sm transition ${areaClass === null ? "bg-primary text-primary-foreground font-bold" : "glass hover:shadow-glow"}`}
          >
            الكل ({data.length})
          </button>
          {CLASS_ORDER.filter((k) => counts[k]).map((k) => (
            <button
              key={k}
              onClick={() => { setAreaClass(k); setShown(PAGE); }}
              className={`rounded-full px-4 py-1.5 text-sm transition ${areaClass === k ? "bg-primary text-primary-foreground font-bold" : "glass hover:shadow-glow"}`}
            >
              {AREA_CLASS_LABELS[k]} ({counts[k]})
            </button>
          ))}
        </div>

        <p className="mt-6 text-sm text-muted-foreground">{list.length} نتيجة مطابقة</p>

        <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.slice(0, shown).map((c) => {
            const photo = (c.photos as CafePhoto[])[0];
            const verification = getCafeVerification(c);
            const isFav = isFavorite(c.id);
            const inCompare = isInCompareList(c.id);

            return (
              <div key={c.id} className="glass group overflow-hidden rounded-2xl transition hover:shadow-glow border border-border/80 flex flex-col justify-between">
                <div>
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    {photo?.url ? (
                      <img src={photo.url} alt={c.name} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="grid h-full place-items-center text-muted-foreground"><Aperture className="h-10 w-10" /></div>
                    )}
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-md border ${verification.badgeClass}`}>
                        {verification.statusLabel}
                      </span>
                    </div>

                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          toggleFavorite(c.id);
                        }}
                        className={`grid h-8 w-8 place-items-center rounded-full backdrop-blur-md transition ${
                          isFav ? "bg-rose-500 text-white shadow-glow" : "bg-background/80 text-muted-foreground hover:text-rose-400"
                        }`}
                        title="المفضلة"
                      >
                        <Heart className={`h-4 w-4 ${isFav ? "fill-white" : ""}`} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          toggleCompareCafe(c.id);
                        }}
                        className={`grid h-8 w-8 place-items-center rounded-full backdrop-blur-md transition ${
                          inCompare ? "bg-primary text-primary-foreground shadow-glow" : "bg-background/80 text-muted-foreground hover:text-foreground"
                        }`}
                        title="مقارنة"
                      >
                        <GitCompareArrows className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Link to="/cafes/$slug" params={{ slug: c.slug }} className="font-bold text-base hover:text-primary transition line-clamp-1" dir="auto">
                        {c.name}
                      </Link>
                      {c.rating != null && (
                        <span className="flex shrink-0 items-center gap-1 text-xs text-primary font-bold">
                          <Star className="h-3.5 w-3.5 fill-current" />{Number(c.rating).toFixed(1)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                      <MapPin className="h-3 w-3 shrink-0 text-primary" />
                      <span className="truncate">{AREA_CLASS_LABELS[c.area_class] ?? c.area}{c.rating_count ? ` · ${c.rating_count} تقييم` : ""}</span>
                    </div>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-1 flex items-center justify-between border-t border-border/40 text-xs">
                  <span className="text-muted-foreground font-medium">
                    {c.price_level === 1 ? "اقتصادي $" : c.price_level === 3 ? "مرتفع $$$" : c.price_level === 4 ? "فاخر $$$$" : "متوسط $$"}
                  </span>
                  <Link
                    to="/cafes/$slug"
                    params={{ slug: c.slug }}
                    className="font-bold text-primary hover:underline"
                  >
                    عرض التفاصيل والمنيو ←
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {shown < list.length && (
          <div className="mt-8 text-center">
            <button
              onClick={() => setShown((s) => s + PAGE)}
              className="glass rounded-full px-6 py-3 text-sm font-bold transition hover:shadow-glow"
            >
              عرض المزيد من الكافيهات
            </button>
          </div>
        )}
      </main>

      {/* Comparison Modal */}
      <CafeComparisonModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        allCafes={data}
      />

      {/* Favorites Drawer */}
      <FavoritesDrawer
        isOpen={isFavoritesOpen}
        onClose={() => setIsFavoritesOpen(false)}
        allCafes={data}
      />
    </div>
  );
}
