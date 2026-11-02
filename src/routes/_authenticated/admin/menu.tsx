import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminListCafes, adminListMenu, adminUpsertMenuItem, adminPriceHistory } from "@/lib/admin.functions";
import {
  MENU_CATEGORIES,
  PRICE_STATUSES,
  PRICE_STATUS_LABELS,
  type PriceStatus,
} from "@/lib/admin-shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { History, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/menu")({
  head: () => ({
    meta: [
      { title: "المنيو والأسعار — CaféLens" },
      { name: "description", content: "إدارة منيو وأسعار كل فرع مع حفظ تاريخ الأسعار" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MenuAdmin,
});

type MenuItem = {
  id: string;
  cafe_id: string;
  name: string;
  category: string | null;
  size: string | null;
  price: number;
  currency: string;
  price_source: string;
  verification_status: string;
  retrieved_at: string;
  verified_at: string | null;
};

function MenuAdmin() {
  const [search, setSearch] = useState("");
  const [cafeId, setCafeId] = useState("");
  const [editing, setEditing] = useState<MenuItem | "new" | null>(null);
  const [historyFor, setHistoryFor] = useState<MenuItem | null>(null);
  const queryClient = useQueryClient();

  const { data: cafes } = useQuery({
    queryKey: ["admin-cafes", search, "", false],
    queryFn: () => adminListCafes({ data: { search, areaClass: "", archived: false } }),
  });

  const { data: items, isLoading } = useQuery({
    queryKey: ["admin-menu", cafeId],
    queryFn: () => adminListMenu({ data: { cafeId } }),
    enabled: Boolean(cafeId),
  });

  const selectedCafe = (cafes ?? []).find((c: any) => c.id === cafeId) as any;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">المنيو والأسعار</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          كل فرع له منيو مستقل. الأسعار السابقة تُحفظ تلقائيًا ولا تُمسح. لا تُنشر أسعار غير مؤكدة في الموقع العام.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="ابحث عن كافيه…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={cafeId} onValueChange={setCafeId}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="اختر الفرع" />
          </SelectTrigger>
          <SelectContent>
            {(cafes ?? []).slice(0, 50).map((c: any) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} — {c.area}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {cafeId && (
          <Button onClick={() => setEditing("new")}>
            <Plus className="ml-1 h-4 w-4" />
            إضافة صنف
          </Button>
        )}
      </div>

      {!cafeId ? (
        <p className="py-12 text-center text-muted-foreground">اختر فرعًا لعرض منيوه وإدارته</p>
      ) : isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الصنف</TableHead>
                <TableHead>التصنيف</TableHead>
                <TableHead>الحجم</TableHead>
                <TableHead>السعر</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>المصدر</TableHead>
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(items ?? []).map((item: any) => {
                const it = item as unknown as MenuItem;
                return (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium text-foreground">{it.name}</TableCell>
                    <TableCell className="text-muted-foreground">{it.category ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{it.size ?? "—"}</TableCell>
                    <TableCell className="text-foreground">
                      {it.price} {it.currency}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          ["official_current", "owner_confirmed", "admin_verified"].includes(it.verification_status)
                            ? "default"
                            : it.verification_status === "disputed"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {PRICE_STATUS_LABELS[it.verification_status as PriceStatus] ?? it.verification_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-xs text-muted-foreground">{it.price_source}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setEditing(it)}>
                          تعديل
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setHistoryFor(it)}>
                          <History className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(items ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    لا يوجد منيو مسجل لهذا الفرع بعد — أضف أول صنف من مصدر موثوق
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && cafeId && (
        <ItemDialog
          cafeId={cafeId}
          cafeName={selectedCafe?.name ?? ""}
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["admin-menu", cafeId] })}
        />
      )}
      {historyFor && <HistoryDialog item={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}

function ItemDialog({
  cafeId,
  cafeName,
  item,
  onClose,
  onSaved,
}: {
  cafeId: string;
  cafeName: string;
  item: MenuItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState<string>(item?.category ?? "Coffee");
  const [size, setSize] = useState(item?.size ?? "");
  const [price, setPrice] = useState(item ? String(item.price) : "");
  const [priceStatus, setPriceStatus] = useState<string>(item?.verification_status ?? "unverified");
  const [source, setSource] = useState(item?.price_source ?? "");
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      adminUpsertMenuItem({
        data: {
          ...(item?.id ? { id: item.id } : {}),
          cafeId,
          name,
          category,
          size,
          price: Number(price),
          priceStatus,
          source,
          reason: reason || (item ? "تحديث بيانات الصنف" : "إضافة صنف جديد"),
        },
      }),
    onSuccess: () => {
      toast.success(item ? "تم تحديث الصنف — السعر السابق محفوظ في التاريخ" : "تمت إضافة الصنف");
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const valid = name.trim().length > 0 && Number(price) > 0 && source.trim().length >= 3;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {item ? "تعديل صنف" : "إضافة صنف"} — {cafeName}
          </DialogTitle>
          <DialogDescription>
            {item
              ? "عند تغيير السعر يُحفظ السعر القديم تلقائيًا في سجل الأسعار."
              : "أدخل بيانات من مصدر حقيقي فقط — لا تخترع أسعارًا."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label>اسم الصنف *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Latte / لاتيه" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>التصنيف</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MENU_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>الحجم</Label>
              <Input value={size} onChange={(e) => setSize(e.target.value)} placeholder="Medium" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>السعر (جنيه) *</Label>
              <Input type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label>حالة السعر</Label>
              <Select value={priceStatus} onValueChange={setPriceStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRICE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {PRICE_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>مصدر السعر *</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="منيو رسمي / تأكيد المالك / رابط…" />
          </div>
          <div className="space-y-1">
            <Label>سبب التعديل</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !valid}>
            {mutation.isPending ? "جارٍ الحفظ…" : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["price-history", item.id],
    queryFn: () => adminPriceHistory({ data: { menuItemId: item.id } }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تاريخ الأسعار: {item.name}</DialogTitle>
          <DialogDescription>
            السعر الحالي: {item.price} {item.currency}. الأسعار السابقة محفوظة ولا تُحذف.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (data ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">لا توجد أسعار سابقة — هذا هو السعر الأول المسجل</p>
        ) : (
          <div className="space-y-2">
            {(data ?? []).map((h: any) => (
              <div key={h.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                <span className="font-medium text-foreground">
                  {h.price} {h.currency}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(h.created_at).toLocaleString("ar-EG")} · {h.source ?? "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
