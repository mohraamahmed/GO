import React, { createContext, useContext, useState, useEffect } from "react";
import { getFavorites, getCompareList } from "@/lib/user-storage";
import { useQuery } from "@tanstack/react-query";
import { cafesQuery } from "@/lib/queries";
import { type CafeListItem } from "@/lib/cafes.functions";
import { FavoritesDrawer } from "@/components/FavoritesDrawer";
import { CafeComparisonModal } from "@/components/CafeComparisonModal";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { getCurrentUserFn } from "@/lib/api-auth.functions";

interface GlobalUIContextType {
  openFavorites: () => void;
  closeFavorites: () => void;
  openCompare: () => void;
  closeCompare: () => void;
  openSubscription: () => void;
  closeSubscription: () => void;
  favoritesCount: number;
  compareCount: number;
  isFavoritesOpen: boolean;
  isCompareOpen: boolean;
  isSubscriptionOpen: boolean;
  allCafes: CafeListItem[];
  currentUser: any;
}

const GlobalUIContext = createContext<GlobalUIContextType | null>(null);

export function GlobalUIProvider({ children }: { children: React.ReactNode }) {
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [compareCount, setCompareCount] = useState(0);

  // Sync favorites & compare list count
  useEffect(() => {
    const syncCounts = () => {
      setFavoritesCount(getFavorites().length);
      setCompareCount(getCompareList().length);
    };

    syncCounts();
    window.addEventListener("cafelens_storage_update", syncCounts);
    return () => window.removeEventListener("cafelens_storage_update", syncCounts);
  }, []);

  // Cafes query for modals
  const { data: allCafes = [] } = useQuery(cafesQuery);

  // Current user query for subscription modal & auth state
  const { data: authData } = useQuery({
    queryKey: ["current-user"],
    queryFn: () => getCurrentUserFn(),
    staleTime: 60_000,
  });

  return (
    <GlobalUIContext.Provider
      value={{
        openFavorites: () => setIsFavoritesOpen(true),
        closeFavorites: () => setIsFavoritesOpen(false),
        openCompare: () => setIsCompareOpen(true),
        closeCompare: () => setIsCompareOpen(false),
        openSubscription: () => setIsSubscriptionOpen(true),
        closeSubscription: () => setIsSubscriptionOpen(false),
        favoritesCount,
        compareCount,
        isFavoritesOpen,
        isCompareOpen,
        isSubscriptionOpen,
        allCafes,
        currentUser: authData?.user,
      }}
    >
      {children}

      {/* Global Modals rendered once at root level */}
      <FavoritesDrawer
        isOpen={isFavoritesOpen}
        onClose={() => setIsFavoritesOpen(false)}
        allCafes={allCafes}
      />

      <CafeComparisonModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        allCafes={allCafes}
      />

      <SubscriptionModal
        isOpen={isSubscriptionOpen}
        onClose={() => setIsSubscriptionOpen(false)}
        user={authData?.user}
      />
    </GlobalUIContext.Provider>
  );
}

export function useGlobalUI() {
  const context = useContext(GlobalUIContext);
  if (!context) {
    throw new Error("useGlobalUI must be used within a GlobalUIProvider");
  }
  return context;
}

