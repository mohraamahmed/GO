// Mood Matching Engine — pure, testable scoring.
// Rule: unknown/disputed/outdated data NEVER counts as a positive signal.

export type MoodKey = "quiet" | "friends" | "romantic" | "relax" | "work";

export const MOODS: { key: MoodKey; label: string; desc: string }[] = [
  { key: "quiet", label: "هدوء وتركيز", desc: "أماكن هادئة تناسب التركيز والجلوس الطويل بعيدًا عن الضوضاء." },
  { key: "friends", label: "جلسة مع الأصدقاء", desc: "أماكن بجلسات جماعية ومساحات تناسب الخروجات." },
  { key: "romantic", label: "رومانسية", desc: "أماكن هادئة بجلسات مناسبة لشخصين وأجواء خاصة." },
  { key: "relax", label: "استرخاء", desc: "جلسات مريحة ومساحات مفتوحة لقضاء وقت هادئ." },
  { key: "work", label: "مذاكرة وعمل", desc: "واي فاي وأفياش وهدوء وطاولات تناسب اللابتوب." },
];

export interface AttrInput {
  noise_level: number | null;
  noise_level_status: string;
  seating_comfort: number | null;
  seating_comfort_status: string;
  group_seating: boolean | null;
  group_seating_status: string;
  couple_friendly: boolean | null;
  couple_friendly_status: string;
  outdoor_seating: boolean | null;
  outdoor_seating_status: string;
  workspace_suitability: number | null;
  workspace_suitability_status: string;
  wifi_available: boolean | null;
  wifi_available_status: string;
  power_outlets: boolean | null;
  power_outlets_status: string;
  laptop_friendly: boolean | null;
  laptop_friendly_status: string;
}

export const EMPTY_ATTRS: AttrInput = {
  noise_level: null, noise_level_status: "unknown",
  seating_comfort: null, seating_comfort_status: "unknown",
  group_seating: null, group_seating_status: "unknown",
  couple_friendly: null, couple_friendly_status: "unknown",
  outdoor_seating: null, outdoor_seating_status: "unknown",
  workspace_suitability: null, workspace_suitability_status: "unknown",
  wifi_available: null, wifi_available_status: "unknown",
  power_outlets: null, power_outlets_status: "unknown",
  laptop_friendly: null, laptop_friendly_status: "unknown",
};

// Reliability weight per verification status. Unknown = zero, never a positive point.
const STATUS_WEIGHT: Record<string, number> = { confirmed: 1, owner_confirmed: 1, user_reported: 0.5 };
const w = (status: string) => STATUS_WEIGHT[status] ?? 0;

// Scale 1..5 attributes contribute (value/5)*points; quietness contributes ((6-noise)/5)*points.
const scaled = (v: number | null, status: string, points: number) =>
  v == null ? 0 : (v / 5) * points * w(status);
const quiet = (v: number | null, status: string, points: number) =>
  v == null ? 0 : ((6 - v) / 5) * points * w(status);
const flag = (v: boolean | null, status: string, points: number) =>
  v === true ? points * w(status) : 0;

export function moodScore(mood: MoodKey, a: AttrInput): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const add = (pts: number, reason: string) => {
    if (pts > 0) { score += pts; reasons.push(reason); }
  };

  switch (mood) {
    case "quiet":
      add(quiet(a.noise_level, a.noise_level_status, 6), "تقارير موثقة عن الهدوء");
      add(scaled(a.seating_comfort, a.seating_comfort_status, 3), "مقاعد مريحة للجلوس الطويل");
      break;
    case "friends":
      add(flag(a.group_seating, a.group_seating_status, 6), "جلسات جماعية متاحة");
      add(scaled(a.seating_comfort, a.seating_comfort_status, 2), "جلسات مريحة");
      break;
    case "romantic":
      add(flag(a.couple_friendly, a.couple_friendly_status, 5), "جلسات مناسبة لشخصين");
      add(quiet(a.noise_level, a.noise_level_status, 3), "أجواء هادئة");
      add(flag(a.outdoor_seating, a.outdoor_seating_status, 2), "جلسات خارجية");
      break;
    case "relax":
      add(flag(a.outdoor_seating, a.outdoor_seating_status, 5), "جلسات خارجية");
      add(scaled(a.seating_comfort, a.seating_comfort_status, 3), "جلسات مريحة");
      add(quiet(a.noise_level, a.noise_level_status, 2), "أجواء هادئة");
      break;
    case "work":
      add(flag(a.wifi_available, a.wifi_available_status, 4), "واي فاي مؤكد");
      add(flag(a.power_outlets, a.power_outlets_status, 4), "أفياش كهرباء متاحة");
      add(flag(a.laptop_friendly, a.laptop_friendly_status, 3), "مناسب للابتوب");
      add(scaled(a.workspace_suitability, a.workspace_suitability_status, 3), "ملاءمة موثقة للعمل");
      add(quiet(a.noise_level, a.noise_level_status, 2), "مستوى هدوء مناسب");
      break;
  }
  return { score: Math.round(score * 100) / 100, reasons };
}
