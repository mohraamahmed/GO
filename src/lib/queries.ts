import { queryOptions } from "@tanstack/react-query";
import { listCafes, moodCafes, cafeMenu, dataQuality } from "@/lib/cafes.functions";
import type { MoodKey } from "@/lib/mood";

export const cafesQuery = queryOptions({ queryKey: ["cafes"], queryFn: () => listCafes(), staleTime: 5 * 60_000 });

export const moodQuery = (mood: MoodKey, areaClass: string | null) =>
  queryOptions({
    queryKey: ["mood-cafes", mood, areaClass],
    queryFn: () => moodCafes({ data: { mood, areaClass } }),
    staleTime: 5 * 60_000,
  });

export const menuQuery = (cafeId: string) =>
  queryOptions({ queryKey: ["cafe-menu", cafeId], queryFn: () => cafeMenu({ data: { cafeId } }), staleTime: 5 * 60_000 });

export const dataQualityQuery = queryOptions({ queryKey: ["data-quality"], queryFn: () => dataQuality(), staleTime: 60_000 });
