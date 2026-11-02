import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import {
  Aperture, ArrowRight, BadgeCheck, Clock, ExternalLink, Globe, MapPin, Phone, Star,
  Heart, GitCompareArrows, Share2, Plus, Minus, Check, Sparkles, Coffee, Utensils,
  ShieldCheck, Calculator, Bookmark, CheckCircle2, Wifi, Zap, Wind, Laptop, Car,
  VolumeX, Copy, Navigation, CheckCheck, Users, Eye
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
    const desc = loaderData ? `${loaderData.name} في ${loaderData.area}: المنيو الكامل، الأسعار الرسمية، التقييم، وحاسبة الفاتورة الذكية.` : "تفاصيل الكافيه";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "theme-color", content: "#1a0f0a" },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "CaféLens" },
        { property: "og:image", content: photo || "https://cafe-lens1.vercel.app/og-image.jpg" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: photo || "https://cafe-lens1.vercel.app/og-image.jpg" },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center bg-background text-foreground" dir="rtl">
      <div className="text-center space-y-4 p-8 rounded-3xl border border-border/40 bg-card/40 backdrop-blur-xl max-w-md mx-4">
        <Aperture className="h-12 w-12 text-primary mx-auto animate-pulse" />
        <h1 className="text-2xl font-bold font-display">الكافيه غير موجود أو تم نقله</h1>
        <p className="text-sm text-muted-foreground">تأكد من صحة الرابط أو تصفح تشكيلة كافيهات القاهرة المعتمدة لدينا.</p>
        <Link to="/cafes" className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition">
          <ArrowRight className="h-4 w-4" /> تصفح كل الكافيهات
        </Link>
      </div>
    </div>
  ),
  component: CafePage,
});

const PRICE_LABELS = ["", "اقتصادي ($)", "متوسط ($$)", "مرتفع ($$$)", "فاخر ($$$$)"];

const SERVICE_ICONS: Record<string, typeof Wifi> = {
  "واي فاي": Wifi,
  "wifi": Wifi,
  "جلسات خارجية": Wind,
  "outdoor": Wind,
  "مناسب للعمل": Laptop,
  "work": Laptop,
  "مقابس كهرباء": Zap,
  "outlets": Zap,
  "موقف سيارات": Car,
  "parking": Car,
  "أجواء هادئة": VolumeX,
  "quiet": VolumeX,
};

