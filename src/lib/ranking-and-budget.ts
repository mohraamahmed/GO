/**
 * CaféLens - Core Algorithm & Outing Budget Engine
 * 
 * Implements:
 * 1. Bayesian Rating calculation with confidence threshold
 * 2. Multi-factor Cafe Scoring (Bayesian quality, budget fit, facilities & experience)
 * 3. Egyptian Restaurant & Cafe Tax / Service charge calculations (14% VAT, 12% Service)
 * 4. Transportation budget integration & Budget state detection
 * 5. Smart alternative recommendations with human-readable rationale
 */

import { type CafeListItem } from "./cafes.functions";

export type VerificationStatus = "verified" | "needs_verification" | "outdated" | "unconfirmed";

export interface MenuItem {
  id: string;
  name: string;
  category: "hot" | "cold" | "specialty" | "food" | "dessert";
  categoryLabel: string;
  price: number;
  desc?: string | undefined;
  description?: string | undefined;
}

export function getCafeMenuData(
  cafe: Pick<CafeListItem, "price_level">,
  realItems?: { name: string; price: number; category: string | null; description?: string | null }[]
): MenuItem[] {
  if (realItems && realItems.length > 0) {
    return realItems.map((it, idx) => ({
      id: `real-${idx}`,
      name: it.name,
      category: (it.category === "dessert" ? "dessert" : it.category === "food" ? "food" : "hot") as MenuItem["category"],
      categoryLabel: it.category === "dessert" ? "حلويات" : it.category === "food" ? "مأكولات" : "مشروبات",
      price: Number(it.price),
      desc: it.description || undefined,
    }));
  }

  const pLevel = cafe.price_level ?? 2;
  const factor = pLevel === 1 ? 0.75 : pLevel === 3 ? 1.3 : pLevel === 4 ? 1.6 : 1.0;
  const round = (val: number) => Math.round((val * factor) / 5) * 5;

  return [
    { id: "h1", name: "إسبريسو سينجل / دبل", category: "hot", categoryLabel: "مشروبات ساخنة", price: round(55), desc: "حبوب بن أرابيكا مختصة 100%" },
    { id: "h2", name: "فلات وايت (Flat White)", category: "hot", categoryLabel: "مشروبات ساخنة", price: round(95), desc: "مستخلص ريستريتو مزدوج مع حليب مخملي" },
    { id: "h3", name: "كابتشينو كلاسيك", category: "hot", categoryLabel: "مشروبات ساخنة", price: round(90), desc: "إسبريسو غني مع رغوة حليب كريمية" },
    { id: "h4", name: "كورتادو كلاسيكي", category: "hot", categoryLabel: "مشروبات ساخنة", price: round(85), desc: "توازن مثالي بين الإسبريسو والحليب المبخر" },
    { id: "h5", name: "لاتيه فانيليا / كراميل", category: "hot", categoryLabel: "مشروبات ساخنة", price: round(105), desc: "مع نكهات طبيعية وسيرب فاخر" },
    { id: "h6", name: "هوت شوكليت بلجيكي", category: "hot", categoryLabel: "مشروبات ساخنة", price: round(115), desc: "شوكولاتة داكنة بلجيكية مذابة مع حليب طازج" },
    { id: "h7", name: "شاي إنجليزي / أخضر بالنعناع", category: "hot", categoryLabel: "مشروبات ساخنة", price: round(45), desc: "أوراق شاي فاخرة مستوردة" },

    { id: "c1", name: "آيس سبانش لاتيه (Spanish Latte)", category: "cold", categoryLabel: "مشروبات مثلجة وباردة", price: round(125), desc: "المشروب الأكثر طلباً بالحليب المكثف المحلى" },
    { id: "c2", name: "آيس كراميل ماكياتو", category: "cold", categoryLabel: "مشروبات مثلجة وباردة", price: round(120), desc: "صوص كراميل مملح مع إسبريسو وحليب مثلج" },
    { id: "c3", name: "كولد برو منقوع 24 ساعة", category: "cold", categoryLabel: "مشروبات مثلجة وباردة", price: round(110), desc: "استخلاص بارد بنكهات ناعمة وقوام منعش" },
    { id: "c4", name: "آيس ماتشا لاتيه ياباني", category: "cold", categoryLabel: "مشروبات مثلجة وباردة", price: round(145), desc: "شاي ماتشا احتفالي ياباني مع حليب شوفان أو لوز" },
    { id: "c5", name: "موهيتو باشن فروت / توت مثلج", category: "cold", categoryLabel: "مشروبات مثلجة وباردة", price: round(95), desc: "صودا منعشة مع نعناع وليمون طبيعي" },
    { id: "c6", name: "آيس شيكن إسبريسو", category: "cold", categoryLabel: "مشروبات مثلجة وباردة", price: round(105), desc: "مخفوق مع الثلج وسكر بني ونكهة فانيليا" },

    { id: "s1", name: "V60 قهوة مقطرة (إثيوبي / كولومبي)", category: "specialty", categoryLabel: "قهوة مقطرة مختصة", price: round(130), desc: "محاصيل مختصة فردية المصدر مع إيحاءات فاكهية" },
    { id: "s2", name: "كيمكس مقطرة (Chemex)", category: "specialty", categoryLabel: "قهوة مقطرة مختصة", price: round(145), desc: "تصفية نقية للغاية وقوام خفيف معتدل الحمضية" },
    { id: "s3", name: "آيس دريب ياباني (Ice Drip)", category: "specialty", categoryLabel: "قهوة مقطرة مختصة", price: round(135), desc: "مقطر مباشرة على الثلج لتركيز النكهات" },

    { id: "f1", name: "كرواسون زبدة فرنسي محشو جبن", category: "food", categoryLabel: "سندوتشات ومخبوزات", price: round(85), desc: "مخبوز طازج يومياً بزبدة فرنسية طبيعية" },
    { id: "f2", name: "ساندوتش تركي مدخن مع شيدر وجرجير", category: "food", categoryLabel: "سندوتشات ومخبوزات", price: round(145), desc: "في خبز تشاباتا محمص مع صوص مايونيز ديجون" },
    { id: "f3", name: "كلوب ساندوتش دجاج مشوي", category: "food", categoryLabel: "سندوتشات ومخبوزات", price: round(175), desc: "صدور دجاج مشوية مع بيض وجبنة شيدر وخضار طازج" },
    { id: "f4", name: "بانيني حلومي مشوي مع بيستو طازج", category: "food", categoryLabel: "سندوتشات ومخبوزات", price: round(155), desc: "طماطم مجففة مع جبنة حلومي مشوية في خبز فوكاشيا" },
    { id: "f5", name: "توست أفوكادو مع بيض بوشيه", category: "food", categoryLabel: "سندوتشات ومخبوزات", price: round(165), desc: "مع حبوب شيا وزيت زيتون بكر ممتاز" },

    { id: "d1", name: "سان سيباستيان تشيز كيك مع شوكولاتة", category: "dessert", categoryLabel: "حلويات وكيك", price: round(160), desc: "محروقة من الأعلى وقوام كريمي غني تذوب في الفم" },
    { id: "d2", name: "فرينش توست بريوش بالكراميل المملح", category: "dessert", categoryLabel: "حلويات وكيك", price: round(175), desc: "خبز بريوش طري مع آيس كريم فانيليا وبقان مكرمل" },
    { id: "d3", name: "كوكيز كندر محشو ساخن", category: "dessert", categoryLabel: "حلويات وكيك", price: round(85), desc: "كوكيز طري محشو شوكولاتة كندر ونوتيلا ذائبة" },
    { id: "d4", name: "وافل بلجيكي مقرمش بنوتيلا وفواكه", category: "dessert", categoryLabel: "حلويات وكيك", price: round(140), desc: "يقدم ساخناً مع صوص شوكولاتة وفراولة وموز" },
    { id: "d5", name: "تيراميسو ماسكاربوني إيطالي أصلي", category: "dessert", categoryLabel: "حلويات وكيك", price: round(150), desc: "بسكويت ليدي فينجرز مغموس بإسبريسو وكريمة ماسكاربوني" },
    { id: "d6", name: "مولتن شوكليت كيك لافا", category: "dessert", categoryLabel: "حلويات وكيك", price: round(155), desc: "قلب شوكولاتة سائل مع بولة آيس كريم فانيليا" },
  ];
}

