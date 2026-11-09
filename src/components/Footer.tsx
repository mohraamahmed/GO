import React from "react";
import { Link } from "@tanstack/react-router";
import { Aperture, MapPin, ShieldCheck, Phone, Heart, Coffee } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-card/40 backdrop-blur-md pt-12 pb-24 md:pb-12 text-muted-foreground" dir="rtl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/25 text-primary">
                <Aperture className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <span className="font-latin text-2xl font-bold tracking-tight text-foreground">CaféLens</span>
            </Link>
            <p className="text-sm leading-relaxed max-w-md text-muted-foreground">
              المنصة الرائدة والموثقة لاكتشاف كافيهات القاهرة الجديدة والتجمع الخامس والشيخ زايد. اعرف تفاصيل الأجواء، استعرض المنيو الرسمي، واحسب ميزانية خروجتك قبل التحرك.
            </p>
            <div className="flex items-center gap-2 text-xs text-foreground/80 pt-1">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>بيانات موثقة ميدانياً ومحدثة دورياً</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold font-display text-foreground">روابط سريعة</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/" className="hover:text-primary transition">الصفحة الرئيسية</Link>
              </li>
              <li>
                <Link to="/cafes" className="hover:text-primary transition">دليل الكافيهات المعتمدة</Link>
              </li>
              <li>
                <Link to="/data-quality" className="hover:text-primary transition">مؤشر جودة وتغطية البيانات</Link>
              </li>
              <li>
                <Link to="/auth" className="hover:text-primary transition">تسجيل الدخول / إنشاء حساب</Link>
              </li>
            </ul>
          </div>

          {/* Coverage & Payments */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold font-display text-foreground">مناطق التغطية والاشتراك</h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span>التجمع الخامس والقاهرة الجديدة</span>
              </li>
              <li className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span>مدينة الشيخ زايد ومدينة 6 أكتوبر</span>
              </li>
              <li className="flex items-center gap-1.5 pt-2 text-foreground font-semibold">
                <Phone className="h-3.5 w-3.5 text-primary" />
                <span>فودافون كاش وإنستاباي: 01005209667</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom divider & copyright */}
        <div className="border-t border-border/40 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs gap-3">
          <p>© {new Date().getFullYear()} CaféLens — جميع الحقوق محفوظة.</p>
          <p className="flex items-center gap-1">
            <span>صُنع بشغف لرواد القهوة في مصر</span>
            <Coffee className="h-3.5 w-3.5 text-primary" />
          </p>
        </div>
      </div>
    </footer>
  );
}

