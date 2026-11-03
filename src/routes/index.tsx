import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Menu, MapPin, ChevronDown, Sparkles, Laptop, UsersRound, Heart, BriefcaseBusiness,
  Calculator, ChevronLeft, TreePine, Star, Aperture, Clock, ShieldCheck,
  Minus, Plus, Shuffle, X, BarChart3, GitCompareArrows, Map as MapIcon, Bookmark, User, Compass,
  Search, Phone, Globe, ExternalLink, Share2, Coffee, Utensils, Check, MessageCircle,
  Wifi, Zap, Car, Wind, VolumeX, BadgeCheck, CheckCircle2,
} from "lucide-react";
import { HeroVideoBackground } from "@/components/HeroVideoBackground";
import { Button } from "@/components/ui/button";
import { cafesQuery, moodQuery, menuQuery } from "@/lib/queries";
import { AREA_CLASS_LABELS, type CafeListItem, type CafePhoto, type MoodResult } from "@/lib/cafes.functions";
import { MOODS, type MoodKey } from "@/lib/mood";
import {
  getCafeMenuData, calculateCafeScoreWithFacilities, getCafeVerification,
  findSmartAlternatives, calculateBillWithFees, FACILITIES_LIST,
  type FacilityKey, type MenuItem, type CafeScoringResult
} from "@/lib/ranking-and-budget";
import {
  isFavorite, toggleFavorite, isInCompareList, toggleCompareCafe,
  saveOutingPlan, getCompareList
} from "@/lib/user-storage";
import { CafeComparisonModal } from "@/components/CafeComparisonModal";
import { FavoritesDrawer } from "@/components/FavoritesDrawer";
import { SmartImage, ThumbImage } from "@/components/SmartImage";
import heroImg from "@/assets/hero-cafe.webp";
import coffee from "@/assets/coffee.webp";
import outdoor from "@/assets/outdoor.webp";
import work from "@/assets/work.webp";