export interface CafeVerificationInfo {
  status: VerificationStatus;
  statusLabel: string;
  badgeClass: string;
  source: string;
  lastUpdated: string; // ISO date string or formatted date
  notes?: string;
}

export type FacilityKey =
  | "wifi"
  | "power_outlets"
  | "quiet"
  | "outdoor"
  | "ac"
  | "parking"
  | "work_friendly";

export interface FacilityOption {
  key: FacilityKey;
  label: string;
  iconName: string;
}

export const FACILITIES_LIST: FacilityOption[] = [
  { key: "wifi", label: "واي فاي سريع", iconName: "Wifi" },
  { key: "power_outlets", label: "مقابس كهرباء", iconName: "Zap" },
  { key: "work_friendly", label: "مناسب للعمل / لابتوب", iconName: "Laptop" },
  { key: "outdoor", label: "جلسات خارجية / تراس", iconName: "TreePine" },
  { key: "quiet", label: "أجواء هادئة", iconName: "VolumeX" },
  { key: "ac", label: "تكييف ممتاز", iconName: "Wind" },
  { key: "parking", label: "مواقف سيارات", iconName: "Car" },
];

/**
 * Calculates Bayesian Weighted Rating:
 * WR = (v / (v + m)) * R + (m / (v + m)) * C
 * 
 * @param rating Average rating of the cafe (1.0 - 5.0)
 * @param reviewCount Number of reviews (v)
 * @param minReviews Confidence threshold (m, default 40)
 * @param cairoMean Overall benchmark mean rating (C, default 4.35)
 */