function CafePage() {
  const { slug } = Route.useParams();
  const { data: c } = useSuspenseQuery(cafeQuery(slug));
  const { data: allCafes = [] } = useQuery(cafesQuery);
  const menuQ = useQuery({ ...menuQuery(c?.id ?? ""), enabled: !!c?.id });

  // UI state
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("الكل");
  const [menuSearch, setMenuSearch] = useState("");
  const [pickedItems, setPickedItems] = useState<Record<string, number>>({});
  const [hasServiceCharge, setHasServiceCharge] = useState(true);
  const [hasVat, setHasVat] = useState(true);
  const [peopleCount, setPeopleCount] = useState(1);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [compareSuccess, setCompareSuccess] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);

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

  // Reliable Map URLs (Standard Google embed requiring NO API KEY + direct navigation)
  const mapSearchQuery = encodeURIComponent(`${c.name} ${c.address || c.area || "القاهرة"}`);
  const mapEmbedUrl = `https://maps.google.com/maps?q=${mapSearchQuery}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  const googleMapsNavUrl = c.maps_url || `https://www.google.com/maps/search/?api=1&query=${mapSearchQuery}`;

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
      const matchSearch = !menuSearch.trim() || item.name.toLowerCase().includes(menuSearch.toLowerCase()) || (item.categoryLabel && item.categoryLabel.toLowerCase().includes(menuSearch.toLowerCase()));
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
      setCompareSuccess(res.inList ? "تمت الإضافة للمقارنة بنجاح" : "تم الحذف من المقارنة");
      setTimeout(() => setCompareSuccess(null), 2500);
    }
  };

  const handleCopyAddress = () => {
    const textToCopy = c.address || `${c.name} - ${c.area}`;
    navigator.clipboard?.writeText(textToCopy);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2500);
  };

  const handleSaveOuting = () => {
    if (billItems.length === 0) return;
    saveOutingPlan({
      title: `خروجة في ${c.name}`,
      cafeId: c.id,
      cafeName: c.name,
      cafeArea: c.area || "",
      peopleCount,
      budgetTotal: billFees.grandTotal * peopleCount,
      transportationBudget: 0,
      items: billItems.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
      subtotal: billFees.subtotal,
      serviceAmount: billFees.serviceAmount,
      vatAmount: billFees.vatAmount,
      grandTotal: billFees.grandTotal * peopleCount,
      mapsUrl: googleMapsNavUrl,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const shareOutingOnWhatsApp = () => {
    const itemsText = billItems.length > 0
      ? billItems.map((i) => `• ${i.name} (${i.qty}×) = ${i.price * i.qty} ج.م`).join("\n")
      : "• لم يتم تحديد طلبات";

    const text = encodeURIComponent(
      `☕ *خطة خروجة في كافيه «${c.name}»*\n` +
      `📍 المنطقة: ${c.area}\n` +
      `⭐ التقييم المعتمد: ★${bayesian} (${reviewCount} تقييم)\n` +
      `👥 عدد الأفراد: ${peopleCount}\n\n` +
      `📋 *الأصناف المختارة:*\n${itemsText}\n\n` +
      `💳 *تفاصيل الحساب التقديري:*\n` +
      `• الحساب الأساسي: ${billFees.subtotal} ج.م\n` +
      (hasServiceCharge ? `• رسوم الخدمة (12%): ${billFees.serviceAmount} ج.م\n` : "") +
      (hasVat ? `• ضريبة القيمة المضافة (14%): ${billFees.vatAmount} ج.م\n` : "") +
      `• *الإجمالي الكلي:* ${billFees.grandTotal * peopleCount} ج.م ` +
      (peopleCount > 1 ? `(${billFees.grandTotal} ج.م للفرد)\n` : "\n") +
      `\n🗺️ *موقع الكافيه على خرائط جوجل:*\n${googleMapsNavUrl}\n\n` +
      `✨ تم التخطيط عبر منصة CaféLens`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  // Smart alternatives in same area
  const alternatives = useMemo(() => {
    if (!allCafes.length) return [];
    return findSmartAlternatives(c.id, allCafes, 250, "combo", ["wifi", "outdoor"], 3);
  }, [allCafes, c.id]);

  const activePhoto = photos[activePhotoIdx]?.url || photos[0]?.url;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary relative" dir="rtl">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[600px] h-[400px] bg-primary/8 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-amber-600/5 rounded-full blur-[160px]" />
      </div>

      {/* LUXURY TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border/40 transition-all">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3.5">
          <Link
            to="/cafes"
            className="group flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-secondary/60 border border-border/40 group-hover:border-primary/50 group-hover:bg-primary/10 transition">
              <ArrowRight className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            </div>
            <span>كل الكافيهات</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsFavoritesOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-secondary/40 hover:bg-secondary/80 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition shadow-sm"
            >
              <Bookmark className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline">المفضلة والخطط</span>
            </button>

            <button
              onClick={() => setIsCompareModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-secondary/40 hover:bg-secondary/80 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition shadow-sm"
            >
              <GitCompareArrows className="h-3.5 w-3.5 text-primary" />
              <span>المقارنة</span>
              {getCompareList().length > 0 && (
                <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {getCompareList().length}
                </span>
              )}
            </button>

            <Link to="/" className="flex items-center gap-2 pr-2" dir="ltr">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/15 border border-primary/30">
                <Aperture className="h-5 w-5 text-primary" strokeWidth={2} />
              </div>
              <span className="font-latin text-xl font-bold tracking-tight text-foreground hidden sm:inline">CaféLens</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 pb-32 pt-6">

        {/* HERO SECTION */}
        <section className="relative rounded-3xl overflow-hidden border border-border/50 bg-card/60 shadow-2xl backdrop-blur-md">
          {activePhoto ? (
            <div className="relative h-72 sm:h-96 md:h-[28rem] lg:h-[32rem] w-full overflow-hidden group">
              <img
                src={activePhoto}
                alt={c.name}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-transparent" />

              {/* Photo Attribution badge */}
              {photos[activePhotoIdx]?.by?.length ? (
                <div className="absolute top-4 left-4 text-[11px] font-medium text-white/80 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10" dir="ltr">
                  © {photos[activePhotoIdx].by.join(", ")} · Google Maps
                </div>
              ) : null}

              {/* Multiple photos thumbnails strip */}
              {photos.length > 1 && (
                <div className="absolute top-4 right-4 flex items-center gap-2 p-1.5 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 max-w-[200px] overflow-x-auto">
                  {photos.slice(0, 4).map((p, idx) => (
                    <button
                      key={p.url}
                      onClick={() => setActivePhotoIdx(idx)}
                      className={`relative h-10 w-12 rounded-lg overflow-hidden border-2 transition shrink-0 ${
                        activePhotoIdx === idx ? "border-primary scale-105 shadow-md" : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={p.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Hero bottom overlay with café details */}
              <div className="absolute bottom-0 inset-x-0 p-6 sm:p-8 space-y-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border shadow-sm backdrop-blur-md ${verification.badgeClass}`}>
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {verification.statusLabel}
                  </span>
                  {c.price_level ? (
                    <span className="text-xs font-medium text-foreground/90 bg-background/80 backdrop-blur-md px-3 py-1 rounded-full border border-border/50 shadow-sm">
                      {PRICE_LABELS[c.price_level]}
                    </span>
                  ) : null}
                  {c.category ? (
                    <span className="text-xs font-medium text-primary bg-primary/10 border border-primary/20 backdrop-blur-md px-3 py-1 rounded-full">
                      {c.category}
                    </span>
                  ) : null}
                </div>

                <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-black text-foreground drop-shadow-sm tracking-tight leading-tight">
                  {c.name}
                </h1>

                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pt-1">
                  <div className="flex items-center gap-1.5 text-foreground/90 font-medium">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <span>{c.area}</span>
                  </div>

                  {c.rating != null && (
                    <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full text-foreground">
                      <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                      <span className="font-bold text-amber-400">{bayesian}</span>
                      <span className="text-xs text-muted-foreground font-normal">({reviewCount} تقييم موثق)</span>
                    </div>
                  )}

                  {c.address && (
                    <span className="text-xs text-muted-foreground/90 max-w-md truncate hidden md:inline">
                      {c.address}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 sm:p-12 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${verification.badgeClass}`}>
                  {verification.statusLabel}
                </span>
                {c.price_level ? <span>{PRICE_LABELS[c.price_level]}</span> : null}
              </div>
              <h1 className="font-display text-4xl sm:text-5xl font-black">{c.name}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary" /> {c.area}
                <Star className="h-4 w-4 text-amber-400 fill-amber-400" /> {bayesian} ({reviewCount} تقييم)
              </div>
            </div>
          )}

          {/* QUICK ACTION BAR */}
          <div className="border-t border-border/40 bg-card/80 backdrop-blur-xl px-6 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleToggleFav}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold border transition shadow-sm ${
                  isFav
                    ? "bg-rose-500/15 border-rose-500/40 text-rose-400 hover:bg-rose-500/25"
                    : "border-border/60 bg-secondary/50 text-muted-foreground hover:text-rose-400 hover:border-rose-500/30"
                }`}
              >
                <Heart className={`h-4 w-4 ${isFav ? "fill-rose-500 text-rose-500" : ""}`} />
                <span>{isFav ? "في المفضلة" : "أضف للمفضلة"}</span>
              </button>

              <button
                onClick={handleToggleCompare}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold border transition shadow-sm ${
                  inCompare
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "border-border/60 bg-secondary/50 text-muted-foreground hover:text-primary hover:border-primary/40"
                }`}
              >
                <GitCompareArrows className="h-4 w-4" />
                <span>{inCompare ? "في المقارنة" : "قارن مع كافيهات أخرى"}</span>
              </button>

              <a
                href={googleMapsNavUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition shadow-sm"
              >
                <Navigation className="h-4 w-4" />
                <span>الموقع في Google Maps</span>
              </a>

              {c.phone && (
                <a
                  href={`tel:${c.phone}`}
                  className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold border border-border/60 bg-secondary/50 text-muted-foreground hover:text-foreground hover:border-border transition shadow-sm"
                  dir="ltr"
                >
                  <Phone className="h-4 w-4 text-primary" />
                  <span>{c.phone}</span>
                </a>
              )}
            </div>

            {/* Quick Share */}
            <button
              onClick={shareOutingOnWhatsApp}
              className="flex items-center gap-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition px-3 py-1.5 rounded-lg hover:bg-emerald-500/10"
            >
              <Share2 className="h-4 w-4" />
              <span>مشاركة الكافيه</span>
            </button>
          </div>
        </section>

        {compareSuccess && (
          <div className="mt-4 rounded-2xl bg-primary/15 border border-primary/30 px-4 py-3 text-xs font-semibold text-primary flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{compareSuccess}</span>
          </div>
        )}

        {/* SERVICES / FACILITIES HIGHLIGHTS */}
        {c.services.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> المرافق والخدمات المتوفرة
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {c.services.map((s) => {
                const IconComponent = SERVICE_ICONS[s.toLowerCase()] || Check;
                return (
                  <div
                    key={s}
                    className="flex items-center gap-2 rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md px-3.5 py-2 text-xs font-medium text-foreground/90 shadow-sm hover:border-primary/40 hover:bg-card transition"
                  >
                    <IconComponent className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>{s}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* MENU & INTERACTIVE OUTING BILL SECTION */}
        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6 pb-4 border-b border-border/40">
            <div>
              <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider mb-1">
                <Coffee className="h-4 w-4" /> قائمة الأسعار وخطة الخروجة
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-black text-foreground">
                المنيو وحاسبة التكلفة الذكية
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                اختر الأصناف التي ترغب بطلبها لمعرفة الحساب الدقيق شامل الضريبة والخدمة ومشاركته مع أصدقائك.
              </p>
            </div>

            <div className="flex items-center gap-3 bg-card/70 border border-border/50 rounded-2xl px-4 py-2 backdrop-blur-md">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" /> عدد الأفراد:
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPeopleCount((p) => Math.max(1, p - 1))}
                  className="grid h-7 w-7 place-items-center rounded-xl bg-secondary/60 hover:bg-primary/20 text-foreground hover:text-primary transition disabled:opacity-40"
                  disabled={peopleCount <= 1}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-8 text-center text-sm font-bold text-primary">{peopleCount}</span>
                <button
                  onClick={() => setPeopleCount((p) => p + 1)}
                  className="grid h-7 w-7 place-items-center rounded-xl bg-secondary/60 hover:bg-primary/20 text-foreground hover:text-primary transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-12 items-start">
            {/* MENU ITEMS (Right side in RTL) */}
            <div className="space-y-5 lg:col-span-7">
              {/* Category Pills & Search */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`rounded-2xl px-4 py-2 text-xs font-bold transition-all shadow-sm ${
                        selectedCategory === cat
                          ? "bg-primary text-primary-foreground shadow-glow"
                          : "border border-border/50 bg-secondary/50 text-muted-foreground hover:text-foreground hover:border-primary/40"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="ابحث في المنيو..."
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    className="w-44 sm:w-56 rounded-2xl border border-border/50 bg-card/60 px-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/70 transition backdrop-blur-md shadow-sm"
                  />
                  {menuSearch && (
                    <button
                      onClick={() => setMenuSearch("")}
                      className="absolute left-3 top-2.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Menu Cards */}
              <div className="space-y-3">
                {filteredMenuItems.length === 0 ? (
                  <div className="py-16 text-center rounded-3xl border border-border/40 bg-card/30 p-8 space-y-3">
                    <Coffee className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                    <p className="text-sm font-semibold text-muted-foreground">لا توجد أصناف مطابقة للبحث في هذا القسم</p>
                  </div>
                ) : (
                  filteredMenuItems.map((item) => {
                    const qty = pickedItems[item.id] ?? 0;
                    return (
                      <div
                        key={item.id}
                        className={`group rounded-2xl border p-4 transition-all flex items-center justify-between gap-4 backdrop-blur-md ${
                          qty > 0
                            ? "border-primary/50 bg-primary/8 shadow-md"
                            : "border-border/40 bg-card/50 hover:bg-card/80 hover:border-border"
                        }`}
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors">
                              {item.name}
                            </h4>
                            {item.categoryLabel && (
                              <span className="text-[10px] text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full border border-border/30">
                                {item.categoryLabel}
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <span className="font-display font-bold text-base sm:text-lg text-foreground">
                            {item.price} <span className="text-xs font-normal text-muted-foreground">ج.م</span>
                          </span>

                          <div className="flex items-center gap-1.5">
                            {qty > 0 && (
                              <>
                                <button
                                  onClick={() => updateQty(item.id, -1)}
                                  className="grid h-8 w-8 place-items-center rounded-xl bg-secondary/60 hover:bg-rose-500/20 hover:text-rose-400 text-foreground transition"
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="w-6 text-center text-xs font-bold text-primary">{qty}</span>
                              </>
                            )}
                            <button
                              onClick={() => updateQty(item.id, 1)}
                              className={`grid h-8 w-8 place-items-center rounded-xl transition ${
                                qty > 0
                                  ? "bg-primary text-primary-foreground shadow-sm"
                                  : "border border-primary/40 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                              }`}
                              title="إضافة"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* BILL RECEIPT PANEL (Left side in RTL) */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-xl p-6 space-y-5 lg:sticky lg:top-24 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-border/40">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/15 border border-primary/30">
                      <Calculator className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-base text-foreground">فاتورة الخروجة المقدرة</h3>
                      <p className="text-[11px] text-muted-foreground">{peopleCount} {peopleCount === 1 ? "فرد" : "أفراد"}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
                    {billItems.length} {billItems.length === 1 ? "صنف" : "أصناف"}
                  </span>
                </div>

                {/* Items in receipt */}
                {billItems.length === 0 ? (
                  <div className="py-10 text-center space-y-3 rounded-2xl border border-dashed border-border/60 bg-secondary/20">
                    <Coffee className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                    <p className="text-xs font-medium text-muted-foreground">اضغط (+) بجانب أي صنف في القائمة لإضافته للفاتورة</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {billItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 text-xs p-2.5 rounded-xl bg-secondary/30 border border-border/30">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground truncate">{item.name}</p>
                          <p className="text-[11px] text-muted-foreground">{item.price} ج.م × {item.qty}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground text-sm">{item.price * item.qty} ج.م</span>
                          <button
                            onClick={() => updateQty(item.id, -item.qty)}
                            className="text-muted-foreground hover:text-rose-400 p-1 transition"
                            title="حذف"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Service and VAT Toggles */}
                <div className="rounded-2xl bg-secondary/30 border border-border/40 p-3.5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">رسوم الخدمة المقررة (12%)</span>
                    <button
                      onClick={() => setHasServiceCharge(!hasServiceCharge)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${hasServiceCharge ? "bg-primary" : "bg-muted"}`}
                    >
                      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all shadow-sm ${hasServiceCharge ? "right-1" : "left-1"}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">ضريبة القيمة المضافة (14%)</span>
                    <button
                      onClick={() => setHasVat(!hasVat)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${hasVat ? "bg-primary" : "bg-muted"}`}
                    >
                      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all shadow-sm ${hasVat ? "right-1" : "left-1"}`} />
                    </button>
                  </div>
                </div>

                {/* Financial Summary Breakdown */}
                <div className="border-t border-border/40 pt-4 space-y-2 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>الحساب الأساسي للطلبات</span>
                    <span className="font-medium text-foreground">{billFees.subtotal} ج.م</span>
                  </div>
                  {hasServiceCharge && billFees.serviceAmount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>رسوم الخدمة (12%)</span>
                      <span className="text-amber-400 font-medium">+{billFees.serviceAmount} ج.م</span>
                    </div>
                  )}
                  {hasVat && billFees.vatAmount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>ضريبة القيمة المضافة (14%)</span>
                      <span className="text-amber-400 font-medium">+{billFees.vatAmount} ج.م</span>
                    </div>
                  )}

                  <div className="flex justify-between items-baseline pt-3 border-t border-border/50">
                    <div>
                      <span className="text-sm font-bold text-foreground">الإجمالي النهائي</span>
                      {peopleCount > 1 && (
                        <p className="text-[11px] text-primary mt-0.5">({billFees.grandTotal} ج.م / للفرد)</p>
                      )}
                    </div>
                    <span className="text-2xl font-black text-primary font-display">
                      {billFees.grandTotal * peopleCount} ج.م
                    </span>
                  </div>
                </div>

                {/* Action CTA Buttons */}
                <div className="space-y-2.5 pt-2">
                  <button
                    onClick={shareOutingOnWhatsApp}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white py-3 text-xs font-bold transition shadow-md shadow-emerald-950/20"
                  >
                    <Share2 className="h-4 w-4" />
                    <span>مشاركة الفاتورة مع الأصدقاء (WhatsApp)</span>
                  </button>

                  <button
                    onClick={handleSaveOuting}
                    disabled={billItems.length === 0}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary py-3 text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {saveSuccess ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-400" />
                        <span className="text-emerald-400">تم حفظ الخطة بنجاح!</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="h-4 w-4" />
                        <span>حفظ هذه الخطة في المفضلة</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* WORKING HOURS & CONTACT INFO ROW */}
        <section className="mt-14 grid gap-6 md:grid-cols-2">
          {/* Working Hours */}
          <div className="rounded-3xl border border-border/50 bg-card/60 backdrop-blur-xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <h2 className="flex items-center gap-2.5 text-base font-bold text-foreground">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/15 border border-primary/30">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <span>مواعيد العمل الرسمية</span>
              </h2>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                مفتوح الآن
              </span>
            </div>

            {c.hours.length ? (
              <ul className="space-y-2 text-xs text-muted-foreground" dir="ltr">
                {c.hours.map((h) => (
                  <li key={h} className="flex justify-between py-1 border-b border-border/20 last:border-none">
                    <span className="font-medium text-foreground">{h.split(":")[0]}</span>
                    <span>{h.substring(h.indexOf(":") + 1)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">المواعيد الاعتيادية من 8:00 صباحاً حتى منتصف الليل طوال الأسبوع.</p>
            )}
          </div>

          {/* Contact & Location Details */}
          <div className="rounded-3xl border border-border/50 bg-card/60 backdrop-blur-xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <h2 className="flex items-center gap-2.5 text-base font-bold text-foreground">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/15 border border-primary/30">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <span>العنوان ومعلومات التواصل</span>
              </h2>
              <button
                onClick={handleCopyAddress}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                {copiedAddress ? <CheckCheck className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedAddress ? "تم النسخ!" : "نسخ العنوان"}</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {c.address && (
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-secondary/30 border border-border/30">
                  <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-foreground/90 font-medium leading-relaxed" dir="auto">{c.address}</p>
                </div>
              )}

              {c.phone && (
                <a
                  href={`tel:${c.phone}`}
                  className="flex items-center justify-between p-3 rounded-2xl bg-secondary/30 border border-border/30 hover:border-primary/40 hover:bg-secondary/50 transition group"
                  dir="ltr"
                >
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-semibold text-foreground">{c.phone}</span>
                  </div>
                  <span className="text-[11px] text-primary group-hover:underline">اتصال مباشر</span>
                </a>
              )}

              {c.website && (
                <a
                  href={c.website}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-3 rounded-2xl bg-secondary/30 border border-border/30 hover:border-primary/40 hover:bg-secondary/50 transition group"
                  dir="ltr"
                >
                  <div className="flex items-center gap-3 truncate">
                    <Globe className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium text-foreground truncate">{c.website.replace(/^https?:\/\//, "")}</span>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
                </a>
              )}
            </div>
          </div>
        </section>

        {/* SMART ALTERNATIVES SECTION */}
        {alternatives.length > 0 && (
          <section className="mt-14">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" /> كافيهات بديلة مقترحة في {c.area}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">تم اختيارها بخوارزمية التوافق البيزي ومستوى الأسعار المتقارب</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {alternatives.map(({ cafe: altCafe, score, rationale }) => (
                <div
                  key={altCafe.id}
                  className="rounded-3xl border border-border/50 bg-card/60 backdrop-blur-xl p-5 flex flex-col justify-between hover:border-primary/40 hover:bg-card/80 transition-all shadow-sm group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
                        {score.matchScore}% توافق
                      </span>
                      <span className="text-xs text-amber-400 font-bold flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-current" /> {score.bayesianRating.toFixed(1)}
                      </span>
                    </div>

                    <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors">
                      {altCafe.name}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {rationale}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">~{score.expectedCost} ج.م / فرد</span>
                    <Link
                      to="/cafes/$slug"
                      params={{ slug: altCafe.slug }}
                      className="rounded-xl bg-primary/15 hover:bg-primary text-primary hover:text-primary-foreground px-4 py-1.5 text-xs font-bold transition"
                    >
                      عرض الكافيه
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* MAP & NAVIGATION SECTION (RELIABLE NO-ERROR EMBED) */}
        <section className="mt-14 rounded-3xl border border-border/50 bg-card/60 backdrop-blur-xl overflow-hidden shadow-xl">
          <div className="p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 border-b border-border/40">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/15 border border-primary/30">
                <Navigation className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-foreground">الموقع على الخريطة والاتجاهات</h3>
                <p className="text-xs text-muted-foreground">{c.name} — {c.area}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyAddress}
                className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-secondary/50 px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
              >
                {copiedAddress ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedAddress ? "تم النسخ" : "نسخ العنوان"}</span>
              </button>

              <a
                href={googleMapsNavUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 text-xs font-bold transition shadow-sm"
              >
                <Navigation className="h-3.5 w-3.5" />
                <span>افتح الاتجاهات في Google Maps</span>
              </a>
            </div>
          </div>

          <div className="relative h-80 sm:h-96 w-full bg-secondary/30">
            <iframe
              title={`خريطة ${c.name}`}
              src={mapEmbedUrl}
              className="h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          <div className="p-4 bg-card/40 border-t border-border/30 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
              <span>الإحداثيات والموقع موثقين ومعتمدين وفقاً لقاعدة بيانات Google Maps.</span>
            </div>
            {c.address && <span className="font-medium text-foreground">{c.address}</span>}
          </div>
        </section>

        {/* VERIFICATION & DATA QUALITY GUARANTEE */}
        <div className="mt-8 flex items-center justify-between flex-wrap gap-3 rounded-2xl border border-border/40 bg-card/40 px-5 py-3.5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <BadgeCheck className="h-5 w-5 text-emerald-400 shrink-0" />
            <div className="text-xs text-muted-foreground">
              <span className="font-bold text-foreground">{verification.source}</span>
              {" · "}آخر تحديث للبيانات والأسعار: {verification.lastUpdated}
              {" — "}{verification.notes}
            </div>
          </div>
          <Link to="/data-quality" className="text-xs text-primary font-semibold hover:underline">
            تقرير جودة البيانات والمصداقية ←
          </Link>
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
