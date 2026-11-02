import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminListCafes, adminReclassifyArea } from "@/lib/admin.functions";
import { AREA_CLASS_ADMIN_LABELS, AREA_CLASSES, type AreaClass } from "@/lib/admin-shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/areas")({
  head: () => ({
    meta: [
      { title: "مراجعة المناطق — CaféLens" },
      { name: "description", content: "مراجعة وتصنيف الكافيهات غير محددة الحي" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AreaReview,
});

type AreaRow = {
  id: string;
  name: string;
  area: string;
  area_class: string;
  address: string | null;
  rating: number | null;
  source: string;
};

function AreaReview() {
  const [filter, setFilter] = useState<string>("new_cairo_unclassified");
  const [reviewing, setReviewing] = useState<AreaRow | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-cafes", "", filter, false],
    queryFn: () => adminListCafes({ data: { search: "", areaClass: filter, archived: false } }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">مراجعة المناطق الجغرافية</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            لا تصنيف بالتخمين — كل تغيير يتطلب سببًا ومصدرًا، ويُسجل باسمك وتاريخه.
          </p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AREA_CLASSES.map((c) => (
              <SelectItem key={c} value={c}>
                {AREA_CLASS_ADMIN_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">{(data ?? []).length} سجلًا في هذه القائمة</p>
          {(data ?? []).map((row: any) => {
            const c = row as unknown as AreaRow;
            return (
              <Card key={c.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base text-foreground">{c.name}</CardTitle>
                    <Badge variant="secondary">{AREA_CLASS_ADMIN_LABELS[c.area_class as AreaClass] ?? c.area_class}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    <p>{c.address ?? "بدون عنوان مسجل"}</p>
                    <p className="mt-1 text-xs">
                      المصدر الحالي: {c.source} · التقييم: {c.rating ?? "—"}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => setReviewing(c)}>
                    إعادة تصنيف
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {(data ?? []).length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                لا توجد سجلات في هذه القائمة 🎉
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {reviewing && <ReclassifyDialog cafe={reviewing} onClose={() => setReviewing(null)} onSaved={() => queryClient.invalidateQueries({ queryKey: ["admin-cafes"] })} />}
    </div>
  );
}

function ReclassifyDialog({ cafe, onClose, onSaved }: { cafe: AreaRow; onClose: () => void; onSaved: () => void }) {
  const [areaClass, setAreaClass] = useState<AreaClass>(cafe.area_class as AreaClass);
  const [reason, setReason] = useState("");
  const [source, setSource] = useState("");

  const mutation = useMutation({
    mutationFn: () => adminReclassifyArea({ data: { id: cafe.id, areaClass, reason, source } }),
    onSuccess: () => {
      toast.success("تم تحديث التصنيف وتسجيله");
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const valid = reason.trim().length >= 3 && source.trim().length >= 3 && areaClass !== cafe.area_class;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إعادة تصنيف: {cafe.name}</DialogTitle>
          <DialogDescription>
            العنوان المسجل: {cafe.address ?? "—"}. لا تعتمد على الإحداثيات وحدها لإثبات الانتماء لحي معين.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>التصنيف الجديد</Label>
            <Select value={areaClass} onValueChange={(v) => setAreaClass(v as AreaClass)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AREA_CLASSES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {AREA_CLASS_ADMIN_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>سبب التغيير *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: العنوان المسجل يذكر التجمع الخامس صراحة"
            />
          </div>
          <div className="space-y-1">
            <Label>المصدر *</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="رابط أو اسم المصدر الذي يدعم التصنيف" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !valid}>
            {mutation.isPending ? "جارٍ الحفظ…" : "اعتماد التصنيف"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