export const Route = createFileRoute("/")({
  head: () => ({
    links: [
      { rel: "preload", as: "image", href: "/hero-poster.webp", fetchPriority: "high" },
      { rel: "preload", as: "video", href: "/hero-video.mp4", type: "video/mp4" },
    ],
    meta: [
      { title: "CaféLens — اكتشف كافيهك المثالي في القاهرة" },
      { name: "description", content: "اكتشف مكانك المثالي، اعرف ميزانيتك، واستمتع بخروجة على مزاجك في القاهرة." },
      { property: "og:title", content: "CaféLens — اكتشف كافيهك المثالي" },
      { property: "og:description", content: "اختر مزاجك واحسب تكلفة خروجتك واكتشف أفضل الكافيهات." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://cafe-lens1.vercel.app/" },
      { property: "og:image", content: "https://cafe-lens1.vercel.app/og-image.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:site_name", content: "CaféLens" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://cafe-lens1.vercel.app/og-image.jpg" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(cafesQuery),
  component: Index,
});

function Lotus({ strokeWidth = 1.4 }: { strokeWidth?: number }) {
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 27C8 21 10 10 16 4c6 6 8 17 0 23Z" />
    <path d="M16 27C7 27 3 19 3 11c8 1 12 7 13 16Zm0 0c9 0 13-8 13-16-8 1-12 7-13 16Z" />
    <path d="M16 27C8 30 3 26 1 21c5-1 10 1 15 6Zm0 0c8 3 13-1 15-6-5-1-10 1-15 6Z" />
  </svg>;
}

const moodIcons = [Laptop, UsersRound, Heart, Lotus, BriefcaseBusiness];

type AreaFilter = "الكل" | "fifth_settlement" | "new_cairo" | "sheikh_zayed";
const AREA_OPTIONS: { value: AreaFilter; label: string }[] = [
  { value: "الكل", label: "كل المناطق" },
  { value: "fifth_settlement", label: "التجمع الخامس" },
  { value: "new_cairo", label: "القاهرة الجديدة" },
  { value: "sheikh_zayed", label: "الشيخ زايد" },
];
const matchesArea = (c: CafeListItem, a: AreaFilter) =>
  a === "الكل" || (a === "new_cairo" ? c.area_class.startsWith("new_cairo") : c.area_class === a);

const cats = [
  { img: coffee, icon: Star, label: "قهوة مختصة", key: "specialty", note: "محامص ومشروبات مقطّرة" },
  { img: work, icon: Laptop, label: "مناسب للعمل", key: "work", note: "واي فاي ومقابس وهدوء" },
  { img: outdoor, icon: TreePine, label: "جلسات خارجية", key: "outdoor", note: "تراسات وإطلالات غروب" },
] as const;
type CatKey = (typeof cats)[number]["key"];

function NavMenu({
  onOpenCompare,
  onOpenFavorites,
}: {
  onOpenCompare?: () => void;
  onOpenFavorites?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const scroll = (id: string) => {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const items: { icon: typeof Compass; label: string; action?: (() => void) | undefined; soon?: boolean }[] = [
    { icon: Compass, label: "الرئيسية", action: () => { setOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); } },
    { icon: Menu, label: "كل الكافيهات", action: undefined },
    { icon: MapPin, label: "المناطق", action: () => scroll("areas") },
    { icon: Calculator, label: "حاسبة الميزانية", action: () => scroll("calculator") },
    { icon: Shuffle, label: "اختر لي خروجة", action: () => scroll("tonight") },
    { icon: BarChart3, label: "تقرير جودة البيانات", action: undefined },
    { icon: GitCompareArrows, label: "المقارنة", action: () => { setOpen(false); onOpenCompare?.(); } },
    { icon: Bookmark, label: "المفضلة والخطط", action: () => { setOpen(false); onOpenFavorites?.(); } },
    { icon: MapIcon, label: "الخريطة", soon: true },
    { icon: User, label: "حسابي", soon: true },
  ];
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="nav-item glass grid h-12 w-12 place-items-center rounded-full transition hover:shadow-glow" aria-label="القائمة" aria-expanded={open}>
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open && (
        <>
          <button aria-hidden className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <nav className="glass absolute left-0 top-14 z-50 w-64 rounded-2xl p-2 shadow-glow" aria-label="التنقل الرئيسي">
            {items.map((it) =>
              it.soon ? (
                <span key={it.label} className="flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm text-muted-foreground/60">
                  <span className="flex items-center gap-3"><it.icon className="h-4 w-4" />{it.label}</span>
                  <span className="text-[10px]">قريبًا</span>
                </span>
              ) : it.label === "كل الكافيهات" ? (
                <Link key={it.label} to="/cafes" onClick={() => setOpen(false)} className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition hover:bg-primary/10">
                  <it.icon className="h-4 w-4 text-primary" />{it.label}
                </Link>
              ) : it.label === "تقرير جودة البيانات" ? (
                <Link key={it.label} to="/data-quality" onClick={() => setOpen(false)} className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition hover:bg-primary/10">
                  <it.icon className="h-4 w-4 text-primary" />{it.label}
                </Link>
              ) : (
                <button key={it.label} onClick={it.action} className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition hover:bg-primary/10">
                  <it.icon className="h-4 w-4 text-primary" />{it.label}
                </button>
              ),
            )}
          </nav>
        </>
      )}
    </div>
  );
}

function Index() {
  const root = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLSpanElement>(null);
  const [area, setArea] = useState<AreaFilter>("الكل");
  const [mood, setMood] = useState<number | null>(null);
  const moodRef = useRef(mood);
  moodRef.current = mood;
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const { data: allCafes = [] } = useSuspenseQuery(cafesQuery);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".hero-canvas", { opacity: 0, duration: 0.6 })
        .from(".nav-item", { y: -20, opacity: 0, stagger: 0.08, duration: 0.5, clearProps: "all" }, "-=0.4")
        .from(".hero-line", { y: 40, opacity: 0, stagger: 0.1, duration: 0.7, clearProps: "all" }, "-=0.4")
        .from(".hero-sub", { y: 20, opacity: 0, duration: 0.6, clearProps: "all" }, "-=0.3")
        .from(".hero-rule", { scaleX: 0, transformOrigin: "right", duration: 0.6, clearProps: "all" }, "-=0.3")
        .from(".hero-loc", { y: 20, opacity: 0, duration: 0.5, clearProps: "all" }, "-=0.2");
      gsap.to(".hero-text", {
        yPercent: -30, opacity: 0.2, ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
      });
      gsap.utils.toArray<HTMLElement>(".reveal").forEach((el) =>
        gsap.from(el, { y: 60, opacity: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top bottom-=40", once: true } }),
      );
      gsap.from(".mood", { y: 18, opacity: 0, stagger: 0.07, duration: 0.75, ease: "power3.out", clearProps: "transform", scrollTrigger: { trigger: ".moods", start: "top bottom", once: true } });
      gsap.from(".cat", { y: 50, opacity: 0, stagger: 0.1, duration: 0.9, ease: "power3.out", clearProps: "transform,opacity", scrollTrigger: { trigger: ".cats", start: "top bottom-=40", once: true } });
      addEventListener("load", () => ScrollTrigger.refresh());
    }, root);
    return () => ctx.revert();
  }, []);

  const pick = (i: number, el: HTMLElement) => {
    setMood((m) => (m === i ? null : i));
    gsap.fromTo(el, { scale: 0.94 }, { scale: 1, duration: 0.5, ease: "power3.out", clearProps: "transform" });
  };

  const place = (animate = true) => {
    const g = glow.current, s = strip.current;
    if (!g || !s) return;
    if (moodRef.current == null) {
      gsap.to(g, { opacity: 0, duration: animate ? 0.4 : 0, overwrite: true });
      return;
    }
    const btn = s.querySelectorAll<HTMLElement>(".mood-option")[moodRef.current];
    const ico = btn?.querySelector<HTMLElement>(".mood-ico");
    if (!btn || !ico) return;
    const d = Math.max(ico.offsetWidth, ico.offsetHeight) + (innerWidth < 640 ? 22 : 28);
    const vars: gsap.TweenVars = {
      x: btn.offsetLeft + ico.offsetLeft + ico.offsetWidth / 2,
      y: btn.offsetTop + ico.offsetTop + ico.offsetHeight / 2,
      width: d, height: d, opacity: 1,
      duration: animate ? 0.65 : 0, ease: "power3.out", overwrite: true,
    };
    if (animate) gsap.to(g, vars);
    else gsap.set(g, vars);
  };

  useEffect(() => {
    const g = glow.current;
    if (!g) return;
    gsap.set(g, { xPercent: -50, yPercent: -50, opacity: 0 });
    const onResize = () => place(false);
    addEventListener("resize", onResize);
    document.fonts.ready.then(() => place(false));
    return () => removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    place(true);
  }, [mood]);

  return (
    <div ref={root} className="min-h-screen overflow-hidden bg-background text-foreground">
      {/* HERO */}
      <section className="hero relative h-[100svh] min-h-[640px]">
        <div className="hero-canvas absolute inset-0">
          <HeroVideoBackground
            posterSrc="/hero-poster.webp"
            videoMp4Src="/hero-video.mp4"
            videoWebmSrc="/hero-video.webm"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-background/40 to-background/85" />
        <div className="bg-fade absolute inset-x-0 bottom-0 h-48" />

        <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 pt-6" dir="ltr">
          <div className="nav-item flex items-center gap-3">
            <Aperture className="h-11 w-11 text-primary" strokeWidth={1.5} />
            <div>
              <div className="font-latin text-3xl font-semibold leading-none">CaféLens</div>
              <div className="mt-1 text-[9px] tracking-[0.3em] text-muted-foreground">DISCOVER BEYOND THE ORDINARY.</div>
            </div>
          </div>
          <div className="flex gap-3">
            <Link to="/cafes" className="nav-item glass flex h-12 items-center gap-2 rounded-full px-5 transition hover:shadow-glow">
              <Compass className="h-5 w-5" /> <span>كل الكافيهات</span>
            </Link>
            <NavMenu
              onOpenCompare={() => setIsCompareOpen(true)}
              onOpenFavorites={() => setIsFavoritesOpen(true)}
            />
          </div>
        </header>

        <div className="hero-text relative z-10 mx-auto mt-16 max-w-6xl px-5 md:mt-24">
          <h1 className="font-display font-bold leading-tight">
            <span className="block overflow-hidden"><span className="hero-line block text-5xl md:text-7xl">اكتشف</span></span>
            <span className="block overflow-hidden pb-3"><span className="hero-line text-gold block text-6xl md:text-8xl">مكانك المثالي</span></span>
          </h1>
          <p className="hero-sub mt-4 max-w-sm text-lg text-muted-foreground md:text-xl">واعرف ميزانيتك، واستمتع بخروجة على مزاجك.</p>
          <div className="hero-rule bg-gold mt-6 h-px w-40" />
          <label id="areas" className="hero-loc glass relative mt-6 inline-flex items-center gap-3 rounded-full px-5 py-3 transition hover:shadow-glow">
            <MapPin className="h-5 w-5 text-primary" />
            <select aria-label="المنطقة" value={area} onChange={(e) => setArea(e.target.value as AreaFilter)} className="appearance-none bg-transparent pl-6 text-foreground outline-none">
              {AREA_OPTIONS.map((a) => <option key={a.value} value={a.value} className="bg-background">{a.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute left-5 h-4 w-4" />
          </label>
        </div>
      </section>

      <main className="relative z-10 mx-auto -mt-40 w-full max-w-6xl space-y-12 sm:space-y-14 px-3 sm:px-5 pb-10">
        {/* MOODS */}
        <section className="reveal mood-picker relative overflow-hidden" aria-label="اختر مزاجك">
          <div className="mood-content relative">
            <div className="flex items-center justify-between">
              <h2 className="mood-heading flex items-center gap-2 font-display">اختر مزاجك:</h2>
              {mood != null && (
                <button onClick={() => setMood(null)} className="flex items-center gap-1 text-sm text-primary">
                  <X className="h-3.5 w-3.5" /> كل الأجواء
                </button>
              )}
            </div>
            <div ref={strip} className="moods mood-strip grid grid-cols-5" role="group" aria-label="المزاج">
              <span ref={glow} className="mood-glow" aria-hidden="true" />
              {MOODS.map((m, i) => {
                const Icon = moodIcons[i]!;
                return (
                  <Button
                    key={m.key}
                    variant="ghost"
                    aria-pressed={mood === i}
                    onClick={(e) => pick(i, e.currentTarget)}
                    className="mood mood-option"
                  >
                    <span className="mood-ico"><Icon strokeWidth={1.4} /></span>
                    <span>{m.label}</span>
                  </Button>
                );
              })}
            </div>
            {mood != null && <p className="mt-3 text-sm text-muted-foreground">{MOODS[mood]!.desc}</p>}
          </div>
        </section>

        {/* CALCULATOR */}
        <CalculatorSection
          onOpenCompare={() => setIsCompareOpen(true)}
          onOpenFavorites={() => setIsFavoritesOpen(true)}
        />

        <Explore mood={mood} area={area} />
      </main>

      {/* Comparison Modal */}
      <CafeComparisonModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        allCafes={allCafes}
      />

      {/* Favorites Drawer */}
      <FavoritesDrawer
        isOpen={isFavoritesOpen}
        onClose={() => setIsFavoritesOpen(false)}
        allCafes={allCafes}
      />
    </div>
  );
}

function CafeCard({ c, reason, priority = false }: { c: CafeListItem; reason?: string | undefined; priority?: boolean }) {
  const photo = (c.photos as CafePhoto[])[0];
  return (
    <Link to="/cafes/$slug" params={{ slug: c.slug }} className="cafe-card group block">
      <div className="cafe-media">
        <SmartImage
          src={photo?.url}
          alt={c.name}
          priority={priority}
          className="h-full w-full object-cover"
        />
        <span className="cafe-media-shade" />
        {c.rating != null && (
          <span className="cafe-chip right-3"><Star className="h-3 w-3 fill-primary text-primary" />{Number(c.rating).toFixed(1)}</span>
        )}
        {c.price_level != null && <span className="cafe-chip left-3 font-latin text-primary">{"$".repeat(c.price_level)}</span>}
        <div className="absolute inset-x-4 bottom-3">
          <h3 className="font-latin text-2xl font-semibold leading-tight" dir="auto">{c.name}</h3>
          <p className="mt-0.5 text-xs text-foreground/75">
            <MapPin className="ml-1 inline h-3 w-3" />{AREA_CLASS_LABELS[c.area_class] ?? c.area}
          </p>
        </div>
      </div>
      <div className="space-y-3 px-4 pb-4 pt-4">
        <div className="flex flex-wrap gap-1.5">
          {c.services.slice(0, 3).map((t) => <span key={t} className="cafe-tag">{t}</span>)}
        </div>
        {reason && <p className="text-xs text-primary">مناسب لطلبك لأنه {reason}.</p>}
        <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> بيانات Google Maps
          </span>
          <span className="cafe-cta">التفاصيل <ChevronLeft className="h-3.5 w-3.5" /></span>
        </div>
      </div>
    </Link>
  );
}

function CalculatorSection({
  onOpenCompare,
  onOpenFavorites,
}: {
  onOpenCompare?: () => void;
  onOpenFavorites?: () => void;
}) {
  const { data: all } = useSuspenseQuery(cafesQuery);
  const [selectedArea, setSelectedArea] = useState<"all" | "sheikh_zayed" | "tagamoa">("all");
  const [itemType, setItemType] = useState<"combo" | "drink" | "food">("combo");
  const [selectedFacilities, setSelectedFacilities] = useState<FacilityKey[]>([]);
  const [rankingStrategy, setRankingStrategy] = useState<"smart" | "rating" | "budget">("smart");
  const [budget, setBudget] = useState(250);
  const [transportationBudget, setTransportationBudget] = useState(0);
  const [hasServiceCharge, setHasServiceCharge] = useState(true);
  const [hasVat, setHasVat] = useState(true);
  const [people, setPeople] = useState(1);
  const [cafeId, setCafeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showFullMenu, setShowFullMenu] = useState(false);
  const [visibleMoreCount, setVisibleMoreCount] = useState(6);
  const [pickedItems, setPickedItems] = useState<Record<string, number>>({});
  const [planSavedNotice, setPlanSavedNotice] = useState(false);
  const [storageUpdateCounter, setStorageUpdateCounter] = useState(0);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const calcRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    const onStorage = () => setStorageUpdateCounter((c) => c + 1);
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("cafelens_storage_update", onStorage);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("cafelens_storage_update", onStorage);
    };
  }, []);

  // Filter cafes by selected area
  const areaCafes = useMemo(() => {
    if (selectedArea === "sheikh_zayed") {
      return all.filter((c) => c.area_class === "sheikh_zayed" || (c.area && c.area.includes("زايد")));
    }
    if (selectedArea === "tagamoa") {
      return all.filter(
        (c) =>
          c.area_class.startsWith("new_cairo") ||
          c.area_class === "fifth_settlement" ||
          (c.area && (c.area.includes("التجمع") || c.area.includes("القاهرة الجديدة")))
      );
    }
    return all;
  }, [all, selectedArea]);

  // Budget calculations
  const effectiveCafeBudget = Math.max(30, budget - transportationBudget);
  const budgetPerPerson = Math.max(30, Math.floor(effectiveCafeBudget / Math.max(1, people)));

  // Advanced Multi-Factor Algorithmic Ranking with Facilities
  const scoredCafes = useMemo(() => {
    const scored = areaCafes.map((c) =>
      calculateCafeScoreWithFacilities(c, budgetPerPerson, itemType, selectedFacilities)
    );

    if (rankingStrategy === "rating") {
      return scored.sort((a, b) => {
        if (b.qualityScore !== a.qualityScore) return b.qualityScore - a.qualityScore;
        return Number(b.cafe.rating ?? 0) - Number(a.cafe.rating ?? 0);
      });
    }

    if (rankingStrategy === "budget") {
      return scored.sort((a, b) => {
        if (b.budgetFitScore !== a.budgetFitScore) return b.budgetFitScore - a.budgetFitScore;
        return a.expectedCost - b.expectedCost;
      });
    }

    // Default "smart" strategy: Composite Match Score + Bayesian
    return scored.sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      if (b.qualityScore !== a.qualityScore) return b.qualityScore - a.qualityScore;
      return Number(b.cafe.rating_count ?? 0) - Number(a.cafe.rating_count ?? 0);
    });
  }, [areaCafes, budgetPerPerson, itemType, selectedFacilities, rankingStrategy]);

  const bestMatchedCafes = useMemo(() => scoredCafes.slice(0, 15), [scoredCafes]);

  // Active cafe selection
  const activeScoredCafe = useMemo(() => {
    if (cafeId) {
      const found = scoredCafes.find((sc) => sc.cafe.id === cafeId);
      if (found) return found;
    }
    return scoredCafes[0] ?? calculateCafeScoreWithFacilities(all[0]!, budgetPerPerson, itemType, selectedFacilities);
  }, [scoredCafes, cafeId, all, budgetPerPerson, itemType, selectedFacilities]);

  const activeCafe = activeScoredCafe.cafe;
  const activeVerification = getCafeVerification(activeCafe);
  const isCurrentFav = isFavorite(activeCafe.id);
  const isCurrentInCompare = isInCompareList(activeCafe.id);

  const menuQ = useQuery({ ...menuQuery(activeCafe.id), enabled: !!activeCafe.id });
  const cafeMenuData = useMemo(() => getCafeMenuData(activeCafe, menuQ.data?.items), [activeCafe, menuQ.data]);

  // Autocomplete search
  const filteredCafes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return areaCafes.slice(0, 15);
    return areaCafes
      .filter((c) => {
        const nameMatches = c.name.toLowerCase().includes(term);
        const areaMatches = (AREA_CLASS_LABELS[c.area_class] ?? c.area).toLowerCase().includes(term);
        return nameMatches || areaMatches;
      })
      .slice(0, 20);
  }, [areaCafes, searchTerm]);

  // Smart suggestion: What can you get with this money?
  const smartRecommendation = useMemo(() => {
    const drinks = cafeMenuData.filter((i) => i.category === "hot" || i.category === "cold" || i.category === "specialty");
    const foods = cafeMenuData.filter((i) => i.category === "food" || i.category === "dessert");

    let chosen: MenuItem[] = [];

    if (itemType === "drink") {
      const affordable = drinks.filter((d) => d.price <= budgetPerPerson);
      if (affordable.length > 0) {
        const bestDrink = affordable.reduce((prev, curr) => (curr.price > prev.price ? curr : prev), affordable[0]!);
        chosen.push(bestDrink);
        const remaining = budgetPerPerson - bestDrink.price;
        const second = drinks.filter((d) => d.id !== bestDrink.id && d.price <= remaining);
        if (second.length > 0) chosen.push(second[second.length - 1]!);
      } else {
        chosen.push(drinks[0]!);
      }
    } else if (itemType === "food") {
      const affordable = foods.filter((f) => f.price <= budgetPerPerson);
      if (affordable.length > 0) {
        const bestFood = affordable.reduce((prev, curr) => (curr.price > prev.price ? curr : prev), affordable[0]!);
        chosen.push(bestFood);
      } else {
        chosen.push(foods[0]!);
      }
    } else {
      const halfBudget = Math.floor(budgetPerPerson / 2);
      const affordableDrink = drinks.filter((d) => d.price <= halfBudget + 30);
      const pickDrink = affordableDrink.length > 0
        ? affordableDrink[Math.min(affordableDrink.length - 1, 1)]!
        : drinks[0]!;

      const remForFood = budgetPerPerson - pickDrink.price;
      const affordableFood = foods.filter((f) => f.price <= remForFood);
      const pickFood = affordableFood.length > 0
        ? affordableFood.reduce((prev, curr) => (curr.price > prev.price ? curr : prev), affordableFood[0]!)
        : foods.filter((f) => f.price <= budgetPerPerson)[0] ?? foods[0]!;

      chosen = [pickDrink, pickFood];
    }

    const singlePersonSubtotal = chosen.reduce((acc, it) => acc + it.price, 0);
    const billFees = calculateBillWithFees(singlePersonSubtotal, { hasServiceCharge, hasVat });
    const cafeGrandTotal = billFees.grandTotal * people;
    const outingTotalWithTransport = cafeGrandTotal + transportationBudget;
    const remainingBudget = budget - outingTotalWithTransport;

    return {
      items: chosen,
      singlePersonSubtotal,
      billFees,
      cafeGrandTotal,
      outingTotalWithTransport,
      remainingBudget,
      isWithinBudget: outingTotalWithTransport <= budget,
    };
  }, [cafeMenuData, budget, transportationBudget, people, itemType, hasServiceCharge, hasVat, budgetPerPerson]);

  const activePhoto = (activeCafe.photos as CafePhoto[] | undefined)?.[0]?.url;

  // Custom menu total in full menu modal
  const customSubtotal = useMemo(() => {
    return Object.entries(pickedItems).reduce((sum, [itemId, qty]) => {
      const it = cafeMenuData.find((m) => m.id === itemId);
      return sum + (it ? it.price * qty : 0);
    }, 0);
  }, [pickedItems, cafeMenuData]);

  const customBillFees = useMemo(() => {
    return calculateBillWithFees(customSubtotal, { hasServiceCharge, hasVat });
  }, [customSubtotal, hasServiceCharge, hasVat]);

  const customGrandOuting = customBillFees.grandTotal + transportationBudget;

  // Smart alternatives in case user wants other options
  const smartAlternatives = useMemo(() => {
    return findSmartAlternatives(activeCafe.id, areaCafes, budgetPerPerson, itemType, selectedFacilities, 3);
  }, [activeCafe.id, areaCafes, budgetPerPerson, itemType, selectedFacilities]);

  const toggleFacility = (fac: FacilityKey) => {
    setSelectedFacilities((prev) =>
      prev.includes(fac) ? prev.filter((k) => k !== fac) : [...prev, fac]
    );
  };

  const handleSaveOutingFromModal = () => {
    const items = Object.entries(pickedItems)
      .map(([id, qty]) => {
        const it = cafeMenuData.find((m) => m.id === id);
        return it ? { id: it.id, name: it.name, price: it.price, qty } : null;
      })
      .filter((i): i is { id: string; name: string; price: number; qty: number } => Boolean(i));

    if (items.length === 0) return;

    saveOutingPlan({
      title: `خطة خروجة في ${activeCafe.name}`,
      cafeId: activeCafe.id,
      cafeName: activeCafe.name,
      cafeArea: AREA_CLASS_LABELS[activeCafe.area_class] ?? activeCafe.area,
      peopleCount: people,
      budgetTotal: budget,
      transportationBudget,
      items,
      subtotal: customBillFees.subtotal,
      serviceAmount: customBillFees.serviceAmount,
      vatAmount: customBillFees.vatAmount,
      grandTotal: customGrandOuting,
      mapsUrl: activeCafe.maps_url || undefined,
    });

    setPlanSavedNotice(true);
    setTimeout(() => setPlanSavedNotice(false), 3000);
  };

  const whatsappMessage = encodeURIComponent(
    `خروجة مقترحة على كافيه «${activeCafe.name}» في ${AREA_CLASS_LABELS[activeCafe.area_class] ?? activeCafe.area}\n` +
    `التقييم البيزي: ★${activeScoredCafe.bayesianRating.toFixed(2)} (${activeCafe.rating_count} تقييم حقيقي)\n` +
    `الميزانية المحددة: ${budget} ج.م لـ ${people} أشخاص\n` +
    (transportationBudget > 0 ? `ميزانية المواصلات: ${transportationBudget} ج.م\n` : "") +
    `الطلبات المقترحة:\n` +
    smartRecommendation.items.map((i) => `• ${i.name} (${i.price} ج.م)`).join("\n") +
    `\nالإجمالي التقريبي: ${smartRecommendation.outingTotalWithTransport} ج.م (شامل الخدمة والضريبة)\n` +
    (activeCafe.maps_url ? `الموقع على خرائط جوجل: ${activeCafe.maps_url}\n` : "") +
    `ملاحظة: البيانات معتمدة من منصة CaféLens.`
  );

  return (
    <section id="calculator" ref={calcRef} className="reveal calc-card scroll-mt-6 w-full max-w-full overflow-hidden" aria-label="حاسبة الميزانية ومخطط الخروجة">
      {/* Header */}
      <div className="mb-4 sm:mb-6 flex items-center justify-between gap-3 border-b border-border/60 pb-3 sm:pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 sm:h-12 sm:w-12 shrink-0 place-items-center rounded-xl sm:rounded-2xl bg-primary/10 text-primary shadow-glow">
            <Calculator className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-lg sm:text-2xl md:text-3xl font-bold">احسب تكلفة خروجتك الذكية</h2>
            <p className="text-[11px] sm:text-xs text-muted-foreground md:text-sm">اختر المنطقة وميزانيتك، وسنرشح لك أفضل كافيه بالمنيو الكامل وحساب الخدمة والضريبة</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenFavorites}
            className="hidden sm:flex items-center gap-1.5 rounded-xl border border-border/80 glass px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <Bookmark className="h-3.5 w-3.5 text-primary" /> المفضلة والخطط
          </button>
          <button
            type="button"
            onClick={onOpenCompare}
            className="hidden sm:flex items-center gap-1.5 rounded-xl border border-border/80 glass px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <GitCompareArrows className="h-3.5 w-3.5 text-primary" /> المقارنة ({getCompareList().length})
          </button>
        </div>
      </div>

      <div className="grid min-w-0 max-w-full gap-5 sm:gap-6 lg:grid-cols-12 lg:gap-8">
        {/* LEFT COLUMN: FILTERS & INPUTS — UNIFIED LUXURY CONTROL PANEL */}
        <div className="min-w-0 max-w-full space-y-4 sm:space-y-4.5 lg:col-span-5 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 bg-card/35 border border-border/40 backdrop-blur-md">
          {/* 1. AREA SELECTION */}
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-muted-foreground">1. اختر المنطقة</span>
            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-secondary/40 p-1 border border-border/40">
              <button
                type="button"
                onClick={() => { setSelectedArea("all"); setCafeId(null); }}
                className={`rounded-xl px-2 py-2 text-center text-xs font-semibold transition ${
                  selectedArea === "all" ? "bg-primary text-primary-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                كل المناطق
              </button>
              <button
                type="button"
                onClick={() => { setSelectedArea("sheikh_zayed"); setCafeId(null); }}
                className={`flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-center text-xs font-semibold transition ${
                  selectedArea === "sheikh_zayed" ? "bg-primary text-primary-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">الشيخ زايد</span>
              </button>
              <button
                type="button"
                onClick={() => { setSelectedArea("tagamoa"); setCafeId(null); }}
                className={`flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-center text-xs font-semibold transition ${
                  selectedArea === "tagamoa" ? "bg-primary text-primary-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">التجمع الخامس</span>
              </button>
            </div>
          </div>

          {/* 2. PREFERENCE: DRINK OR FOOD */}
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-muted-foreground">2. طبيعة الخروجة</span>
            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-secondary/40 p-1 border border-border/40">
              <button
                type="button"
                onClick={() => setItemType("drink")}
                className={`flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-center text-xs font-semibold transition ${
                  itemType === "drink" ? "bg-primary text-primary-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <Coffee className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">مشروبات وقهوة</span>
              </button>
              <button
                type="button"
                onClick={() => setItemType("food")}
                className={`flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-center text-xs font-semibold transition ${
                  itemType === "food" ? "bg-primary text-primary-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <Utensils className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">أكل وحلويات</span>
              </button>
              <button
                type="button"
                onClick={() => setItemType("combo")}
                className={`flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-center text-xs font-semibold transition ${
                  itemType === "combo" ? "bg-primary text-primary-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">ميكس خروجة</span>
              </button>
            </div>
          </div>

          {/* 3. FACILITIES & MOOD MULTI-SELECT */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="block text-xs font-semibold text-muted-foreground">3. خدمات ومرافق تهمك:</span>
              {selectedFacilities.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedFacilities([])}
                  className="text-[11px] text-primary hover:underline"
                >
                  إلغاء التحديد ({selectedFacilities.length})
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FACILITIES_LIST.map((fac) => {
                const isSelected = selectedFacilities.includes(fac.key);
                return (
                  <button
                    key={fac.key}
                    type="button"
                    onClick={() => toggleFacility(fac.key)}
                    className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs transition border ${
                      isSelected
                        ? "bg-primary/20 text-primary border-primary/50 font-bold"
                        : "bg-secondary/20 text-muted-foreground border-border/40 hover:bg-secondary/50 hover:text-foreground"
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 text-primary" />}
                    {fac.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. BUDGET INPUT & PRESETS */}
          <div className="space-y-2 rounded-2xl bg-secondary/20 p-3 sm:p-3.5 border border-border/40">
            <div className="flex items-center justify-between">
              <label htmlFor="budget-input" className="text-xs font-semibold text-muted-foreground">
                4. ميزانيتك الإجمالية للخروجة
              </label>
              <span className="font-display text-base font-bold text-primary">{budget} ج.م</span>
            </div>
            <div className="relative flex items-center">
              <input
                id="budget-input"
                type="number"
                min={30}
                step={25}
                value={budget || ""}
                onChange={(e) => setBudget(Math.max(0, Number(e.target.value)))}
                placeholder="اكتب المبلغ هنا..."
                className="w-full rounded-xl border border-border/60 bg-background/60 py-2 pr-3.5 pl-12 font-display text-base text-foreground outline-none transition focus:border-primary"
              />
              <span className="pointer-events-none absolute left-3.5 text-xs font-bold text-primary">
                ج.م
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {[150, 250, 400, 600, 1000, 1500].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setBudget(preset)}
                  className={`rounded-lg px-2.5 py-1 text-xs transition border ${
                    budget === preset
                      ? "bg-primary text-primary-foreground font-bold border-primary shadow-sm"
                      : "bg-background/40 text-muted-foreground border-border/40 hover:text-foreground hover:bg-secondary/40"
                  }`}
                >
                  {preset} ج.م
                </button>
              ))}
            </div>

            {/* 5. TRANSPORTATION BUDGET (SEAMLESSLY INTEGRATED) */}
            <div className="pt-2 border-t border-border/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Car className="h-3.5 w-3.5 text-primary" /> ميزانية مواصلات (أوبر / بنزين اختياري):
                </label>
                <span className="text-xs font-bold text-primary">{transportationBudget} ج.م</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[0, 50, 100, 150].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTransportationBudget(t)}
                    className={`rounded-xl py-1 text-xs transition border ${
                      transportationBudget === t
                        ? "bg-primary text-primary-foreground font-bold border-primary"
                        : "bg-background/40 text-muted-foreground border-border/40 hover:bg-secondary/40 hover:text-foreground"
                    }`}
                  >
                    {t === 0 ? "بدون" : `${t} ج.م`}
                  </button>
                ))}
              </div>
              {transportationBudget > 0 && (
                <p className="text-[11px] text-muted-foreground pt-0.5">
                  المتبقي لطلبات الكافيه: <strong className="text-foreground">{effectiveCafeBudget} ج.م</strong> (~{budgetPerPerson} ج.م/فرد)
                </p>
              )}
            </div>
          </div>

          {/* 6. PEOPLE COUNT & TAX TOGGLES */}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-2xl bg-secondary/20 border border-border/40 p-2.5 sm:p-3">
              <span className="text-xs font-medium text-muted-foreground">عدد الأفراد:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="أقل"
                  onClick={() => setPeople(Math.max(1, people - 1))}
                  className="grid h-7 w-7 place-items-center rounded-full border border-border/60 hover:bg-primary/10 transition"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-5 text-center font-display text-base font-bold">{people}</span>
                <button
                  type="button"
                  aria-label="أكثر"
                  onClick={() => setPeople(Math.min(10, people + 1))}
                  className="grid h-7 w-7 place-items-center rounded-full border border-border/60 hover:bg-primary/10 transition"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>

            <div className="flex flex-col justify-center rounded-2xl bg-secondary/20 border border-border/40 p-2.5 text-xs space-y-1.5">
              <label className="flex items-center justify-between cursor-pointer select-none">
                <span className="text-muted-foreground">رسوم الخدمة (12%):</span>
                <input
                  type="checkbox"
                  checked={hasServiceCharge}
                  onChange={(e) => setHasServiceCharge(e.target.checked)}
                  className="accent-primary h-4 w-4 rounded cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer select-none">
                <span className="text-muted-foreground">الضريبة (14% VAT):</span>
                <input
                  type="checkbox"
                  checked={hasVat}
                  onChange={(e) => setHasVat(e.target.checked)}
                  className="accent-primary h-4 w-4 rounded cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* 7. SEARCH SPECIFIC CAFE BY NAME */}
          <div ref={searchBoxRef} className="relative space-y-1.5 text-sm">
            <label htmlFor="cafe-search-input" className="flex items-center justify-between text-xs text-muted-foreground">
              <span>أو ابحث عن كافيه معين بالاسم:</span>
              {cafeId && (
                <button
                  type="button"
                  onClick={() => { setCafeId(null); setSearchTerm(""); }}
                  className="text-[11px] text-primary hover:underline"
                >
                  العودة للترشيح التلقائي
                </button>
              )}
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="cafe-search-input"
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setIsSearchOpen(true); }}
                onFocus={() => setIsSearchOpen(true)}
                placeholder={activeCafe ? `${activeCafe.name} (${AREA_CLASS_LABELS[activeCafe.area_class] ?? activeCafe.area})` : "اكتب اسم كافيه..."}
                className="w-full rounded-xl border border-border/60 bg-background/60 py-2.5 pr-10 pl-9 text-xs text-foreground outline-none transition focus:border-primary"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute left-2.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {isSearchOpen && (
              <div className="glass absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-2xl border border-border/80 p-1.5 shadow-2xl backdrop-blur-xl">
                {filteredCafes.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">لا توجد نتائج مطابقة لـ "{searchTerm}"</div>
                ) : (
                  filteredCafes.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCafeId(c.id);
                        setSearchTerm(c.name);
                        setIsSearchOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-right text-xs transition hover:bg-primary/10 ${
                        c.id === activeCafe.id ? "bg-primary/15 font-medium text-primary" : "text-foreground"
                      }`}
                    >
                      <div className="flex flex-col text-right min-w-0 pr-1">
                        <span className="font-medium truncate" dir="auto">{c.name}</span>
                        <span className="text-[10px] text-muted-foreground truncate">{AREA_CLASS_LABELS[c.area_class] ?? c.area}</span>
                      </div>
                      {c.rating != null && (
                        <span className="flex items-center gap-1 rounded bg-background/50 px-1.5 py-0.5 text-[10px] text-primary shrink-0">
                          <Star className="h-2.5 w-2.5 fill-primary" />{Number(c.rating).toFixed(1)}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: RECOMMENDED BEST CAFE SPOTLIGHT + WHAT YOU CAN GET + SOCIALS */}
        <div className="min-w-0 max-w-full space-y-4 sm:space-y-5 lg:col-span-7">
          {/* STRATEGY SWITCHER */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/40 bg-card/35 p-2 sm:p-2.5">
            <div className="flex items-center gap-1.5 px-1">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-xs font-semibold text-foreground">معيار الاختيار:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setRankingStrategy("smart")}
                className={`rounded-xl px-2.5 py-1 text-xs font-medium transition ${
                  rankingStrategy === "smart"
                    ? "bg-primary text-primary-foreground font-bold shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                🎯 الأنسب لميزانيتك
              </button>
              <button
                type="button"
                onClick={() => setRankingStrategy("rating")}
                className={`rounded-xl px-2.5 py-1 text-xs font-medium transition ${
                  rankingStrategy === "rating"
                    ? "bg-primary text-primary-foreground font-bold shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                ⭐ الأعلى تقييماً
              </button>
              <button
                type="button"
                onClick={() => setRankingStrategy("budget")}
                className={`rounded-xl px-2.5 py-1 text-xs font-medium transition ${
                  rankingStrategy === "budget"
                    ? "bg-primary text-primary-foreground font-bold shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                💰 الأكثر توفيراً
              </button>
            </div>
          </div>

          {/* TOP MATCHED SUGGESTIONS TABS */}
          <div className="space-y-1.5 min-w-0 max-w-full">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" />
                أفضل الكافيهات المقترحة لميزانيتك ({budget} ج.م):
              </span>
              <span className="text-[11px] text-muted-foreground">
                {selectedArea === "sheikh_zayed" ? "الشيخ زايد" : selectedArea === "tagamoa" ? "التجمع الخامس" : "كل المناطق"}
              </span>
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] touch-pan-x min-w-0 max-w-full">
              {bestMatchedCafes.map((sc, idx) => {
                const isSelected = sc.cafe.id === activeCafe.id;
                return (
                  <button
                    key={sc.cafe.id}
                    type="button"
                    onClick={() => setCafeId(sc.cafe.id)}
                    className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-1.5 text-right text-xs transition border ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary font-bold shadow-sm"
                        : "border-border/40 bg-card/40 text-muted-foreground hover:text-foreground hover:bg-card/80"
                    }`}
                  >
                    <span className="text-[10px] opacity-70">#{idx + 1}</span>
                    <span className="font-semibold truncate max-w-[120px] sm:max-w-[150px]" dir="auto">{sc.cafe.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-black/20 text-white" : "bg-primary/15 text-primary font-bold"}`}>
                      {sc.matchScore}%
                    </span>
                    {sc.cafe.rating != null && (
                      <span className="text-[10px] flex items-center gap-0.5 opacity-90">
                        ★{Number(sc.cafe.rating).toFixed(1)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ACTIVE CAFE SPOTLIGHT CARD — CLEAN, AIRY, LUXURIOUS */}
          <div className="min-w-0 max-w-full rounded-3xl border border-border/50 bg-card/40 backdrop-blur-xl overflow-hidden shadow-2xl transition-all">
            {/* HERO COVER PHOTO */}
            <div className="relative h-48 sm:h-60 w-full overflow-hidden bg-muted group">
              <SmartImage
                src={activePhoto}
                alt={activeCafe.name}
                priority={true}
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent pointer-events-none" />

              {/* Floating Top Badges */}
              <div className="absolute top-3 inset-x-3 sm:inset-x-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-md px-3 py-1 text-xs font-bold text-amber-400 border border-white/10 shadow-sm">
                    <Sparkles className="h-3.5 w-3.5" />
                    {activeScoredCafe.matchScore}% توافق ميزانية
                  </span>
                  <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border backdrop-blur-md ${activeVerification.badgeClass}`}>
                    {activeVerification.statusLabel}
                  </span>
                </div>

                {/* Favorite & Compare Quick Icons */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleFavorite(activeCafe.id)}
                    className={`grid h-8 w-8 place-items-center rounded-full bg-black/45 backdrop-blur-md border border-white/10 transition ${
                      isCurrentFav ? "text-rose-400" : "text-white/80 hover:text-rose-400"
                    }`}
                    title={isCurrentFav ? "في المفضلة" : "أضف للمفضلة"}
                    aria-label={isCurrentFav ? "إزالة من المفضلة" : "إضافة للمفضلة"}
                  >
                    <Heart className={`h-4 w-4 ${isCurrentFav ? "fill-rose-500 text-rose-500" : ""}`} />
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleCompareCafe(activeCafe.id)}
                    className={`grid h-8 w-8 place-items-center rounded-full bg-black/45 backdrop-blur-md border border-white/10 transition ${
                      isCurrentInCompare ? "text-primary" : "text-white/80 hover:text-primary"
                    }`}
                    title={isCurrentInCompare ? "في المقارنة" : "مقارنة"}
                    aria-label={isCurrentInCompare ? "إزالة من المقارنة" : "إضافة للمقارنة"}
                  >
                    <GitCompareArrows className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Cafe Name & Basic Info at Bottom of Photo */}
              <div className="absolute bottom-3 inset-x-3 sm:inset-x-4">
                <Link
                  to="/cafes/$slug"
                  params={{ slug: activeCafe.slug }}
                  className="font-display text-2xl sm:text-3xl font-black text-foreground drop-shadow-md hover:text-primary transition-colors block leading-snug"
                  dir="auto"
                >
                  {activeCafe.name}
                </Link>

                <div className="mt-1 flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 text-foreground/90">
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>{AREA_CLASS_LABELS[activeCafe.area_class] ?? activeCafe.area}</span>
                  </span>

                  {activeCafe.rating != null && (
                    <span className="flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full text-amber-400 font-bold border border-white/10">
                      <Star className="h-3 w-3 fill-current" /> {Number(activeCafe.rating).toFixed(1)}
                      {activeCafe.rating_count != null && (
                        <span className="text-[10px] text-muted-foreground font-normal">({activeCafe.rating_count})</span>
                      )}
                    </span>
                  )}

                  <span className="text-muted-foreground/80">
                    {activeCafe.price_level === 1 ? "اقتصادي ($)" : activeCafe.price_level === 3 ? "مرتفع ($$$)" : activeCafe.price_level === 4 ? "فاخر ($$$$)" : "متوسط ($$)"}
                  </span>
                </div>
              </div>
            </div>

            {/* CARD BODY CONTENT */}
            <div className="p-4 sm:p-5 space-y-4">
              {/* CLEAN FINANCIAL SUMMARY ROW */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5">
                <div className="rounded-2xl bg-secondary/30 border border-border/40 p-2.5 sm:p-3 text-center sm:text-right">
                  <span className="text-[11px] text-muted-foreground block">المتوقع للفرد</span>
                  <span className="font-display text-base sm:text-lg font-bold text-foreground">
                    ~{activeScoredCafe.expectedCost} <span className="text-xs font-normal text-muted-foreground">ج.م</span>
                  </span>
                </div>

                <div className="rounded-2xl bg-secondary/30 border border-border/40 p-2.5 sm:p-3 text-center sm:text-right">
                  <span className="text-[11px] text-muted-foreground block">الإجمالي بالخدمة والضريبة</span>
                  <span className="font-display text-base sm:text-lg font-bold text-primary">
                    {smartRecommendation.outingTotalWithTransport} <span className="text-xs font-normal text-muted-foreground">ج.م</span>
                  </span>
                </div>

                <div className="col-span-2 sm:col-span-1 rounded-2xl bg-secondary/30 border border-border/40 p-2.5 sm:p-3 flex flex-col justify-center text-center sm:text-right">
                  <span className="text-[11px] text-muted-foreground block">حالة الميزانية</span>
                  <span className={`text-xs font-bold ${smartRecommendation.isWithinBudget ? "text-emerald-400" : "text-amber-400"}`}>
                    {smartRecommendation.isWithinBudget
                      ? `✓ وفرت ${smartRecommendation.remainingBudget} ج.م`
                      : `أعلى بـ ${Math.abs(smartRecommendation.remainingBudget)} ج.م`}
                  </span>
                </div>
              </div>

              {/* PROPOSED ORDER (WHAT TO GET) */}
              <div className="rounded-2xl border border-border/40 bg-card/50 p-3 sm:p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Coffee className="h-4 w-4 text-primary" />
                    تقدر تطلب إيه بميزانيتك ({people > 1 ? `${people} أفراد` : "فرد واحد"}):
                  </span>
                  <span className="text-[11px] text-muted-foreground">شامل الضريبة والخدمة</span>
                </div>

                <div className="space-y-1.5">
                  {smartRecommendation.items.slice(0, 2).map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-background/50 border border-border/30">
                      <div className="flex items-center gap-2 truncate">
                        <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="font-medium text-foreground truncate" dir="auto">{item.name}</span>
                      </div>
                      <span className="font-bold text-foreground shrink-0">{item.price} ج.م</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* PRIMARY ACTION BUTTONS */}
              <div className="space-y-2 pt-1">
                <Link
                  to="/cafes/$slug"
                  params={{ slug: activeCafe.slug }}
                  className="bg-gold flex items-center justify-center gap-2 rounded-2xl py-3 px-4 font-display text-sm font-bold text-primary-foreground shadow-glow transition hover:opacity-95"
                >
                  <span>استكشف الكافيه والمنيو الكامل</span>
                  <ChevronLeft className="h-4 w-4 shrink-0" />
                </Link>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowFullMenu(true)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-border/50 bg-secondary/30 hover:bg-secondary/60 py-2.5 px-3 text-xs font-semibold text-foreground transition"
                  >
                    <span>تخصيص الفاتورة</span>
                  </button>

                  <a
                    href={activeCafe.maps_url || `https://maps.google.com/?q=${encodeURIComponent(activeCafe.name + " " + activeCafe.area)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-border/50 bg-secondary/30 hover:bg-secondary/60 py-2.5 px-3 text-xs font-semibold text-foreground hover:text-primary transition"
                  >
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    <span>خرائط جوجل</span>
                  </a>

                  {activeCafe.phone ? (
                    <a
                      href={`tel:${activeCafe.phone}`}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-border/50 bg-secondary/30 hover:bg-secondary/60 py-2.5 px-3 text-xs font-semibold text-foreground transition"
                      dir="ltr"
                    >
                      <Phone className="h-3.5 w-3.5 text-primary" />
                      <span>{activeCafe.phone}</span>
                    </a>
                  ) : (
                    <Link
                      to="/cafes/$slug"
                      params={{ slug: activeCafe.slug }}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-border/50 bg-secondary/30 hover:bg-secondary/60 py-2.5 px-3 text-xs font-semibold text-foreground transition"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-primary" />
                      <span>صفحة الكافيه</span>
                    </Link>
                  )}

                  <a
                    href={`https://wa.me/?text=${whatsappMessage}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-900/50 py-2.5 px-3 text-xs font-semibold text-emerald-300 transition"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>مشاركة الخطة</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* SMART ALTERNATIVES (CLEAN & OUTSIDE THE MAIN CARD) */}
          {smartAlternatives.length > 0 && (
            <div className="space-y-2.5 pt-2">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 px-1">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> بدائل مقترحة أخرى في نفس المنطقة:
              </span>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {smartAlternatives.map(({ cafe: altCafe, score, rationale }) => (
                  <button
                    key={altCafe.id}
                    type="button"
                    onClick={() => {
                      setCafeId(altCafe.id);
                      calcRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="rounded-2xl border border-border/40 bg-card/40 hover:bg-card/80 hover:border-primary/40 p-3 text-right transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex justify-between items-center text-[10px] mb-1">
                        <span className="text-primary font-bold">{score.matchScore}% توافق</span>
                        <span className="text-amber-400 flex items-center gap-0.5">
                          <Star className="h-2.5 w-2.5 fill-current" />★{score.bayesianRating.toFixed(1)}
                        </span>
                      </div>
                      <h5 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors truncate" dir="auto">
                        {altCafe.name}
                      </h5>
                      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{rationale}</p>
                    </div>
                    <span className="mt-2 text-center text-[11px] font-bold text-primary group-hover:underline">
                      اختر هذا البديل ←
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* MORE MATCHING CAFES GRID */}
          {scoredCafes.length > 1 && (
            <div className="min-w-0 max-w-full space-y-3 rounded-2xl sm:rounded-3xl border border-border/40 bg-card/35 p-3.5 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-display text-sm font-bold text-foreground">
                    كافيهات أخرى تناسب ميزانيتك ({scoredCafes.length} كافيه متاح)
                  </h4>
                  <p className="text-[10px] sm:text-[11px] text-muted-foreground">مرتبة خوارزمياً حسب معيارك المفضل — اضغط لاختيار كافيه</p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {scoredCafes.slice(0, visibleMoreCount).map((sc) => {
                  const isCurrent = sc.cafe.id === activeCafe.id;
                  const photo = (sc.cafe.photos as CafePhoto[] | undefined)?.[0]?.url;
                  const isFavItem = isFavorite(sc.cafe.id);
                  const isCompareItem = isInCompareList(sc.cafe.id);

                  return (
                    <div
                      key={sc.cafe.id}
                      className={`relative flex items-center gap-2.5 rounded-xl border p-2 text-right transition ${
                        isCurrent
                          ? "border-primary bg-primary/15 shadow-sm font-bold"
                          : "border-border/40 bg-card/40 hover:border-primary/40 hover:bg-card/70"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setCafeId(sc.cafe.id);
                          calcRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                        className="flex flex-1 items-center gap-2.5 text-right min-w-0"
                      >
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                          <ThumbImage src={photo} alt={sc.cafe.name} />
                          <span className="absolute bottom-0 right-0 rounded bg-background/90 px-1 text-[8px] font-bold text-primary">
                            {sc.matchScore}%
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-xs text-foreground truncate" dir="auto">{sc.cafe.name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{AREA_CLASS_LABELS[sc.cafe.area_class] ?? sc.cafe.area}</div>
                          <div className="mt-0.5 flex items-center justify-between text-[10px]">
                            <span className="text-primary font-medium">{sc.cafe.price_level === 1 ? "اقتصادي $" : sc.cafe.price_level === 3 ? "مرتفع $$$" : sc.cafe.price_level === 4 ? "فاخر $$$$" : "متوسط $$"}</span>
                            {sc.cafe.rating != null && (
                              <span className="flex items-center gap-0.5 text-primary"><Star className="h-2.5 w-2.5 fill-primary" />{Number(sc.cafe.rating).toFixed(1)}</span>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Small Quick Actions */}
                      <div className="flex flex-col gap-1 shrink-0 border-r border-border/40 pr-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(sc.cafe.id);
                          }}
                          className={`p-1 rounded-md transition ${isFavItem ? "text-rose-400" : "text-muted-foreground hover:text-rose-400"}`}
                          title="المفضلة"
                        >
                          <Heart className={`h-3.5 w-3.5 ${isFavItem ? "fill-rose-500" : ""}`} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCompareCafe(sc.cafe.id);
                          }}
                          className={`p-1 rounded-md transition ${isCompareItem ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"}`}
                          title="المقارنة"
                        >
                          <GitCompareArrows className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {scoredCafes.length > visibleMoreCount && (
                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleMoreCount((prev) => prev + 9)}
                    className="rounded-xl border border-border bg-background/60 px-4 py-2 text-xs font-medium text-primary hover:bg-primary/10 transition shadow-sm"
                  >
                    عرض المزيد من الكافيهات ({scoredCafes.length - visibleMoreCount} إضافي)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* FULL MENU MODAL DIALOG */}
      {showFullMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="fixed inset-0 bg-background/85 backdrop-blur-md" onClick={() => setShowFullMenu(false)} />
          <div className="glass relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-border/80 bg-background/95 p-4 sm:p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3 sm:pb-4">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-xl sm:text-2xl font-bold truncate" dir="auto">{activeCafe.name} — المنيو</h3>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${activeVerification.badgeClass}`}>
                    {activeVerification.statusLabel}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                  اختر الأصناف لتخصيص فاتورة الخروجة مع الخدمة والضريبة وحفظها
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFullMenu(false)}
                className="grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>

            {/* Menu Items List */}
            <div className="flex-1 overflow-y-auto py-3 pl-1 [scrollbar-width:thin]">
              <div className="space-y-5">
                {(["hot", "cold", "specialty", "food", "dessert"] as const).map((catKey) => {
                  const catItems = cafeMenuData.filter((i) => i.category === catKey);
                  if (catItems.length === 0) return null;
                  const catTitle =
                    catKey === "hot"
                      ? "مشروبات ساخنة ☕"
                      : catKey === "cold"
                      ? "مشروبات مثلجة وباردة 🧋"
                      : catKey === "specialty"
                      ? "قهوة مقطرة مختصة ⚗️"
                      : catKey === "food"
                      ? "سندوتشات ومخبوزات 🥪"
                      : "حلويات وكيك 🍰";

                  return (
                    <div key={catKey} className="space-y-2.5">
                      <h4 className="border-r-2 border-primary pr-2 text-xs sm:text-sm font-bold text-primary">{catTitle}</h4>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {catItems.map((item) => {
                          const qty = pickedItems[item.id] ?? 0;
                          return (
                            <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-card/60 p-2.5 transition hover:border-border">
                              <div className="min-w-0 flex-1 pr-1">
                                <div className="font-medium text-xs text-foreground truncate">{item.name}</div>
                                {item.desc && <div className="text-[10px] text-muted-foreground line-clamp-1">{item.desc}</div>}
                                <div className="font-display font-bold text-xs text-primary mt-0.5">{item.price} ج.م</div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setPickedItems((p) => ({ ...p, [item.id]: Math.max(0, (p[item.id] ?? 0) - 1) }))}
                                  className="grid h-6 w-6 sm:h-7 sm:w-7 place-items-center rounded-full border border-border hover:bg-primary/10"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-4 sm:w-5 text-center font-display text-xs sm:text-sm font-semibold">{qty}</span>
                                <button
                                  type="button"
                                  onClick={() => setPickedItems((p) => ({ ...p, [item.id]: (p[item.id] ?? 0) + 1 }))}
                                  className="grid h-6 w-6 sm:h-7 sm:w-7 place-items-center rounded-full border border-border bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer / Bill Summary */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
              <div>
                <span className="text-[11px] text-muted-foreground">الحساب الأساسي: {customBillFees.subtotal} ج.م</span>
                <div className="font-display text-xl sm:text-2xl font-bold text-primary">
                  {customGrandOuting} ج.م
                  <span className="text-xs font-normal text-muted-foreground mr-2">
                    (شامل {hasServiceCharge ? "الخدمة" : ""}{hasServiceCharge && hasVat ? " و" : ""}{hasVat ? "الضريبة" : ""}{transportationBudget > 0 ? ` + ${transportationBudget} مواصلات` : ""})
                  </span>
                </div>
                <span className="text-[10px] sm:text-[11px] text-muted-foreground">
                  الميزانية: {budget} ج.م {customGrandOuting > 0 && (customGrandOuting <= budget ? `(متبقي ${budget - customGrandOuting} ج.م)` : `(تجاوز بـ ${customGrandOuting - budget} ج.م)`)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {customSubtotal > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveOutingFromModal}
                      className="rounded-xl border border-primary/50 bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition"
                    >
                      {planSavedNotice ? "✓ تم الحفظ بالمفضلة!" : "💾 احفظ الخطة"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPickedItems({})}
                      className="rounded-xl border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                    >
                      تفريغ
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setShowFullMenu(false)}
                  className="bg-primary rounded-xl px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-glow"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Explore({ mood, area }: { mood: number | null; area: AreaFilter }) {
  const { data: all } = useSuspenseQuery(cafesQuery);
  const [cat, setCat] = useState<CatKey | null>(null);
  const moodKey = mood != null ? MOODS[mood]!.key : null;
  const areaClass = area === "الكل" ? null : area === "new_cairo" ? null : area;
  const moodQ = useQuery({ ...moodQuery(moodKey ?? "quiet", areaClass), enabled: moodKey != null });

  const list = useMemo(() => {
    let l: (CafeListItem | MoodResult)[] = moodKey && moodQ.data ? moodQ.data : all;
    if (cat === "specialty") l = l.filter((c) => c.category === "coffee_roastery");
    if (cat === "outdoor") l = l.filter((c) => c.services.includes("جلسات خارجية"));
    if (cat === "work") l = []; // لا توجد بيانات عمل موثقة بعد — لا نخترع نتائج
    if (area === "new_cairo") l = l.filter((c) => c.area_class.startsWith("new_cairo"));
    else if (area !== "الكل") l = l.filter((c) => c.area_class === area);
    return l;
  }, [all, moodKey, moodQ.data, cat, area]);

  const [tonight, setTonight] = useState<CafeListItem | null>(null);
  const catLabel = cat ? cats.find((x) => x.key === cat)!.label : null;

  return <>
    {/* CATEGORIES */}
    <section aria-label="اكتشف الكافيهات">
      <div className="reveal mb-5 flex items-end justify-between">
        <h2 className="font-display text-2xl md:text-3xl">اكتشف الكافيهات</h2>
        {cat && <button onClick={() => setCat(null)} className="text-sm text-primary">إلغاء التصنيف</button>}
      </div>
      <div className="cats -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:px-0">
        {cats.map((c) => {
          const on = cat === c.key;
          return (
            <button key={c.label} onClick={() => setCat(on ? null : c.key)} className={`cat-card cat group snap-center ${on ? "is-on" : ""}`}>
              <img src={c.img} alt={c.label} loading="lazy" decoding="async" width={816} height={816} />
              <span className="cat-shade" />
              <span className="cat-num font-latin">0{cats.indexOf(c) + 1}</span>
              <span className="cat-body">
                <span className="cat-ico"><c.icon className="h-4 w-4" strokeWidth={1.5} /></span>
                <span className="font-display text-xl">{c.label}</span>
                <span className="text-xs text-muted-foreground">{c.note}</span>
              </span>
              <ChevronLeft className="cat-arrow h-4 w-4" />
            </button>
          );
        })}
      </div>
    </section>

    {/* RESULTS */}
    <section aria-label="ترشيحات" className="space-y-5">
      <div className="reveal flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-primary">{moodKey ? "ترشيحات على مزاجك" : "الأكثر شهرة"}</p>
          <h2 className="font-display text-2xl md:text-3xl">{catLabel ?? (moodKey ? MOODS[mood!]!.label : "كل الأجواء")}</h2>
        </div>
        {moodKey && (
          <button onClick={() => setCat(null)} className="hidden" aria-hidden />
        )}
      </div>

      {moodKey && (
        <p className="text-sm text-muted-foreground">
          {moodQ.isLoading
            ? "بنحمّل النتائج…"
            : `وجدنا ${list.length} مكانًا ${area === "الكل" ? "" : `في ${AREA_OPTIONS.find((a) => a.value === area)?.label} `}يناسب مزاجك.`}
          {moodQ.data && !moodQ.data.some((c) => c.moodScore > 0) && (
            <span className="mt-1 block text-xs">بيانات المزاج التفصيلية (هدوء، واي فاي، أفياش) لسه قيد التوثيق — الترتيب الحالي بالأكثر شهرة.</span>
          )}
        </p>
      )}
      {!moodKey && <p className="text-sm text-muted-foreground">{list.length} كافيه حقيقي من قاعدة البيانات.</p>}

      {list.length === 0 && !moodQ.isLoading ? (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="font-display text-xl">ملقيناش أماكن مطابقة لاختياراتك.</p>
          {cat === "work" && <p className="mt-2 text-sm text-muted-foreground">لسه بنوثّق بيانات الواي فاي والأفياش والهدوء لكل فرع — مش هنعرض نتائج غير مؤكدة.</p>}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {cat && <button onClick={() => setCat(null)} className="glass rounded-full px-4 py-2 text-sm transition hover:shadow-glow">إلغاء التصنيف</button>}
            <Link to="/cafes" className="glass rounded-full px-4 py-2 text-sm text-primary transition hover:shadow-glow">عرض كل الأماكن</Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.slice(0, 12).map((c, idx) => (
            <CafeCard
              key={c.id}
              c={c}
              priority={idx < 4}
              reason={"reasons" in c && c.reasons.length > 0 ? c.reasons.join("، و") : undefined}
            />
          ))}
        </div>
      )}
      {list.length > 12 && (
        <div className="text-center">
          <Link to="/cafes" className="glass inline-block rounded-full px-6 py-3 transition hover:shadow-glow">عرض كل النتائج ({list.length})</Link>
        </div>
      )}
    </section>

    {/* TONIGHT */}
    <section id="tonight" className="reveal tonight-card scroll-mt-6" aria-label="اختر لي خروجة الليلة">
      <div className="space-y-2">
        <p className="text-sm text-primary">محتار؟</p>
        <h2 className="font-display text-2xl md:text-3xl">اختار لي خروجة الليلة</h2>
        <p className="text-sm text-muted-foreground">
          بنرشحلك مكان حقيقي {moodKey ? `على مزاجك «${MOODS[mood!]!.label}»` : "من قاعدة البيانات"} {area !== "الكل" ? `في ${AREA_OPTIONS.find((a) => a.value === area)?.label}` : ""}.
        </p>
      </div>
      {tonight && (
        <div key={tonight.id} className="tonight-pick flex items-center gap-4 rounded-2xl bg-background/50 p-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
            <ThumbImage
              src={(tonight.photos as CafePhoto[])[0]?.url}
              alt={tonight.name}
              className="h-16 w-16 rounded-xl object-cover"
            />
          </div>
          <div className="flex-1">
            <div className="font-latin text-lg font-semibold" dir="auto">{tonight.name}</div>
            <div className="text-xs text-muted-foreground">
              {AREA_CLASS_LABELS[tonight.area_class] ?? tonight.area}
              {tonight.rating != null && ` · ★ ${Number(tonight.rating).toFixed(1)}`}
            </div>
          </div>
          <Link to="/cafes/$slug" params={{ slug: tonight.slug }} className="text-sm text-primary">التفاصيل</Link>
        </div>
      )}
      <button
        onClick={() => {
          const pool = list.filter((c) => c.id !== tonight?.id);
          const src = pool.length ? pool : all;
          setTonight(src[Math.floor(Math.random() * src.length)] ?? all[0]!);
        }}
        className="bg-gold relative flex w-full items-center justify-center gap-4 overflow-hidden rounded-full px-8 py-4 font-display text-xl text-primary-foreground shadow-glow transition hover:scale-[1.02] md:w-auto"
      >
        <Shuffle className="h-5 w-5" /> {tonight ? "رشّح مكان تاني" : "رشّحلي دلوقتي"}
      </button>
    </section>



    {/* TRUST */}
    <section className="reveal grid gap-3 md:grid-cols-3">
      {[
        { i: ShieldCheck, t: "أسعار موثّقة", d: "كل سعر عليه مصدره وتاريخ آخر تحقق — ولا سعر بدون مصدر." },
        { i: Laptop, t: "تقييم العمل والمذاكرة", d: "واي فاي، مقابس، وهدوء — كل خاصية لوحدها وبحالة توثيقها." },
        { i: UsersRound, t: "قرار جماعي", d: "شارك الخروجة مع أصحابك واختاروا سوا — قريبًا." },
      ].map((x) => (
        <div key={x.t} className="rounded-[1.5rem] border border-border bg-card p-5">
          <x.i className="h-6 w-6 text-primary" strokeWidth={1.4} />
          <h3 className="mt-3 font-display text-lg">{x.t}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{x.d}</p>
        </div>
      ))}
    </section>

    <footer className="reveal border-t border-border pt-6 text-center text-sm text-muted-foreground">
      <div className="mb-2 flex items-center justify-center gap-2"><MapPin className="h-4 w-4" /> أحياءنا المتاحة حالياً:</div>
      التجمع الخامس • القاهرة الجديدة • الشيخ زايد
      <div className="mt-4 font-latin text-xs tracking-[0.3em]">CaféLens © 2026</div>
    </footer>
  </>;
}

function MenuBill({ people, budget, items, fees }: { cafeId: string; people: number; budget: number; items: { name: string; price: number; category: string | null }[]; fees: { service_charge_pct: number | null; vat_pct: number | null } | null }) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const subtotal = items.reduce((s, it, i) => s + (picked[i] ?? 0) * Number(it.price), 0);
  const service = fees?.service_charge_pct != null ? Math.round((subtotal * Number(fees.service_charge_pct)) / 100) : null;
  const vat = fees?.vat_pct != null ? Math.round((subtotal * Number(fees.vat_pct)) / 100) : null;
  const total = subtotal + (service ?? 0) + (vat ?? 0);
  return (
    <div>
      <p className="text-sm text-muted-foreground">اختار أصنافك من المنيو الموثّق</p>
      <ul className="mt-3 max-h-56 space-y-1.5 overflow-auto pl-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex-1">{it.name}</span>
            <span className="text-muted-foreground">{Number(it.price)} ج.م</span>
            <span className="flex items-center gap-1.5">
              <button aria-label="أقل" onClick={() => setPicked((p) => ({ ...p, [i]: Math.max(0, (p[i] ?? 0) - 1) }))} className="grid h-6 w-6 place-items-center rounded-full border border-border"><Minus className="h-3 w-3" /></button>
              <span className="w-4 text-center">{picked[i] ?? 0}</span>
              <button aria-label="أكثر" onClick={() => setPicked((p) => ({ ...p, [i]: (p[i] ?? 0) + 1 }))} className="grid h-6 w-6 place-items-center rounded-full border border-border"><Plus className="h-3 w-3" /></button>
            </span>
          </li>
        ))}
      </ul>
      <div className="my-4 h-px bg-border" />
      <dl className="space-y-1.5 text-sm text-muted-foreground">
        <div className="flex justify-between"><dt>إجمالي الأصناف</dt><dd>{subtotal} ج.م</dd></div>
        <div className="flex justify-between"><dt>رسوم الخدمة{fees?.service_charge_pct != null ? ` ${Number(fees.service_charge_pct)}%` : ""}</dt><dd>{service != null ? `${service} ج.م` : "غير معروفة"}</dd></div>
        <div className="flex justify-between"><dt>الضريبة{fees?.vat_pct != null ? ` ${Number(fees.vat_pct)}%` : ""}</dt><dd>{vat != null ? `${vat} ج.م` : "غير معروفة"}</dd></div>
      </dl>
      <div className="mt-4 flex items-end justify-between">
        <span className="text-sm">الإجمالي المتوقع</span>
        <span className="text-gold font-display text-4xl font-bold">{total} <span className="text-base">ج.م</span></span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">التكلفة لكل شخص: {people > 0 ? Math.ceil(total / people) : total} ج.م</p>
      <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${total <= budget ? "bg-primary/10 text-primary" : "bg-destructive/15 text-destructive-foreground"}`}>
        {total <= budget ? `جوه ميزانيتك ✓ وفاضل ${budget - total} ج.م` : `أعلى من ميزانيتك بـ ${total - budget} ج.م`}
      </p>
    </div>
  );
}
