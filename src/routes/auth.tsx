import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — CaféLens" },
      { name: "description", content: "تسجيل دخول المشرفين إلى لوحة إدارة CaféLens" },
      { property: "og:title", content: "تسجيل الدخول — CaféLens" },
      { property: "og:description", content: "تسجيل دخول المشرفين إلى لوحة إدارة CaféLens" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin", replace: true });
    });
  }, [navigate]);

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("تعذر تسجيل الدخول عبر Google. حاول مرة أخرى.");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/admin" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">لوحة إدارة CaféLens</CardTitle>
          <CardDescription>تسجيل الدخول متاح للمشرفين المعتمدين فقط عبر حساب Google</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={signInWithGoogle} disabled={loading} className="w-full" size="lg">
            {loading ? "جارٍ التحويل إلى Google…" : "الدخول بحساب Google"}
          </Button>
          {error && <p className="text-center text-sm text-destructive">{error}</p>}
          <p className="text-center text-xs text-muted-foreground">
            إن لم تكن مشرفًا معتمدًا فلن تتمكن من الوصول إلى اللوحة حتى بعد تسجيل الدخول.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
