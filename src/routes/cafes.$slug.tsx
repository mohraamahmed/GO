import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import {
  Aperture, ArrowRight, BadgeCheck, Clock, ExternalLink, Globe, MapPin, Phone, Star,
  Heart, GitCompareArrows, Share2, Plus, Minus, Check, Sparkles, Coffee, Utensils,
  ShieldCheck, Calculator, Bookmark, CheckCircle2, AlertCircle
} from "lucide-react";
import { getCafe, type CafePhoto, type CafeListItem } from "@/lib/cafes.functions";
import { cafesQuery, menuQuery } from "@/lib/queries";
import {
  calculateBayesianRating, getCafeVerification, getCafeMenuData,
  calculateBillWithFees, findSmartAlternatives, type MenuItem
} from "@/lib/ranking-and-budget";
import {
  isFavorite, toggleFavorite, isInCompareList, toggleCompareCafe,
  saveOutingPlan, getCompareList
} from "@/lib/user-storage";
import { CafeComparisonModal } from "@/components/CafeComparisonModal";
import { FavoritesDrawer } from "@/components/FavoritesDrawer";

const cafeQuery = (slug: string) =>
  queryOptions({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }), staleTime: 5 * 60_000 });

export const Route = createFileRoute("/cafes/$slug")({
  loader: async ({ params, context }) => {
    const c = await context.queryClient.ensureQueryData(cafeQuery(params.slug));
    if (!c) throw notFound();
    return c;
  },
  head: ({ loaderData }) => {
    const photo = (loaderData?.photos as CafePhoto[] | undefined)?.[0]?.url;
    const title = loaderData ? `${loaderData.name} — ${loaderData.area} | CaféLens` : "كافيه | CaféLens";
    const desc = loaderData ? `${loaderData.name} في ${loaderData.area}: المنيو، الأسعار، التقييم البيزي، والموقع.` : "تفاصيل الكافيه";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(photo ? [{ property: "og:image", content: photo }, { name: "twitter:image", content: photo }] : []),
      ],
    };
  },
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center bg-background text-foreground" dir="rtl">
      <div className="text-center space-y-4">
        <p className="text-2xl font-bold font-display">الكافيه غير موجود أو تم نقله</p>
        <Link to="/cafes" className="inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">
          تصفح كل الكافيهات
        </Link>
      </div>
    </div>
  ),
  component: CafePage,
});

const PRICE_LABELS = ["", "اقتصادي ($)", "متوسط ($$)", "مرتفع ($$$)", "فاخر ($$$$)"];

