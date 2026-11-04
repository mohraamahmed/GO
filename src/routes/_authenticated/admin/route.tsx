import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentUserFn, logoutUserFn } from "@/lib/api-auth.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard,
  Store,
  MapPin,
  UtensilsCrossed,
  ShieldCheck,
  LogOut,
  Home,
  Users,
  CreditCard,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { to: "/admin", label: "الرئيسية والتحليلات", icon: LayoutDashboard, exact: true },
  { to: "/admin/cafes", label: "الكافيهات", icon: Store },
  { to: "/admin/areas", label: "مراجعة المناطق", icon: MapPin },
  { to: "/admin/menu", label: "المنيو والأسعار", icon: UtensilsCrossed },
];

function AdminLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["current-user"],
    queryFn: () => getCurrentUserFn(),
    staleTime: 60_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" dir="rtl">
        <div className="w-64 space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      </div>
    );
  }

  const user = data?.user;
  const isAdmin = user && user.role === "ADMIN";

  if (isError || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
        <div className="max-w-md text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="mt-4 text-xl font-semibold text-foreground">غير مصرح بالوصول</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            هذا الحساب لا يملك صلاحيات المشرف العام (ADMIN). تواصل مع الإدارة إذا كنت تعتقد أن هذا خطأ.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" onClick={() => navigate({ to: "/" })}>
              العودة للموقع
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await logoutUserFn();
                queryClient.clear();
                navigate({ to: "/auth", replace: true });
              }}
            >
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </div>
    );
  }

  async function handleSignOut() {
    await logoutUserFn();
    queryClient.clear();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background" dir="rtl">
      <aside className="flex w-60 shrink-0 flex-col border-l border-border bg-card">
        <div className="border-b border-border p-4">
          <Link to="/admin" className="text-lg font-bold text-foreground">
            CaféLens <span className="text-sm font-normal text-primary">SuperAdmin</span>
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            {user.fullName} ({user.phoneNumber})
          </p>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to as any}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-border p-2">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Home className="h-4 w-4" />
            الموقع العام
          </Link>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
