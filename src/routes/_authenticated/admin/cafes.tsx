import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminListCafes, adminUpdateCafe, adminArchiveCafe } from "@/lib/admin.functions";
import { AREA_CLASS_ADMIN_LABELS, type AreaClass } from "@/lib/admin-shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/cafes")({
  head: () => ({
    meta: [
      { title: "إدارة الكافيهات — CaféLens" },
      { name: "description", content: "بحث وتعديل وأرشفة سجلات الكافيهات" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminCafes,
});

type CafeAdminRow = {
  id: string;
  slug: string;
  name: string;
  area: string;
  area_class: string;
  address: string | null;
  rating: number | null;
  rating_count: number | null;
  phone: string | null;
  category: string | null;
  verified_at: string;
  archived_at: string | null;
  photos: unknown;
};

function AdminCafes() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [areaClass, setAreaClass] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<CafeAdminRow | null>(null);
  const [archiving, setArchiving] = useState<CafeAdminRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-cafes", search, areaClass, showArchived],
    queryFn: () => adminListCafes({ data: { search, areaClass, archived: showArchived } }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-cafes"] });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">إدارة الكافيهات</h1>
        <Button variant={showArchived ? "default" : "outline"} onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? "عرض النشطة" : "عرض الأرشيف"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="بحث بالاسم أو العنوان…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={areaClass} onValueChange={(v) => setAreaClass(v === "all" ? "" : v)}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="كل المناطق" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المناطق</SelectItem>
            {Object.entries(AREA_CLASS_ADMIN_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>المنطقة</TableHead>
                <TableHead>التصنيف</TableHead>
                <TableHead>التقييم</TableHead>
                <TableHead>الصور</TableHead>
                <TableHead>آخر تحديث</TableHead>
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((cafe: any) => {
                const c = cafe as unknown as CafeAdminRow;
                const photoCount = Array.isArray(c.photos) ? c.photos.length : 0;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.area}</TableCell>
                    <TableCell>
                      <Badge variant={c.area_class === "new_cairo_unclassified" ? "secondary" : "outline"}>
                        {AREA_CLASS_ADMIN_LABELS[c.area_class as AreaClass] ?? c.area_class}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.rating != null ? `${c.rating} (${c.rating_count ?? 0})` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={photoCount > 0 ? "outline" : "destructive"}>
                        {photoCount > 0 ? `${photoCount} صور` : "بدون صور"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(c.verified_at).toLocaleDateString("ar-EG")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                          تعديل
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setArchiving(c)}>
                          {c.archived_at ? "استعادة" : "أرشفة"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    لا توجد نتائج مطابقة
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && <EditDialog cafe={editing} onClose={() => setEditing(null)} onSaved={refresh} />}
      {archiving && <ArchiveDialog cafe={archiving} onClose={() => setArchiving(null)} onSaved={refresh} />}
    </div>
  );
}

function EditDialog({ cafe, onClose, onSaved }: { cafe: CafeAdminRow; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(cafe.name);
  const [address, setAddress] = useState(cafe.address ?? "");
  const [phone, setPhone] = useState(cafe.phone ?? "");
  const [reason, setReason] = useState("");
  const [source, setSource] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      adminUpdateCafe({
        data: { id: cafe.id, patch: { name, address: address || null, phone: phone || null }, reason, source },
      }),
    onSuccess: () => {
      toast.success("تم حفظ التعديل وتسجيله في سجل العمليات");
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تعديل: {cafe.name}</DialogTitle>
          <DialogDescription>كل تعديل يُسجل مع سببه ومصدره في سجل العمليات.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>الاسم</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>العنوان</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>الهاتف</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
          </div>
          <div className="space-y-1">
            <Label>سبب التعديل *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: تصحيح العنوان بناءً على الموقع الرسمي" />
          </div>
          <div className="space-y-1">
            <Label>المصدر</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="رابط أو اسم المصدر" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || reason.trim().length < 3}>
            {mutation.isPending ? "جارٍ الحفظ…" : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveDialog({ cafe, onClose, onSaved }: { cafe: CafeAdminRow; onClose: () => void; onSaved: () => void }) {
  const [reason, setReason] = useState("");
  const restore = Boolean(cafe.archived_at);
  const mutation = useMutation({
    mutationFn: () => adminArchiveCafe({ data: { id: cafe.id, reason, restore } }),
    onSuccess: () => {
      toast.success(restore ? "تمت الاستعادة" : "تمت الأرشفة — لن يظهر في الموقع العام");
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {restore ? "استعادة" : "أرشفة"}: {cafe.name}
          </DialogTitle>
          <DialogDescription>
            {restore ? "سيظهر الكافيه مجددًا في الموقع العام." : "الأرشفة تخفي السجل من الموقع العام دون حذفه."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label>السبب *</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            variant={restore ? "default" : "destructive"}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || reason.trim().length < 3}
          >
            {mutation.isPending ? "جارٍ التنفيذ…" : restore ? "استعادة" : "أرشفة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
