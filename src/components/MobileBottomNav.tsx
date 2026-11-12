import React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUserFn } from "@/lib/api-auth.functions";
import { useGlobalUI } from "@/context/GlobalUIContext";
import { Home, Compass, Bookmark, GitCompareArrows, Crown, User, ShieldCheck } from "lucide-react";

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { openFavorites, openCompare, openSubscription, favoritesCount, compareCount } = useGlobalUI();

  const hasSession = typeof document !== "undefined" && document.cookie.includes("cfl_session");
  const { data: authData } = useQuery({
    queryKey: ["current-user"],
    queryFn: () => getCurrentUserFn(),
    enabled: hasSession,
    staleTime: 10 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const user = authData?.user;
  const isAdmin = user?.role === "ADMIN";

  // Hide on admin routes so admin panel has full mobile screen real estate
  if (pathname.startsWith("/admin")) {
    return null;
  }

  const isHomeActive = pathname === "/";
  const isCafesActive = pathname.startsWith("/cafes");

  return (
    <nav
      aria-label="شريط التنقل السريع للهواتف"
      className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-card/95 backdrop-blur-xl border-t border-border/60 pb-safe transition-all shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
      dir="rtl"
    >
      <div className="flex h-16 items-center justify-around px-2">
        {/* 1. الرئيسية */}
        <Link
          to="/"
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors select-none ${
            isHomeActive ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Home className={`h-5 w-5 ${isHomeActive ? "stroke-[2.5]" : "stroke-[1.75]"}`} />
          <span className="text-[10px] mt-1">الرئيسية</span>
          {isHomeActive && <span className="h-1 w-4 rounded-full bg-primary mt-0.5" />}
        </Link>

        {/* 2. الكافيهات */}
        <Link
          to="/cafes"
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors select-none ${
            isCafesActive ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Compass className={`h-5 w-5 ${isCafesActive ? "stroke-[2.5]" : "stroke-[1.75]"}`} />
          <span className="text-[10px] mt-1">الكافيهات</span>
          {isCafesActive && <span className="h-1 w-4 rounded-full bg-primary mt-0.5" />}
        </Link>

        {/* 3. المفضلة (Quick Drawer) */}
        <button
          onClick={openFavorites}
          className="relative flex flex-col items-center justify-center flex-1 py-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none"
        >
          <div className="relative">
            <Bookmark className="h-5 w-5 stroke-[1.75]" />
            {favoritesCount > 0 && (
              <span className="absolute -top-1.5 -end-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {favoritesCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1">المفضلة</span>
        </button>

        {/* 4. المقارنة (Quick Modal) */}
        <button
          onClick={openCompare}
          className="relative flex flex-col items-center justify-center flex-1 py-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none"
        >
          <div className="relative">
            <GitCompareArrows className="h-5 w-5 stroke-[1.75]" />
            {compareCount > 0 && (
              <span className="absolute -top-1.5 -end-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {compareCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1">المقارنة</span>
        </button>

        {/* 5. باقاتي / الإدارة / الدخول */}
        {isAdmin ? (
          <Link
            to="/admin"
            className="flex flex-col items-center justify-center flex-1 py-1 text-primary hover:text-primary/90 transition-colors select-none"
          >
            <ShieldCheck className="h-5 w-5 stroke-[2]" />
            <span className="text-[10px] mt-1 font-bold">الإدارة</span>
          </Link>
        ) : user ? (
          <button
            onClick={openSubscription}
            className="flex flex-col items-center justify-center flex-1 py-1 text-primary hover:text-primary/90 transition-colors cursor-pointer select-none"
          >
            <Crown className="h-5 w-5 stroke-[2]" />
            <span className="text-[10px] mt-1 font-bold">الاشتراك</span>
          </button>
        ) : (
          <Link
            to="/auth"
            className="flex flex-col items-center justify-center flex-1 py-1 text-muted-foreground hover:text-primary transition-colors select-none"
          >
            <User className="h-5 w-5 stroke-[1.75]" />
            <span className="text-[10px] mt-1">دخول</span>
          </Link>
        )}
      </div>
    </nav>
  );
}

