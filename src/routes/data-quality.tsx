import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Aperture, ArrowRight, BarChart3, ShieldCheck } from "lucide-react";
import { dataQualityQuery } from "@/lib/queries";
import { AREA_CLASS_LABELS } from "@/lib/cafes.functions";

export const Route = createFileRoute("/data-quality")({
  head: () => ({
    meta: [
      { title: "تقرير جودة البيانات | CaféLens" },
      { name: "description", content: "أعداد حقيقية من قاعدة بيانات CaféLens: التغطية، التوثيق، الصور، والمنيوهات." },
      { property: "og:title", content: "تقرير جودة البيانات | CaféLens" },
      { property: "og:description", content: "حالة توثيق بيانات الكافيهات في CaféLens بأرقام فعلية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dataQualityQuery),
  component: DataQualityPage,
});

function DataQualityPage() {
  const { data: q } = useSuspenseQuery(dataQualityQuery);
  const stats = [
    { label: "إجمالي السجلات", value: q.total },
    { label: "سجلات لها صور", value: q.withPhotos },
    { label: "سجلات لها تقييم", value: q.withRating },
    { label: "سجلات لها مواعيد عمل", value: q.withHours },
    { label: "سجلات لها هاتف", value: q.withPhone },
    { label: "سجلات لها مستوى سعر", value: q.withPriceLevel },
    { label: "سجلات لها خصائص موثقة (مزاج)", value: q.withAttributes },
    { label: "أصناف منيو موثقة", value: q.verifiedMenuItems },
  ];
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pt-6">
        <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-4 w-4" /> الرئيسية
        </Link>
        <Link to="/" className="flex items-center gap-2" dir="ltr">
          <Aperture className="h-7 w-7 text-primary" strokeWidth={1.5} />
          <span className="font-latin text-xl font-semibold">CaféLens</span>
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-20 pt-10">
        <h1 className="flex items-center gap-3 font-display text-4xl font-bold md:text-5xl">
          <BarChart3 className="h-9 w-9 text-primary" strokeWidth={1.4} /> تقرير <span className="text-gold">جودة البيانات</span>
        </h1>
        <p className="mt-2 text-muted-foreground">أرقام فعلية من قاعدة البيانات — آخر تحقق: {q.lastVerified ? new Date(q.lastVerified).toLocaleDateString("ar-EG") : "—"}</p>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="glass rounded-2xl p-5">
              <div className="text-gold font-display text-3xl font-bold">{s.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </section>

        <section className="mt-8 glass rounded-2xl p-5">
          <h2 className="font-display text-xl">التوزيع حسب تصنيف المنطقة</h2>
          <ul className="mt-4 space-y-2">
            {Object.entries(q.byClass).sort((a, b) => Number(b[1]) - Number(a[1])).map(([cls, n]) => (
              <li key={cls} className="flex items-center justify-between gap-3 text-sm">
                <span>{AREA_CLASS_LABELS[cls] ?? cls}</span>
                <span className="flex flex-1 items-center gap-3">
                  <span className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.max(2, (Number(n) / q.total) * 100)}%` }} />
                  <span className="text-muted-foreground">{Number(n)}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            التصنيف مبني على نص العنوان فقط (مثل شارع التسعين أو معالم معروفة) — بدون تخمين من الإحداثيات. السجلات غير المؤكدة تبقى «غير محدد الحي» حتى مراجعة بشرية.
          </p>
        </section>

        <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          مصدر بيانات الاكتشاف: Google Maps. المنيوهات والأسعار تُضاف فقط من مصادر رسمية موثقة.
        </p>
      </main>
    </div>
  );
}
