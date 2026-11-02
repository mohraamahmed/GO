import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminDashboard } from "@/lib/admin.functions";
import { AREA_CLASS_ADMIN_LABELS, type AreaClass } from "@/lib/admin-shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "لوحة الإدارة — CaféLens" },
      { name: "description", content: "نظرة عامة على بيانات CaféLens وجودتها" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminHome,
});

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-foreground">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function AdminHome() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-dashboard"], queryFn: () => adminDashboard() });

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  const unclassified = data.byClass["new_cairo_unclassified"] ?? 0;
  const pendingReview = data.byClass["pending_verification"] ?? 0;
  const verifiedPct = data.activeCafes
    ? Math.round(((data.activeCafes - unclassified - pendingReview) / data.activeCafes) * 100)
    : 0;
  const photosPct = data.activeCafes ? Math.round(((data.activeCafes - data.withoutPhotos) / data.activeCafes) * 100) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">نظرة عامة</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="إجمالي الكافيهات" value={data.totalCafes} hint={`${data.archivedCafes} مؤرشف`} />
        <Stat label="تحتاج مراجعة منطقة" value={unclassified + pendingReview} hint={`${unclassified} غير محدد الحي`} />
        <Stat label="بدون صور موثقة" value={data.withoutPhotos} />
        <Stat label="طلبات تحقق معلقة" value={data.pendingRequests} />
        <Stat label="أصناف المنيو المسجلة" value={data.menuItems} />
        <Stat label="تغييرات أسعار محفوظة" value={data.priceChanges} />
        <Stat label="صور في المكتبة" value={data.photos} hint={`${data.byPhotoStatus["pending_review"] ?? 0} قيد المراجعة`} />
        <Stat label="عمليات مسجلة" value={data.auditEntries} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">الكافيهات حسب المنطقة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(data.byClass).map(([cls, count]) => (
              <div key={cls} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground">{AREA_CLASS_ADMIN_LABELS[cls as AreaClass] ?? cls}</span>
                  <span className="text-muted-foreground">{count}</span>
                </div>
                <Progress value={data.activeCafes ? (count / data.activeCafes) * 100 : 0} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">اكتمال البيانات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-foreground">مناطق مصنفة</span>
                <span className="text-muted-foreground">{verifiedPct}%</span>
              </div>
              <Progress value={verifiedPct} />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-foreground">لديها صور</span>
                <span className="text-muted-foreground">{photosPct}%</span>
              </div>
              <Progress value={photosPct} />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-foreground">لديها سمات مفصلة</span>
                <span className="text-muted-foreground">
                  {data.activeCafes ? Math.round((data.withAttributes / data.activeCafes) * 100) : 0}%
                </span>
              </div>
              <Progress value={data.activeCafes ? (data.withAttributes / data.activeCafes) * 100 : 0} />
            </div>
            <div className="pt-2 text-sm text-muted-foreground">
              حالات الأسعار:{" "}
              {Object.entries(data.byPriceStatus)
                .map(([s, n]) => `${s}: ${n}`)
                .join(" — ") || "لا توجد أصناف بعد"}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
