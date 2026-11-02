import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyRoles } from "@/lib/admin.functions";
import { isStaffRole, ROLE_LABELS, type AppRole } from "@/lib/admin-shared";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard,
  Store,
  MapPin,
  UtensilsCrossed,
  Image as ImageIcon,
  ShieldCheck,
  ScrollText,
  LogOut,
  Home,
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
  { to: "/admin", label: "الرئيسية", icon: LayoutDashboard, exact: true },
  { to: "/admin/cafes", label: "الكافيهات", icon: Store },
  { to: "/admin/areas", label: "مراجعة المناطق", icon: MapPin },
  { to: "/admin/menu", label: "المنيو والأسعار", icon: UtensilsCrossed },
];

function AdminLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: roles, isLoading, isError } = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => getMyRoles(),
    staleTime: 60_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-64 space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      </div>
    );
  }

  const staffRoles = (roles ?? []).filter(isStaffRole) as AppRole[];
  if (isError || staffRoles.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold text-foreground">غير مصرح بالوصول</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            هذا الحساب لا يملك صلاحيات لوحة الإدارة. تواصل مع المشرف العام لمنحك دورًا.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" onClick={() => navigate({ to: "/" })}>
              العودة للموقع
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                await queryClient.cancelQueries();
                queryClient.clear();
                await supabase.auth.signOut();
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
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-56 shrink-0 flex-col border-l border-border bg-card">
        <div className="border-b border-border p-4">
          <Link to="/admin" className="text-lg font-bold text-foreground">
            CaféLens <span className="text-sm font-normal text-muted-foreground">Admin</span>
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">{staffRoles.map((r) => ROLE_LABELS[r]).join("، ")}</p>
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
                    ? "bg-primary text-primary-foreground"
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
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