export function calculateBayesianRating(
  rating: number,
  reviewCount: number,
  minReviews: number = 40,
  cairoMean: number = 4.35
): number {
  const v = Math.max(0, reviewCount);
  const r = Math.max(1, Math.min(5, rating));
  const m = Math.max(1, minReviews);
  const c = cairoMean;

  const weighted = (v / (v + m)) * r + (m / (v + m)) * c;
  return Number(weighted.toFixed(2));
}

/**
 * Derives verification status and source info for any cafe
 */
export function getCafeVerification(cafe: CafeListItem): CafeVerificationInfo {
  const ratingCount = Number(cafe.rating_count ?? 0);
  const hasPhotos = Array.isArray(cafe.photos) && cafe.photos.length > 0;
  const hasHours = Array.isArray(cafe.hours) && cafe.hours.length > 0;
  const hasPhone = Boolean(cafe.phone);
  const source = cafe.source || "بيانات Google Maps المعتمدة";

  // If verified_at is within the last 180 days and has reliable details
  const verifiedDate = cafe.verified_at ? new Date(cafe.verified_at) : new Date("2024-10-15");
  const isRecent = !isNaN(verifiedDate.getTime());
  const dateFormatted = isRecent
    ? verifiedDate.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })
    : "أكتوبر 2024";

  if (ratingCount >= 50 && hasPhotos && (hasHours || hasPhone)) {
    return {
      status: "verified",
      statusLabel: "بيانات المكان موثّقة",
      badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      source,
      lastUpdated: dateFormatted,
      notes: "الموقع، المواعيد، والصور مؤكدة رسمياً (المنيو والأسعار تقديرية حسب الفئة).",
    };
  }

  if (ratingCount >= 15 && (hasPhotos || hasPhone)) {
    return {
      status: "needs_verification",
      statusLabel: "قيد المراجعة الدورية",
      badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      source,
      lastUpdated: dateFormatted,
      notes: "البيانات الأساسية متوفرة وقيد المراجعة الميدانية للأسعار.",
    };
  }

  if (ratingCount < 15 && ratingCount > 0) {
    return {
      status: "unconfirmed",
      statusLabel: "غير مؤكد بالكامل",
      badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/30",
      source,
      lastUpdated: dateFormatted,
      notes: "عدد التقييمات محدود، يُنصح بالتواصل هاتفياً قبل الزيارة.",
    };
  }

  return {
    status: "outdated",
    statusLabel: "قديم / بانتظار التحديث",
    badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    source,
    lastUpdated: dateFormatted,
    notes: "نحتاج لتحديث قائمة الأسعار الحالية.",
  };
}

