import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loginUserFn, registerUserFn } from "@/lib/api-auth.functions";
import { toast } from "sonner";
import {
  Aperture,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "إنشاء حساب جديد — CaféLens" },
      { name: "description", content: "انضم إلى مجتمع كافيلينز واكتشف عالماً مختلفاً واستكشف أرقى الكافيهات" },
    ],
  }),
  component: AuthPage,
});

function GoogleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = useSearch({ strict: false }) as { redirect?: string; mode?: "login" | "register" };

  const [mode, setMode] = useState<"register" | "login">(search.mode === "login" ? "login" : "register");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Registration Mutation
  const registerMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);
      return registerUserFn({
        data: {
          phoneNumber,
          password,
        },
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      toast.success(`تم إنشاء حسابك بنجاح! أهلاً بك في CaféLens`);
      const redirectTo = search.redirect || (res.user.role === "ADMIN" ? "/admin" : "/");
      navigate({ to: redirectTo, replace: true });
    },
    onError: (err: any) => {
      const msg = err?.message || "تعذر إنشاء الحساب. يرجى التأكد من صحة رقم الهاتف وكلمة المرور.";
      setErrorMessage(msg);
      toast.error(msg);
    },
  });

  // Login Mutation
  const loginMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);
      return loginUserFn({
        data: {
          phoneNumber,
          password,
        },
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      toast.success(`مرحباً بك مجدداً في CaféLens`);
      const redirectTo = search.redirect || (res.user.role === "ADMIN" ? "/admin" : "/");
      navigate({ to: redirectTo, replace: true });
    },
    onError: (err: any) => {
      const msg = err?.message || "تعذر تسجيل الدخول. يرجى التحقق من صحة البيانات.";
      setErrorMessage(msg);
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim() || !password.trim()) {
      setErrorMessage("يرجى إدخال رقم الهاتف وكلمة المرور");
      return;
    }
    if (mode === "register") {
      registerMutation.mutate();
    } else {
      loginMutation.mutate();
    }
  };

  const isPending = registerMutation.isPending || loginMutation.isPending;

  return (
    <div
      className="relative min-h-[100svh] w-full overflow-x-hidden text-foreground flex flex-col justify-between selection:bg-[#d4af37]/30"
      dir="rtl"
    >
      {/* Cinematic Sunset Background from Homepage */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <img
          src="/hero-cafe.png"
          alt="CaféLens Waterfront Architecture"
          className="w-full h-full object-cover object-center filter brightness-[0.82] contrast-[1.08] transform scale-[1.02]"
        />
        {/* Subtle Luxury Darkening Vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/45 to-black/85" />
        {/* Subtle Warm Atmospheric Sunset Bloom */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-[#d4af37]/15 via-[#ff9a3c]/10 to-transparent rounded-full blur-[140px] pointer-events-none" />
      </div>

      {/* Top Header */}
      <header className="relative z-20 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7" dir="ltr">
        <div className="flex items-center justify-between">
          {/* Logo Brand on Left */}
          <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group transition-opacity hover:opacity-90">
            <div className="relative flex items-center justify-center">
              <Aperture className="h-8 w-8 sm:h-10 sm:w-10 text-[#d4af37] transition-transform duration-500 group-hover:rotate-45" strokeWidth={1.5} />
            </div>
            <div>
              <div className="font-latin text-2xl sm:text-3xl font-semibold leading-none text-white tracking-wide">
                CaféLens
              </div>
              <div className="mt-0.5 sm:mt-1 text-[7px] sm:text-[8px] tracking-[0.28em] text-[#d4af37]/85 font-mono uppercase">
                DISCOVER BEYOND THE ORDINARY.
              </div>
            </div>
          </Link>

          {/* Mode Switch Pill Button on Right */}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "register" ? "login" : "register");
              setErrorMessage(null);
            }}
            className="flex items-center gap-2 rounded-full px-4 sm:px-5 py-2 sm:py-2.5 bg-black/45 hover:bg-black/65 border border-[#d4af37]/40 hover:border-[#d4af37]/80 backdrop-blur-md transition-all duration-300 text-xs sm:text-sm font-medium text-white shadow-lg active:scale-95 cursor-pointer"
            dir="rtl"
          >
            <span>{mode === "register" ? "تسجيل الدخول" : "إنشاء حساب جديد"}</span>
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#d4af37]" />
          </button>
        </div>
      </header>

      {/* Main Registration Card Area */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-[420px]">
          {/* Glassmorphism Card */}
          <div
            className="relative rounded-[32px] sm:rounded-[36px] p-6 sm:p-9 border border-[#d4af37]/35 shadow-[0_25px_80px_rgba(0,0,0,0.85),0_0_50px_-15px_rgba(212,175,55,0.18),inset_0_1px_1.5px_rgba(255,238,190,0.35)] backdrop-blur-2xl transition-all"
            style={{
              background: "linear-gradient(175deg, rgba(28, 22, 18, 0.76) 0%, rgba(14, 10, 8, 0.86) 100%)",
            }}
          >
            {/* Top Center Aperture Emblem */}
            <div className="text-center">
              <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[#d4af37]/60 bg-gradient-to-b from-[#d4af37]/25 via-[#d4af37]/10 to-transparent text-[#edd391] shadow-[0_0_25px_rgba(212,175,55,0.3)]">
                <Aperture className="h-8 w-8 text-[#edd391]" strokeWidth={1.4} />
                <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none" />
              </div>

              {/* Heading */}
              <h1 className="text-2xl sm:text-[28px] font-bold font-display tracking-tight bg-gradient-to-b from-[#fff2d4] via-[#ecd189] to-[#c79c32] bg-clip-text text-transparent">
                {mode === "register" ? "إنشاء حساب جديد" : "تسجيل الدخول"}
              </h1>

              {/* Subtitle */}
              <p className="mt-1.5 text-xs sm:text-[13px] text-[#cfc2b3] font-normal leading-relaxed">
                {mode === "register"
                  ? "انضم إلى مجتمع كافيلينز واكتشف عالماً مختلفاً"
                  : "أهلاً بك مجدداً في مجتمع كافيلينز للاستمتاع بأرقى الأجواء"}
              </p>

              {/* Decorative Star Divider */}
              <div className="flex items-center justify-center gap-3 my-4 sm:my-5 opacity-75" aria-hidden="true">
                <span className="h-px flex-1 bg-gradient-to-l from-[#d4af37]/50 to-transparent" />
                <span className="text-[#edd391] text-[10px]">✦</span>
                <span className="h-px flex-1 bg-gradient-to-r from-[#d4af37]/50 to-transparent" />
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-4 flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/15 px-3.5 py-2.5 text-xs text-destructive animate-in fade-in duration-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Registration Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
              {/* Field 1: Egyptian Phone Number */}
              <div className="relative flex items-center rounded-full bg-black/45 border border-white/[0.09] hover:border-[#d4af37]/40 focus-within:border-[#d4af37]/80 focus-within:ring-2 focus-within:ring-[#d4af37]/15 focus-within:bg-black/60 transition-all duration-300 h-12 sm:h-[52px] px-4 overflow-hidden">
                <input
                  id="auth-phone"
                  type="tel"
                  placeholder="رقم الهاتف المصري (01xxxxxxxxx)"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  dir="ltr"
                  autoComplete="tel"
                  style={{ colorScheme: "dark" }}
                  className={`w-full h-full bg-transparent text-xs sm:text-sm text-[#f5ebd9] placeholder:text-[#8e8275] placeholder:font-sans outline-none text-right rounded-full [color-scheme:dark] ${
                    phoneNumber ? "font-mono tracking-wider font-medium" : "font-sans"
                  }`}
                  required
                />
                <div className="pr-2.5 text-[#edd391]/80 z-10 shrink-0">
                  <Phone className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={1.5} />
                </div>
              </div>

              {/* Field 2: Password */}
              <div className="relative flex items-center rounded-full bg-black/45 border border-white/[0.09] hover:border-[#d4af37]/40 focus-within:border-[#d4af37]/80 focus-within:ring-2 focus-within:ring-[#d4af37]/15 focus-within:bg-black/60 transition-all duration-300 h-12 sm:h-[52px] px-4 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="pl-1 text-[#8e8275] hover:text-[#edd391] transition cursor-pointer z-10 shrink-0"
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={1.5} />
                  ) : (
                    <Eye className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={1.5} />
                  )}
                </button>

                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="كلمة المرور"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                  autoComplete="new-password"
                  style={{ colorScheme: "dark" }}
                  className={`w-full h-full bg-transparent text-xs sm:text-sm text-[#f5ebd9] placeholder:text-[#8e8275] placeholder:font-sans outline-none text-right rounded-full [color-scheme:dark] ${
                    password ? "font-mono tracking-widest" : "font-sans"
                  }`}
                  required
                />

                <div className="pr-2.5 text-[#edd391]/80 z-10 shrink-0">
                  <Lock className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={1.5} />
                </div>
              </div>

              {/* Primary Luxurious Gold Button */}
              <button
                type="submit"
                disabled={isPending}
                className="relative overflow-hidden w-full h-12 sm:h-[52px] rounded-full font-bold text-xs sm:text-sm tracking-wide text-[#160f06] shadow-[0_12px_28px_-6px_rgba(216,178,72,0.45),inset_0_1px_1px_rgba(255,255,255,0.6)] hover:brightness-105 active:scale-[0.985] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none mt-2"
                style={{
                  background: "linear-gradient(135deg, #f5e4ab 0%, #d8b248 50%, #b88d22 100%)",
                }}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-[#160f06]" />
                    <span>جارٍ معالجة الطلب...</span>
                  </>
                ) : (
                  <>
                    <span>{mode === "register" ? "إنشاء الحساب" : "تسجيل الدخول"}</span>
                    <ArrowLeft className="h-4 w-4 text-[#160f06]" strokeWidth={2.2} />
                  </>
                )}
              </button>
            </form>

            {/* Subtle Divider with "أو" */}
            <div className="flex items-center gap-3 my-4 sm:my-5">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-[#a09485] font-medium px-1">أو</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            {/* Google Registration Button */}
            <button
              type="button"
              onClick={() => {
                toast.info("تسجيل الدخول السريع عبر Google قيد التفعيل في الإصدار القادم");
              }}
              className="w-full h-12 sm:h-[50px] rounded-full bg-black/40 hover:bg-black/60 border border-[#d4af37]/45 hover:border-[#d4af37]/80 backdrop-blur-md transition-all duration-300 flex items-center justify-center gap-2.5 text-xs sm:text-sm font-medium text-[#f0e8dd] active:scale-[0.985] cursor-pointer shadow-sm"
            >
              <GoogleIcon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
              <span>{mode === "register" ? "التسجيل باستخدام Google" : "الدخول باستخدام Google"}</span>
            </button>

            {/* Terms and Privacy Policy Notice */}
            <p className="text-[11px] text-[#9c8e80] text-center mt-5 leading-relaxed">
              بإنشاء حساب، فأنت توافق على{" "}
              <Link to="/" className="text-[#edd391] underline underline-offset-4 hover:text-white transition">
                شروط الاستخدام
              </Link>{" "}
              و
              <Link to="/" className="text-[#edd391] underline underline-offset-4 hover:text-white transition">
                سياسة الخصوصية
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Bottom Footer Tagline */}
      <footer className="relative z-20 w-full text-center pb-5 sm:pb-7">
        <div className="flex items-center justify-center gap-3">
          <span className="h-px w-10 sm:w-16 bg-gradient-to-l from-[#d4af37]/40 to-transparent" />
          <span className="font-latin text-xs sm:text-sm font-medium tracking-[0.18em] text-[#d4af37]/90">
            CaféLens
          </span>
          <span className="h-px w-10 sm:w-16 bg-gradient-to-r from-[#d4af37]/40 to-transparent" />
        </div>
        <p className="font-latin text-[8px] sm:text-[9px] tracking-[0.28em] text-[#d4af37]/60 uppercase mt-1">
          BUILDING A BETTER TOMORROW
        </p>
      </footer>
    </div>
  );
}
