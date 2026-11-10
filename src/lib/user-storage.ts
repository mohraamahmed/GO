/**
 * User persistent storage manager (Favorites, Saved Outing Plans, Comparison List)
 * Uses browser localStorage with fallback and event broadcasting for cross-component reactivity.
 */

export interface SavedPlanItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

export interface SavedOutingPlan {
  id: string;
  title: string;
  cafeId: string;
  cafeName: string;
  cafeArea: string;
  peopleCount: number;
  budgetTotal: number;
  transportationBudget: number;
  items: SavedPlanItem[];
  subtotal: number;
  serviceAmount: number;
  vatAmount: number;
  grandTotal: number;
  mapsUrl?: string | undefined;
  createdAt: string; // ISO date
}

const FAVORITES_KEY = "cafelens_favorites";
const SAVED_PLANS_KEY = "cafelens_saved_plans";
const COMPARE_KEY = "cafelens_compare_list";

let memoryFavorites: string[] | null = null;
let memorySavedPlans: SavedOutingPlan[] | null = null;
let memoryCompareList: string[] | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (!e.key || e.key === FAVORITES_KEY) memoryFavorites = null;
    if (!e.key || e.key === SAVED_PLANS_KEY) memorySavedPlans = null;
    if (!e.key || e.key === COMPARE_KEY) memoryCompareList = null;
  });
}

function safeGetItem<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (e) {
    console.error(`Failed reading ${key} from localStorage:`, e);
    return defaultValue;
  }
}

function safeSetItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    if (key === FAVORITES_KEY) memoryFavorites = value as unknown as string[];
    else if (key === SAVED_PLANS_KEY) memorySavedPlans = value as unknown as SavedOutingPlan[];
    else if (key === COMPARE_KEY) memoryCompareList = value as unknown as string[];
    window.dispatchEvent(new CustomEvent("cafelens_storage_update", { detail: { key } }));
  } catch (e) {
    console.error(`Failed writing ${key} to localStorage:`, e);
  }
}

// ----------------- FAVORITES -----------------

export function getFavorites(): string[] {
  if (memoryFavorites !== null) return memoryFavorites;
  memoryFavorites = safeGetItem<string[]>(FAVORITES_KEY, []);
  return memoryFavorites;
}

export function isFavorite(cafeId: string): boolean {
  const favs = getFavorites();
  return favs.includes(cafeId);
}

export function toggleFavorite(cafeId: string): boolean {
  const favs = getFavorites();
  const exists = favs.includes(cafeId);
  const next = exists ? favs.filter((id) => id !== cafeId) : [...favs, cafeId];
  safeSetItem(FAVORITES_KEY, next);
  return !exists;
}

// ----------------- SAVED OUTING PLANS -----------------

export function getSavedPlans(): SavedOutingPlan[] {
  if (memorySavedPlans !== null) return memorySavedPlans;
  memorySavedPlans = safeGetItem<SavedOutingPlan[]>(SAVED_PLANS_KEY, []);
  return memorySavedPlans;
}

export function saveOutingPlan(plan: Omit<SavedOutingPlan, "id" | "createdAt">): SavedOutingPlan {
  const current = getSavedPlans();
  const newPlan: SavedOutingPlan = {
    ...plan,
    id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  const updated = [newPlan, ...current];
  safeSetItem(SAVED_PLANS_KEY, updated);
  return newPlan;
}

export function deleteOutingPlan(planId: string): void {
  const current = getSavedPlans();
  const updated = current.filter((p) => p.id !== planId);
  safeSetItem(SAVED_PLANS_KEY, updated);
}

// ----------------- COMPARISON LIST (MAX 3) -----------------

export function getCompareList(): string[] {
  if (memoryCompareList !== null) return memoryCompareList;
  memoryCompareList = safeGetItem<string[]>(COMPARE_KEY, []);
  return memoryCompareList;
}

export function isInCompareList(cafeId: string): boolean {
  return getCompareList().includes(cafeId);
}

export function toggleCompareCafe(cafeId: string): { inList: boolean; list: string[]; error?: string } {
  const current = getCompareList();
  if (current.includes(cafeId)) {
    const next = current.filter((id) => id !== cafeId);
    safeSetItem(COMPARE_KEY, next);
    return { inList: false, list: next };
  }

  if (current.length >= 3) {
    return { inList: false, list: current, error: "يمكنك مقارنة 3 كافيهات كحد أقصى في وقت واحد" };
  }

  const next = [...current, cafeId];
  safeSetItem(COMPARE_KEY, next);
  return { inList: true, list: next };
}

export function clearCompareList(): void {
  safeSetItem(COMPARE_KEY, []);
}