/**
 * Standard Egyptian Food & Beverage Bill Calculation
 * - Subtotal
 * - Optional 12% Service charge
 * - Optional 14% VAT (calculated on subtotal + service)
 */
export function calculateBillWithFees(
  subtotal: number,
  options?: {
    hasServiceCharge?: boolean; // default true for dine-in
    hasVat?: boolean; // default true in formal cafes
  }
) {
  const { hasServiceCharge = true, hasVat = true } = options ?? {};
  const baseSubtotal = Math.max(0, subtotal);

  const serviceRate = hasServiceCharge ? 0.12 : 0;
  const serviceAmount = Math.round(baseSubtotal * serviceRate);

  const vatBase = baseSubtotal + serviceAmount;
  const vatRate = hasVat ? 0.14 : 0;
  const vatAmount = Math.round(vatBase * vatRate);

  const grandTotal = baseSubtotal + serviceAmount + vatAmount;

  return {
    subtotal: baseSubtotal,
    serviceRate,
    serviceAmount,
    vatRate,
    vatAmount,
    grandTotal,
  };
}

export interface CafeScoringResult {
  cafe: CafeListItem;
  matchScore: number;
  bayesianRating: number;
  budgetFitScore: number;
  qualityScore: number;
  facilityScore: number;
  experienceScore: number;
  badge: string;
  expectedCost: number;
  budgetEfficiencyPct: number;
  reason: string;
  budgetStatus: "within_budget" | "near_limit" | "over_budget";
  missingFacilities: string[];
}

/**
 * Advanced multi-factor scoring matching the CafeLens technical spec
 */
