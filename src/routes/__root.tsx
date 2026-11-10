import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { type ReactNode } from "react";
import { GlobalUIProvider } from "@/context/GlobalUIContext";
import { Header } from "@/components/Header";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { Footer } from "@/components/Footer";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
      <div className="max-w-md text-center p-8 rounded-3xl border border-border/60 bg-card/60 backdrop-blur-md">
        <h1 className="text-7xl font-bold font-display text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          الصفحة التي تحاول الوصول إليها قد تم نقلها أو أنها غير متوفرة حالياً.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 shadow-sm"
          >
            العودة للرئيسية
          </Link>
          <Link
            to="/cafes"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-accent"
          >
            دليل الكافيهات
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error("[TanStack Router Error]:", error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
      <div className="max-w-md text-center p-8 rounded-3xl border border-destructive/30 bg-card/80 backdrop-blur-md">
        <h1 className="text-xl font-bold text-foreground">
          تعذر تحميل هذه الصفحة
        </h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {error instanceof Error ? error.message : "حدث خطأ غير متوقع أثناء معالجة الطلب."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 shadow-sm cursor-pointer"
          >
            إعادة المحاولة
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-accent"
          >
            الرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CaféLens — اكتشف كافيهك المثالي في القاهرة" },
      { name: "description", content: "اكتشف كافيهك المثالي في القاهرة — اختر المنطقة وميزانيتك واكتشف أفضل الكافيهات." },
      { name: "author", content: "CaféLens" },
      { name: "theme-color", content: "#1a0f0a" },
      { property: "og:title", content: "CaféLens — اكتشف كافيهك المثالي في القاهرة" },
      { property: "og:description", content: "اختر مزاجك واحسب تكلفة خروجتك واكتشف أفضل الكافيهات في القاهرة." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://cafe-lens1.vercel.app/" },
      { property: "og:image", content: "https://cafe-lens1.vercel.app/og-image.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "CaféLens — اكتشف كافيهك المثالي في القاهرة" },
      { property: "og:locale", content: "ar_EG" },
      { property: "og:site_name", content: "CaféLens" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "CaféLens — اكتشف كافيهك المثالي في القاهرة" },
      { name: "twitter:description", content: "اكتشف أفضل الكافيهات في القاهرة مع حاسبة الميزانية الذكية." },
      { name: "twitter:image", content: "https://cafe-lens1.vercel.app/og-image.jpg" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://lh3.googleusercontent.com", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://lh3.googleusercontent.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://fonts.gstatic.com" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon", sizes: "32x32" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className="overflow-x-hidden">
      <head>
        <HeadContent />
      </head>
      <body className="overflow-x-hidden w-full max-w-full">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdminRoute = pathname.startsWith("/admin");

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalUIProvider>
        {isAdminRoute ? (
          <>
            <Outlet />
            <Toaster position="top-center" dir="rtl" />
          </>
        ) : (
          <div className="flex flex-col min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
            <Header />
            <main className="flex-1 pb-16 md:pb-0">
              <Outlet />
            </main>
            <Footer />
            <MobileBottomNav />
            <Toaster position="top-center" dir="rtl" />
          </div>
        )}
      </GlobalUIProvider>
    </QueryClientProvider>
  );
}
