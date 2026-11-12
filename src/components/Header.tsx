import React from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentUserFn, logoutUserFn } from "@/lib/api-auth.functions";
import { useGlobalUI } from "@/context/GlobalUIContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Aperture,
  Bookmark,
  GitCompareArrows,
  Crown,
  User,
  LogOut,
  ShieldCheck,
  Compass,
  Home,
  Database,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

export function Header() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
  const subscription = authData?.subscription;
  const isAdmin = user?.role === "ADMIN";

  const handleSignOut = async () => {
    try {
      await logoutUserFn();
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.clear();
      toast.success("تم تسجيل الخروج بنجاح");
      navigate({ to: "/" });
    } catch {
      toast.error("تعذر تسجيل الخروج");
    }
  };

  const navLinks = [
    { to: "/", label: "الرئيسية", icon: Home, exact: true },
    { to: "/cafes", label: "دليل الكافيهات", icon: Compass, exact: false },
    { to: "/data-quality", label: "جودة البيانات", icon: Database, exact: true },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/85 backdrop-blur-xl transition-all" dir="rtl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand / Logo */}
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5 transition hover:opacity-90 select-none">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/25 text-primary shadow-sm">
              <Aperture className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="flex flex-col">
              <span className="font-latin text-xl font-bold tracking-tight text-foreground leading-none">CaféLens</span>
              <span className="text-[10px] text-muted-foreground font-sans mt-0.5">دليل كافيهات القاهرة</span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const active = link.exact ? pathname === link.to : pathname.startsWith(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to as any}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? "bg-primary/10 text-primary font-bold shadow-sm"
                      : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                  }`}
                >
                  <link.icon className="h-4 w-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Favorites Button */}
          <button
            onClick={openFavorites}
            className="relative flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 hover:bg-card/90 transition shadow-sm cursor-pointer"
            title="المفضلة والخطط المحفوظة"
          >
            <Bookmark className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">المفضلة</span>
            {favoritesCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {favoritesCount}
              </span>
            )}
          </button>

          {/* Compare Button */}
          <button
            onClick={openCompare}
            className="relative flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 hover:bg-card/90 transition shadow-sm cursor-pointer"
            title="مقارنة الكافيهات"
          >
            <GitCompareArrows className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">المقارنة</span>
            {compareCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {compareCount}
              </span>
            )}
          </button>

          {/* Subscription Modal Trigger CTA */}
          <Button
            variant="gold"
            size="sm"
            onClick={openSubscription}
            className="hidden sm:flex items-center gap-1.5 text-xs font-bold shadow-sm"
          >
            <Crown className="h-3.5 w-3.5" />
            <span>باقات الاشتراك</span>
          </Button>

          {/* User Auth / Profile Dropdown */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-1.5 sm:px-3 sm:py-1.5 text-xs font-medium text-foreground hover:border-primary/40 hover:bg-card/90 transition cursor-pointer">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/15 text-primary font-bold text-xs">
                    {user.fullName ? user.fullName[0] : "ع"}
                  </div>
                  <span className="hidden sm:inline max-w-[100px] truncate">{user.fullName || "حسابي"}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-xl">
                <DropdownMenuLabel className="font-normal p-2">
                  <div className="flex flex-col space-y-1 text-right">
                    <p className="text-sm font-bold text-foreground">{user.fullName}</p>
                    <p className="text-xs text-muted-foreground">{user.phoneNumber}</p>
                    <div className="pt-1 flex flex-wrap gap-1">
                      {isAdmin ? (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">مشرف عام (ADMIN)</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">عضو</Badge>
                      )}
                      {subscription?.hasActiveSubscription ? (
                        <Badge variant="success" className="text-[10px] px-1.5 py-0">اشتراك نشط ({subscription.daysRemaining} يوم)</Badge>
                      ) : (
                        <Badge variant="warning" className="text-[10px] px-1.5 py-0">غير مشترك</Badge>
                      )}
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Admin-only link: STRICT RULE 7 */}
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="flex items-center gap-2 cursor-pointer font-semibold text-primary">
                      <ShieldCheck className="h-4 w-4" />
                      <span>لوحة تحكم الإدارة</span>
                    </Link>
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem onClick={openSubscription} className="flex items-center gap-2 cursor-pointer text-foreground">
                  <Crown className="h-4 w-4 text-primary" />
                  <span>ترقية / تجديد الاشتراك</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" />
                  <span>تسجيل الخروج</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              to="/auth"
              className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 px-3 py-1.5 text-xs font-semibold text-primary transition shadow-sm"
            >
              <User className="h-3.5 w-3.5" />
              <span>دخول</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