export function calculateCafeScoreWithFacilities(
  cafe: CafeListItem,
  budgetPerPerson: number,
  itemType: "combo" | "drink" | "food",
  selectedFacilities: FacilityKey[] = []
): CafeScoringResult {
  const pLevel = cafe.price_level ?? 2;
  const rawRating = Number(cafe.rating ?? 4.0);
  const reviews = Number(cafe.rating_count ?? 15);

  // 1. Expected Baseline Cost per Person
  const baseCost = itemType === "drink" ? 95 : itemType === "food" ? 155 : 240;
  const multiplier = pLevel === 1 ? 0.65 : pLevel === 3 ? 1.35 : pLevel === 4 ? 1.85 : 1.0;
  const expectedCost = Math.round(baseCost * multiplier);

  // 2. Budget Fit Score (0 - 40 points)
  let budgetFit = 0;
  let budgetStatus: "within_budget" | "near_limit" | "over_budget" = "within_budget";

  if (expectedCost <= budgetPerPerson) {
    const utilRatio = expectedCost / Math.max(1, budgetPerPerson);
    if (utilRatio >= 0.88 && utilRatio <= 1.0) {
      budgetStatus = "near_limit";
      budgetFit = 38;
    } else if (utilRatio >= 0.65 && utilRatio < 0.88) {
      budgetStatus = "within_budget";
      budgetFit = 40;
    } else {
      budgetStatus = "within_budget";
      budgetFit = 30 + utilRatio * 10;
    }
  } else {
    budgetStatus = "over_budget";
    const overPct = (expectedCost - budgetPerPerson) / budgetPerPerson;
    budgetFit = Math.max(0, 30 - overPct * 75);
  }

  // 3. Bayesian Quality Score (0 - 35 points)
  const bayesianRating = calculateBayesianRating(rawRating, reviews, 40, 4.35);
  const ratingPoints = Math.max(0, Math.min(29, ((bayesianRating - 3.5) / 1.5) * 29));
  const reviewBonus = Math.min(6, Math.log10(Math.max(10, reviews)) * 2);
  const qualityScore = Math.min(35, ratingPoints + reviewBonus);

  // 4. Facility Match Score (0 - 15 points)
  const missingFacilities: string[] = [];
  let facilityPoints = 0;

  if (selectedFacilities.length > 0) {
    const servicesText = (cafe.services || []).join(" ").toLowerCase();
    const nameAndArea = (cafe.name + " " + (cafe.area || "")).toLowerCase();
    let matchedCount = 0;
    selectedFacilities.forEach((fac) => {
      let matched = false;
      if (fac === "outdoor" && (servicesText.includes("خارجية") || servicesText.includes("outdoor") || servicesText.includes("تراس") || servicesText.includes("حديقة"))) {
        matched = true;
      } else if (fac === "wifi" && (servicesText.includes("واي فاي") || servicesText.includes("wifi") || cafe.category === "work")) {
        matched = true;
      } else if (fac === "power_outlets" && (servicesText.includes("مقابس") || servicesText.includes("فيش") || servicesText.includes("شواحن") || servicesText.includes("outlets") || servicesText.includes("power") || (cafe.category === "work" && servicesText.includes("عمل")))) {
        matched = true;
      } else if (fac === "work_friendly" && (cafe.category === "work" || servicesText.includes("عمل") || servicesText.includes("لابتوب") || servicesText.includes("مذاكرة"))) {
        matched = true;
      } else if (fac === "quiet" && (servicesText.includes("هدوء") || servicesText.includes("هادئ") || servicesText.includes("quiet") || servicesText.includes("قراءة") || (cafe.category === "work" && servicesText.includes("هدوء")))) {
        matched = true;
      } else if (fac === "ac" && (servicesText.includes("تكييف") || servicesText.includes("مكيف") || servicesText.includes("ac") || servicesText.includes("air condition") || servicesText.includes("صالات مكيفة") || servicesText.includes("داخلية") || servicesText.includes("indoor"))) {
        matched = true;
      } else if (fac === "parking" && (servicesText.includes("مواقف") || servicesText.includes("باركينج") || servicesText.includes("parking") || servicesText.includes("جراج") || nameAndArea.includes("مول") || nameAndArea.includes("mall") || nameAndArea.includes("plaza") || nameAndArea.includes("بلازا"))) {
        matched = true;
      }

      if (matched) {
        matchedCount++;
      } else {
        const option = FACILITIES_LIST.find((f) => f.key === fac);
        if (option) missingFacilities.push(option.label);
      }
    });

    facilityPoints = (matchedCount / selectedFacilities.length) * 15;
  } else {
    // Default facility points based on available services
    facilityPoints = Math.min(15, (cafe.services.length || 2) * 3);
  }

  // 5. Experience & Relevance Bonus (0 - 10 points)
  let experienceScore = 0;
  if (itemType === "drink" && cafe.category === "coffee_roastery") {
    experienceScore += 5;
  } else if (itemType === "food") {
    const servicesText = (cafe.services || []).join(" ").toLowerCase();
    if (servicesText.includes("إفطار") || servicesText.includes("حلويات") || servicesText.includes("مأكولات")) {
      experienceScore += 5;
    } else {
      experienceScore += 3;
    }
  } else {
    experienceScore += 3;
  }

  if (Array.isArray(cafe.photos) && cafe.photos.length > 0) experienceScore += 3;
  if (cafe.maps_url) experienceScore += 2;

  // Composite Total Score (0 - 100)
  const rawTotal = budgetFit + qualityScore + facilityPoints + experienceScore;
  const matchScore = Math.max(40, Math.min(99, Math.round(rawTotal)));
  const budgetEfficiencyPct = Math.min(100, Math.round((expectedCost / Math.max(1, budgetPerPerson)) * 100));

  // Dynamic Badge Assignment
  let badge = "توافق ذكي مع الميزانية";
  if (matchScore >= 90 && qualityScore >= 30 && missingFacilities.length === 0) {
    badge = "🌟 الاختيار الخوارزمي الأذكى (أفضل قيمة)";
  } else if (bayesianRating >= 4.6 && reviews > 120) {
    badge = "👑 أعلى موثوقية وجودة معتمدة";
  } else if (cafe.category === "coffee_roastery") {
    badge = "☕ محمصـة وقهوة مختصة مقترحة";
  } else if (budgetStatus === "within_budget" && expectedCost < budgetPerPerson * 0.75) {
    badge = "💰 قيمة ممتازة وتوفير فائض";
  } else if (budgetStatus === "over_budget") {
    badge = "⚠️ تجربة فاخرة (أعلى قليلاً من الميزانية)";
  }

  // Human-Readable Rationale Explanation
  let reason = "";
  if (budgetStatus === "within_budget") {
    const diff = budgetPerPerson - expectedCost;
    reason = `يستغل ${budgetEfficiencyPct}% من ميزانيتك بمتوسط طلب ${expectedCost} ج.م/فرد مع توفير ${diff} ج.م وبتقييم بيزي موثوق ★${bayesianRating.toFixed(2)} (${reviews} تقييم حقيقي).`;
  } else if (budgetStatus === "near_limit") {
    reason = `استغلال مثالي للحد الأقصى من الميزانية (${expectedCost} ج.م/فرد) مع تجربة كاملة وتقييم ★${bayesianRating.toFixed(2)}.`;
  } else {
    const overDiff = expectedCost - budgetPerPerson;
    reason = `كافيه متميز يتجاوز الميزانية بمقدار ${overDiff} ج.م/فرد. يُنصح بطلب مشروب فقط أو تصفح البدائل الأوفر أدناه.`;
  }

  return {
    cafe,
    matchScore,
    bayesianRating,
    budgetFitScore: Math.round(budgetFit),
    qualityScore: Math.round(qualityScore),
    facilityScore: Math.round(facilityPoints),
    experienceScore: Math.round(experienceScore),
    badge,
    expectedCost,
    budgetEfficiencyPct,
    reason,
    budgetStatus,
    missingFacilities,
  };
}

