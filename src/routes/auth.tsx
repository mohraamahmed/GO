import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loginUserFn, registerUserFn } from "@/lib/api-auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ShieldCheck, Phone, Lock, User, Mail, Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول وحساب جديد — CaféLens" },
      { name: "description", content: "سجل دخولك أو أنشئ حسابك في منصة CaféLens لإدارة الاشتراكات واستكشاف الكافيهات" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = useSearch({ strict: false }) as { redirect?: string };

  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Login form state
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form state
  const [registerName, setRegisterName] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");

  // Mutations
  const loginMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);
      return loginUserFn({
        data: {
          phoneNumber: loginPhone,
          password: loginPassword,
        },
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      toast.success(`مرحباً بك مجدداً، ${res.user.fullName}`);
      const redirectTo = search.redirect || (res.user.role === "ADMIN" ? "/admin" : "/");
      navigate({ to: redirectTo, replace: true });
    },
    onError: (err: any) => {
      const msg = err?.message || "تعذر تسجيل الدخول. يرجى التحقق من صحة البيانات.";
      setErrorMessage(msg);
      toast.error(msg);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);
      return registerUserFn({
        data: {
          fullName: registerName,
          phoneNumber: registerPhone,
          password: registerPassword,
          passwordConfirm: registerPasswordConfirm,
          email: registerEmail || undefined,
        },
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      toast.success(`تم إنشاء حسابك بنجاح! أهلاً بك يا ${res.user.fullName}`);
      const redirectTo = search.redirect || (res.user.role === "ADMIN" ? "/admin" : "/");
      navigate({ to: redirectTo, replace: true });
    },
    onError: (err: any) => {
      const msg = err?.message || "تعذر إنشاء الحساب. يرجى مراجعة البيانات المدخلة.";
      setErrorMessage(msg);
      toast.error(msg);
    },
  });

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPhone.trim() || !loginPassword.trim()) {
      setErrorMessage("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    loginMutation.mutate();
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerName.trim() || !registerPhone.trim() || !registerPassword.trim()) {
      setErrorMessage("يرجى ملء الاسم ورقم الهاتف وكلمة المرور");
      return;
    }
    if (registerPassword !== registerPasswordConfirm) {
      setErrorMessage("كلمتا المرور غير متطابقتين");
      return;
    }
    registerMutation.mutate();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12" dir="rtl">
      <Card className="w-full max-w-md border-border/60 bg-card/90 shadow-2xl backdrop-blur-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold font-display text-foreground">
            بوابة CaféLens
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            تسجيل الدخول وإدارة العضوية والاشتراكات
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v as "login" | "register");
              setErrorMessage(null);
            }}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">تسجيل الدخول</TabsTrigger>
              <TabsTrigger value="register">حساب جديد</TabsTrigger>
            </TabsList>

            {errorMessage && (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-center text-sm text-destructive">
                {errorMessage}
              </div>
            )}

            {/* LOGIN TAB */}
            <TabsContent value="login">
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-phone" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" /> رقم الهاتف المصري
                  </Label>
                  <Input
                    id="login-phone"
                    type="tel"
                    placeholder="01xxxxxxxxx"
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    dir="ltr"
                    className="text-right"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">يدعم فودافون، أورنج، اتصالات، أو وي</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-pass" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" /> كلمة المرور
                  </Label>
                  <Input
                    id="login-pass"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    dir="ltr"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="w-full mt-2 font-medium"
                  size="lg"
                >
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جارٍ تسجيل الدخول...
                    </>
                  ) : (
                    "دخول إلى الحساب"
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* REGISTER TAB */}
            <TabsContent value="register">
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-name" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="h-3.5 w-3.5" /> الاسم بالكامل
                  </Label>
                  <Input
                    id="reg-name"
                    type="text"
                    placeholder="أحمد محمد"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-phone" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" /> رقم الهاتف المصري
                  </Label>
                  <Input
                    id="reg-phone"
                    type="tel"
                    placeholder="01xxxxxxxxx"
                    value={registerPhone}
                    onChange={(e) => setRegisterPhone(e.target.value)}
                    dir="ltr"
                    className="text-right"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-email" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" /> البريد الإلكتروني (اختياري)
                  </Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="name@example.com"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-pass" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" /> كلمة المرور (8 أحرف على الأقل)
                  </Label>
                  <Input
                    id="reg-pass"
                    type="password"
                    placeholder="••••••••"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    dir="ltr"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reg-pass-conf" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" /> تأكيد كلمة المرور
                  </Label>
                  <Input
                    id="reg-pass-conf"
                    type="password"
                    placeholder="••••••••"
                    value={registerPasswordConfirm}
                    onChange={(e) => setRegisterPasswordConfirm(e.target.value)}
                    dir="ltr"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={registerMutation.isPending}
                  className="w-full mt-2 font-medium"
                  size="lg"
                >
                  {registerMutation.isPending ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جارٍ إنشاء الحساب...
                    </>
                  ) : (
                    "إنشاء حساب جديد"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 border-t border-border/40 pt-4 text-center">
            <p className="text-xs text-muted-foreground">
              جميع العمليات والبيانات محمية بأنظمة التشفير الفيدرالي وأمان الجلسات المتقدم.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