function CafePage() {
  const { slug } = Route.useParams();
  const { data: c } = useSuspenseQuery(cafeQuery(slug));
  const { data: allCafes = [] } = useQuery(cafesQuery);
  const menuQ = useQuery({ ...menuQuery(c?.id ?? ""), enabled: !!c?.id });

  // UI state
  const [selectedCategory, setSelectedCategory] = useState<string>("الكل");
  const [menuSearch, setMenuSearch] = useState("");
  const [pickedItems, setPickedItems] = useState<Record<string, number>>({});
  const [hasServiceCharge, setHasServiceCharge] = useState(true);
  const [hasVat, setHasVat] = useState(true);
  const [peopleCount, setPeopleCount] = useState(1);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [compareSuccess, setCompareSuccess] = useState<string | null>(null);

  // Storage / Modals
  const [isFav, setIsFav] = useState(false);
  const [inCompare, setInCompare] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);

  useEffect(() => {
    if (c?.id) {
      setIsFav(isFavorite(c.id));
      setInCompare(isInCompareList(c.id));
    }
  }, [c?.id]);

  if (!c) return null;

  const rawRating = Number(c.rating ?? 4.0);
  const reviewCount = Number(c.rating_count ?? 15);
  const bayesian = calculateBayesianRating(rawRating, reviewCount);
  const verification = getCafeVerification(c as unknown as CafeListItem);
  const photos = ((c.photos as CafePhoto[]) || []).filter((p) => p.url);
  const embed = `https://www.google.com/maps/embed/v1/place?key=${import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"]}&q=place_id:${c.id}&language=ar`;

  // Menu items resolution
  const menuData: MenuItem[] = useMemo(() => {
    return getCafeMenuData(c, menuQ.data?.items);
  }, [c, menuQ.data]);

  // Categories available in this menu
  const categories = useMemo(() => {
    const set = new Set<string>();
    menuData.forEach((m) => set.add(m.categoryLabel));
    return ["الكل", ...Array.from(set)];
  }, [menuData]);

  // Filtered menu
  const filteredMenuItems = useMemo(() => {
    return menuData.filter((item) => {
      const matchCat = selectedCategory === "الكل" || selectedCategory === "all" || item.categoryLabel === selectedCategory;
      const matchSearch = !menuSearch.trim() || item.name.toLowerCase().includes(menuSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [menuData, selectedCategory, menuSearch]);

  // Bill calculations
  const billItems = useMemo(() => {
    return Object.entries(pickedItems)
      .map(([id, qty]) => {
        const it = menuData.find((m) => m.id === id);
        return it ? { ...it, qty } : null;
      })
      .filter((it): it is MenuItem & { qty: number } => Boolean(it));
  }, [pickedItems, menuData]);

  const rawSubtotal = billItems.reduce((acc, it) => acc + it.price * it.qty, 0);
  const billFees = useMemo(() => {
    return calculateBillWithFees(rawSubtotal, { hasServiceCharge, hasVat });
  }, [rawSubtotal, hasServiceCharge, hasVat]);

  // Quantity controls
  const updateQty = (id: string, delta: number) => {
    setPickedItems((prev) => {
      const current = prev[id] ?? 0;
      const next = current + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: next };
    });
  };

  const handleToggleFav = () => {
    const next = toggleFavorite(c.id);
    setIsFav(next);
  };

  const handleToggleCompare = () => {
    const res = toggleCompareCafe(c.id);
    setInCompare(res.inList);
    if (res.error) {
      setCompareSuccess(res.error);
      setTimeout(() => setCompareSuccess(null), 3500);
    } else {
      setCompareSuccess(res.inList ? "تمت الإضافة لقائمة المقارنة" : "تم الحذف من المقارنة");
      setTimeout(() => setCompareSuccess(null), 2500);
    }
  };

  const handleSaveOuting = () => {
    if (billItems.length === 0) return;
    saveOutingPlan({
      title: `خروجة في ${c.name}`,
      cafeId: c.id,
      cafeName: c.name,
      cafeArea: c.area || "",
      peopleCount,
      budgetTotal: billFees.grandTotal,
      transportationBudget: 0,
      items: billItems.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
      subtotal: billFees.subtotal,
      serviceAmount: billFees.serviceAmount,
      vatAmount: billFees.vatAmount,
      grandTotal: billFees.grandTotal,
      mapsUrl: c.maps_url || undefined,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const shareOutingOnWhatsApp = () => {
    const itemsText = billItems.length > 0
      ? billItems.map((i) => `• ${i.name} (عدد ${i.qty}) — ${i.price * i.qty} ج.م`).join("\n")
      : "• لم يتم تحديد أصناف مسبقاً";

    const text = encodeURIComponent(
      `خروجة مقترحة في كافيه «${c.name}» — ${c.area}\n` +
      `التقييم البيزي: ★${bayesian} (${reviewCount} تجربة موثقة)\n` +
      `عدد الأفراد: ${peopleCount}\n\n` +
      `الطلبات المختارة:\n${itemsText}\n\n` +
      `تفاصيل الفاتورة المقدرة:\n` +
      `• الحساب الأساسي: ${billFees.subtotal} ج.م\n` +
      (hasServiceCharge ? `• رسوم الخدمة (12%): ${billFees.serviceAmount} ج.م\n` : "") +
      (hasVat ? `• ضريبة القيمة المضافة (14%): ${billFees.vatAmount} ج.م\n` : "") +
      `• الإجمالي النهائي: ${billFees.grandTotal} ج.م\n\n` +
      (c.maps_url ? `الموقع على خرائط جوجل: ${c.maps_url}\n\n` : "") +
      `تنبيه: الأسعار تقديرية وفقاً لقوائم CaféLens المعتمدة.`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  // Smart alternatives in same area
  const alternatives = useMemo(() => {
    if (!allCafes.length) return [];
    return findSmartAlternatives(c.id, allCafes, 250, "combo", ["wifi", "outdoor"], 3);
  }, [allCafes, c.id]);

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      {/* Header Bar */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 pt-6">
        <Link to="/cafes" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowRight className="h-4 w-4" /> كل الكافيهات
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsFavoritesOpen(true)}
            className="glass flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <Bookmark className="h-3.5 w-3.5 text-primary" /> المفضلة والخطط
          </button>
          <button
            onClick={() => setIsCompareModalOpen(true)}
            className="glass flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <GitCompareArrows className="h-3.5 w-3.5 text-primary" /> المقارنة ({getCompareList().length})
          </button>
          <Link to="/" className="flex items-center gap-2" dir="ltr">
            <Aperture className="h-7 w-7 text-primary" strokeWidth={1.5} />
            <span className="font-latin text-xl font-semibold">CaféLens</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 pb-28 pt-7">

        {/* HERO */}
        {photos.length > 0 ? (
          <div className="relative overflow-hidden rounded-3xl h-64 md:h-96 lg:h-[26rem] xl:h-[30rem]">
            <img
              src={photos[0].url!}
              alt={c.name}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute bottom-0 inset-x-0 p-6">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${verification.badgeClass}`}>
                  {verification.statusLabel}
                </span>
                {c.price_level ? (
                  <span className="text-[11px] text-muted-foreground bg-background/70 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-border/40">
                    {PRICE_LABELS[c.price_level]}
                  </span>
                ) : null}
              </div>
              <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground leading-tight">{c.name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-primary" />{c.area}</span>
                {c.rating != null && (
                  <span className="flex items-center gap-1 text-primary font-bold">
                    <Star className="h-3.5 w-3.5 fill-current" /> {bayesian}
                    <span className="text-[11px] font-normal text-muted-foreground">({reviewCount} تقييم)</span>
                  </span>
                )}
              </div>
            </div>
            {photos[0].by.length > 0 && (
              <div className="absolute top-3 left-3 text-[10px] text-white/60 bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full" dir="ltr">
                © {photos[0].by.join(", ")} · Google Maps
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-3xl bg-card/60 border border-border/60 p-8">
            <h1 className="font-display text-4xl font-bold">{c.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4 text-primary" />{c.area}</span>
              {c.rating != null && (
                <span className="flex items-center gap-1 text-primary font-bold">
                  <Star className="h-4 w-4 fill-current" /> {bayesian}
                  <span className="text-xs font-normal text-muted-foreground">({reviewCount} تقييم)</span>
                </span>
              )}
              {c.price_level ? <span>{PRICE_LABELS[c.price_level]}</span> : null}
            </div>
          </div>
        )}

        {/* QUICK ACTIONS */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={handleToggleFav}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold border transition ${
              isFav
                ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
                : "border-border/60 glass text-muted-foreground hover:text-rose-400 hover:border-rose-500/30"
            }`}
          >
            <Heart className={`h-3.5 w-3.5 ${isFav ? "fill-rose-500 text-rose-500" : ""}`} />
            {isFav ? "في المفضلة" : "أضف للمفضلة"}
          </button>
          <button
            onClick={handleToggleCompare}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold border transition ${
              inCompare
                ? "bg-primary/15 border-primary/40 text-primary"
                : "border-border/60 glass text-muted-foreground hover:text-primary"
            }`}
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
            {inCompare ? "في المقارنة" : "قارن"}
          </button>
          {c.maps_url && (
            <a
              href={c.maps_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold border border-border/60 glass text-muted-foreground hover:text-foreground transition"
            >
              <ExternalLink className="h-3.5 w-3.5" /> خرائط جوجل
            </a>
          )}
          {c.phone && (
            <a
              href={`tel:${c.phone}`}
              className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold border border-border/60 glass text-muted-foreground hover:text-foreground transition"
              dir="ltr"
            >
              <Phone className="h-3.5 w-3.5" /> {c.phone}
            </a>
          )}
        </div>

        {compareSuccess && (
          <div className="mt-3 rounded-xl bg-primary/10 border border-primary/25 px-3 py-2 text-xs text-primary flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {compareSuccess}
          </div>
        )}

        {/* SERVICES PILLS */}
        {c.services.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {c.services.map((s) => (
              <span key={s} className="rounded-full border border-border/50 bg-secondary/50 px-3 py-1 text-xs text-muted-foreground">
                {s}
              </span>
            ))}
          </div>
        )}

        {/* MENU & BILL */}
        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <Coffee className="h-5 w-5 text-primary" /> المنيو وحاسبة الخروجة
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">أضف طلباتك واحسب التكلفة بالضريبة والخدمة</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">عدد الأفراد:</span>
              <div className="flex items-center rounded-full border border-border/60 bg-secondary/40 px-1">
                <button
                  onClick={() => setPeopleCount((p) => Math.max(1, p - 1))}
                  className="grid h-7 w-7 place-items-center rounded-full hover:text-primary transition"
                  disabled={peopleCount <= 1}
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="px-2 text-sm font-bold text-primary">{peopleCount}</span>
                <button
                  onClick={() => setPeopleCount((p) => p + 1)}
                  className="grid h-7 w-7 place-items-center rounded-full hover:text-primary transition"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            {/* BILL PANEL — comes first in DOM so it renders on LEFT in RTL grid */}
            <div className="lg:col-span-4 order-last lg:order-first">
              <div className="rounded-2xl border border-border/50 bg-card/50 p-5 space-y-4 lg:sticky lg:top-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-base flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-primary" /> فاتورة الخروجة
                  </h3>
                  <span className="text-xs text-muted-foreground bg-secondary/60 px-2.5 py-1 rounded-full">{billItems.length} صنف</span>
                </div>

                {billItems.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <Coffee className="h-7 w-7 text-muted-foreground/30 mx-auto" />
                    <p className="text-xs text-muted-foreground">اضغط + لإضافة أصناف</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto">
                    {billItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-xs">
                        <span className="truncate text-muted-foreground flex-1 ml-2">{item.name} × {item.qty}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">{item.price * item.qty} ج.م</span>
                          <button
                            onClick={() => updateQty(item.id, -item.qty)}
                            className="text-muted-foreground/60 hover:text-rose-400 transition text-[10px]"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-border/40 pt-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">رسوم الخدمة 12%</span>
                    <button
                      onClick={() => setHasServiceCharge(!hasServiceCharge)}
                      className={`relative h-5 w-9 rounded-full transition ${hasServiceCharge ? "bg-primary" : "bg-secondary"}`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${hasServiceCharge ? "right-0.5" : "left-0.5"}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">ضريبة القيمة المضافة 14%</span>
                    <button
                      onClick={() => setHasVat(!hasVat)}
                      className={`relative h-5 w-9 rounded-full transition ${hasVat ? "bg-primary" : "bg-secondary"}`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${hasVat ? "right-0.5" : "left-0.5"}`} />
                    </button>
                  </div>
                </div>

                <div className="border-t border-border/40 pt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>الحساب الأساسي</span>
                    <span>{billFees.subtotal} ج.م</span>
                  </div>
                  {hasServiceCharge && billFees.serviceAmount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>رسوم الخدمة</span>
                      <span>+{billFees.serviceAmount} ج.م</span>
                    </div>
                  )}
                  {hasVat && billFees.vatAmount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>ضريبة القيمة المضافة</span>
                      <span>+{billFees.vatAmount} ج.م</span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline pt-2 border-t border-border/40 mt-1">
                    <span className="text-sm font-bold text-foreground">الإجمالي ({peopleCount} {peopleCount === 1 ? "فرد" : "أفراد"})</span>
                    <span className="text-lg font-bold text-primary">{billFees.grandTotal * peopleCount} ج.م</span>
                  </div>
                  {peopleCount > 1 && (
                    <p className="text-[11px] text-muted-foreground text-left">{billFees.grandTotal} ج.م للفرد</p>
                  )}
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    onClick={shareOutingOnWhatsApp}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 text-xs font-bold transition"
                  >
                    <Share2 className="h-3.5 w-3.5" /> شارك عبر واتساب
                  </button>
                  <button
                    onClick={handleSaveOuting}
                    disabled={billItems.length === 0}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-primary/30 hover:bg-primary/15 text-primary py-2.5 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {saveSuccess
                      ? <><Check className="h-3.5 w-3.5" /> تم الحفظ!</>
                      : <><Bookmark className="h-3.5 w-3.5" /> احفظ الخطة</>
                    }
                  </button>
                </div>
              </div>
            </div>

            {/* MENU ITEMS — right side in RTL */}
            <div className="space-y-4 lg:col-span-8">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                        selectedCategory === cat
                          ? "bg-primary text-primary-foreground"
                          : "border border-border/50 bg-secondary/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="بحث..."
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  className="w-32 rounded-full border border-border/50 bg-secondary/40 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition"
                />
              </div>

              <div className="space-y-2 max-h-[520px] overflow-y-auto pl-1">
                {filteredMenuItems.map((item) => {
                  const qty = pickedItems[item.id] ?? 0;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition ${
                        qty > 0
                          ? "border-primary/30 bg-primary/5"
                          : "border-border/40 bg-card/40 hover:border-border/70"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <h4 className="text-sm font-semibold text-foreground truncate">{item.name}</h4>
                          <span className="text-[10px] text-muted-foreground shrink-0">{item.categoryLabel}</span>
                        </div>
                        {item.desc && (
                          <p className="text-xs text-muted-foreground/80 truncate mt-0.5">{item.desc}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold text-primary">{item.price}<span className="text-[10px] font-normal text-muted-foreground"> ج.م</span></span>
                        <div className="flex items-center gap-1">
                          {qty > 0 && (
                            <>
                              <button
                                onClick={() => updateQty(item.id, -1)}
                                className="grid h-7 w-7 place-items-center rounded-full border border-border/50 bg-secondary/60 hover:bg-secondary transition"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-5 text-center text-xs font-bold text-primary">{qty}</span>
                            </>
                          )}
                          <button
                            onClick={() => updateQty(item.id, 1)}
                            className={`grid h-7 w-7 place-items-center rounded-full transition ${
                              qty > 0
                                ? "bg-primary text-primary-foreground"
                                : "border border-primary/40 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                            }`}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>


        {/* INFO ROW */}
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border/40 bg-card/40 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
              <Clock className="h-4 w-4 text-primary" /> مواعيد العمل
            </h2>
            {c.hours.length ? (
              <ul className="space-y-1 text-sm text-muted-foreground" dir="ltr">
                {c.hours.map((h) => <li key={h}>{h}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">غير متاحة حالياً</p>
            )}
          </div>
          <div className="rounded-2xl border border-border/40 bg-card/40 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">التواصل والعنوان</h2>
            {c.address && (
              <p className="flex gap-2 text-sm text-muted-foreground" dir="auto">
                <MapPin className="h-4 w-4 shrink-0 text-primary mt-0.5" />{c.address}
              </p>
            )}
            {c.phone && (
              <a href={`tel:${c.phone}`} className="flex gap-2 text-sm text-muted-foreground hover:text-foreground transition" dir="ltr">
                <Phone className="h-4 w-4 text-primary" />{c.phone}
              </a>
            )}
            {c.website && (
              <a href={c.website} target="_blank" rel="noreferrer" className="flex gap-2 text-sm text-muted-foreground hover:text-foreground truncate transition" dir="ltr">
                <Globe className="h-4 w-4 shrink-0 text-primary" />{c.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </div>

        {/* SMART ALTERNATIVES */}
        {alternatives.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-lg font-bold flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-primary" /> بدائل مقترحة في {c.area}
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {alternatives.map(({ cafe: altCafe, score, rationale }) => (
                <div key={altCafe.id} className="rounded-2xl border border-border/40 bg-card/40 p-4 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {score.matchScore}% توافق
                      </span>
                      <span className="text-xs text-primary font-bold flex items-center gap-0.5">
                        <Star className="h-3 w-3 fill-current" /> {score.bayesianRating.toFixed(1)}
                      </span>
                    </div>
                    <h3 className="font-semibold text-sm text-foreground">{altCafe.name}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">{rationale}</p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">~{score.expectedCost} ج.م/فرد</span>
                    <Link
                      to="/cafes/$slug"
                      params={{ slug: altCafe.slug }}
                      className="rounded-lg bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1 text-xs font-semibold transition"
                    >
                      عرض
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* MAP */}
        <section className="mt-8 overflow-hidden rounded-2xl border border-border/40">
          <iframe
            title={`خريطة ${c.name}`}
            src={embed}
            className="h-72 w-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </section>

        {/* VERIFICATION FOOTER */}
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border/30 bg-card/30 px-4 py-3">
          <BadgeCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{verification.source}</span>
            {" · "}آخر تحديث {verification.lastUpdated}
            {" — "}{verification.notes}
          </div>
        </div>
      </main>

      <CafeComparisonModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        allCafes={allCafes}
      />
      <FavoritesDrawer
        isOpen={isFavoritesOpen}
        onClose={() => setIsFavoritesOpen(false)}
        allCafes={allCafes}
      />
    </div>
  );
}