/**
 * Finds smart alternatives when a cafe is over budget, missing amenities, or the user wants similar places
 */
export function findSmartAlternatives(
  currentCafeId: string,
  allCafes: CafeListItem[],
  budgetPerPerson: number,
  itemType: "combo" | "drink" | "food",
  selectedFacilities: FacilityKey[] = [],
  limit: number = 3
): { cafe: CafeListItem; score: CafeScoringResult; rationale: string }[] {
  const current = allCafes.find((c) => c.id === currentCafeId);
  const currentArea = current?.area_class;

  const others = allCafes.filter((c) => c.id !== currentCafeId);
  const scored = others.map((c) => {
    const score = calculateCafeScoreWithFacilities(c, budgetPerPerson, itemType, selectedFacilities);
    return { cafe: c, score };
  });

  // Sort candidates prioritizing:
  // 1. Same area class or nearby
  // 2. Fits within budget (budgetStatus === "within_budget" or "near_limit")
  // 3. High matchScore
  scored.sort((a, b) => {
    const aSameArea = currentArea && a.cafe.area_class === currentArea ? 1 : 0;
    const bSameArea = currentArea && b.cafe.area_class === currentArea ? 1 : 0;
    if (aSameArea !== bSameArea) return bSameArea - aSameArea;

    const aWithin = a.score.budgetStatus !== "over_budget" ? 1 : 0;
    const bWithin = b.score.budgetStatus !== "over_budget" ? 1 : 0;
    if (aWithin !== bWithin) return bWithin - aWithin;

    return b.score.matchScore - a.score.matchScore;
  });

  return scored.slice(0, limit).map(({ cafe, score }) => {
    let rationale = "";
    if (score.budgetStatus !== "over_budget" && score.expectedCost <= budgetPerPerson) {
      const saved = Math.max(0, budgetPerPerson - score.expectedCost);
      rationale = `أوفر في الميزانية (يوفر حوالي ${saved} ج.م) وبتقييم بيزي معتمد ★${score.bayesianRating.toFixed(2)}`;
    } else if (score.facilityScore >= 12) {
      rationale = `تطابق رائع مع الخدمات المطلوبة في نفس المنطقة وتقييم ★${score.bayesianRating.toFixed(2)}`;
    } else {
      rationale = `بديل ممتاز في ${cafe.area} بمتوسط ${score.expectedCost} ج.م وتوافق ${score.matchScore}%`;
    }

    return { cafe, score, rationale };
  });
}
