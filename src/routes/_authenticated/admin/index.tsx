import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAdminAnalyticsFn,
  getAdminUsersFn,
  updateUserStatusFn,
  updateUserRoleFn,
  getAdminPaymentsQueueFn,
  reviewPaymentFn,
  adminExtendSubscriptionFn,
  adminGetReceiptImageFn,
} from "@/lib/api-admin.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Users,
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  Search,
  Eye,
  CalendarPlus,
  TrendingUp,
  Sparkles,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "مركز التحكم والعمليات — CaféLens" },
      { name: "description", content: "إدارة المستخدمين والاشتراكات والمدفوعات وبيانات المنصة" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminControlCenter,
});

function AdminControlCenter() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

  // User search & pagination state
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserForExtension, setSelectedUserForExtension] = useState<any>(null);
  const [extensionDays, setExtensionDays] = useState(30);

  // Payment review state
  const [rejectDialogPaymentId, setRejectDialogPaymentId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [viewingReceiptKey, setViewingReceiptKey] = useState<string | null>(null);
  const [receiptImageDataUrl, setReceiptImageDataUrl] = useState<string | null>(null);

  // Queries
  const { data: analytics, isLoading: isAnalyticsLoading } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => getAdminAnalyticsFn(),
    refetchInterval: 30_000,
  });

  const { data: usersData, isLoading: isUsersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ["admin-users", userSearch],
    queryFn: () => getAdminUsersFn({ data: { search: userSearch || undefined } }),
  });

  const { data: paymentsData, isLoading: isPaymentsLoading, refetch: refetchPayments } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: () => getAdminPaymentsQueueFn({ data: { status: "PENDING" } }),
    refetchInterval: 15_000,
  });

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: (vars: { userId: string; status: "ACTIVE" | "SUSPENDED" | "BANNED"; reason?: string }) =>
      updateUserStatusFn({ data: vars }),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
    },
    onError: (err: any) => toast.error(err?.message || "حدث خطأ أثناء تعديل حالة المستخدم"),
  });

  const updateRoleMutation = useMutation({
    mutationFn: (vars: { userId: string; role: "USER" | "ADMIN" }) =>
      updateUserRoleFn({ data: vars }),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: any) => toast.error(err?.message || "حدث خطأ أثناء تعديل رتبة المستخدم"),
  });

  const reviewPaymentMutation = useMutation({
    mutationFn: (vars: { paymentId: string; action: "APPROVE" | "REJECT"; rejectionReason?: string }) =>
      reviewPaymentFn({ data: vars }),
    onSuccess: (res) => {
      toast.success(res.message);
      setRejectDialogPaymentId(null);
      setRejectionReason("");
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: any) => toast.error(err?.message || "تعذر معالجة طلب الدفع"),
  });

  const extendSubMutation = useMutation({
    mutationFn: (vars: { userId: string; additionalDays: number }) =>
      adminExtendSubscriptionFn({ data: vars }),
    onSuccess: (res) => {
      toast.success(res.message);
      setSelectedUserForExtension(null);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
    },
    onError: (err: any) => toast.error(err?.message || "تعذر تمديد الاشتراك"),
  });

  const viewReceiptMutation = useMutation({
    mutationFn: (storageKey: string) => adminGetReceiptImageFn({ data: { storageKey } }),
    onSuccess: (res) => {
      setReceiptImageDataUrl(res.dataUrl);
    },
    onError: () => toast.error("تعذر تحميل صورة الإيصال من السيرفر"),
  });

  const handleOpenReceipt = (storageKey: string) => {
    setViewingReceiptKey(storageKey);
    setReceiptImageDataUrl(null);
    viewReceiptMutation.mutate(storageKey);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">مركز العمليات وإدارة المنصة</h1>
          <p className="text-sm text-muted-foreground">
            لوحة الإشراف المتكاملة للتحكم في المشتركين، مراجعة التحويلات، ومراقبة أداء النظام
          </p>
        </div>
        <div className="flex items-center gap-2">
          {analytics?.pendingPaymentsCount ? (
            <Badge variant="destructive" className="px-3 py-1 text-sm font-semibold animate-pulse">
              {analytics.pendingPaymentsCount} مدفوعات بانتظار الاعتماد
            </Badge>
          ) : (
            <Badge variant="secondary" className="px-3 py-1 text-sm text-primary">
              النظام مستقر ومحدث
            </Badge>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-xl">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> نظرة عامة
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> طابور المدفوعات
            {(analytics?.pendingPaymentsCount ?? 0) > 0 && (
              <span className="mr-1 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] text-destructive-foreground">
                {analytics?.pendingPaymentsCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" /> إدارة المستخدمين
          </TabsTrigger>
        </TabsList>

        {/* 1. OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/60 bg-card/60">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي المستخدمين</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">
                  {isAnalyticsLoading ? <Skeleton className="h-8 w-16" /> : analytics?.totalUsers}
                </div>
                <p className="text-xs text-muted-foreground mt-1">حسابات مسجلة ومفعلة</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/60">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">الاشتراكات النشطة</CardTitle>
                <Sparkles className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">
                  {isAnalyticsLoading ? <Skeleton className="h-8 w-16" /> : analytics?.activeSubscriptionsCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">مشتركون يتمتعون بكافة المزايا</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/60">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">إيصالات بانتظار المراجعة</CardTitle>
                <Clock className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-500">
                  {isAnalyticsLoading ? <Skeleton className="h-8 w-16" /> : analytics?.pendingPaymentsCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">فودافون كاش وإنستاباي</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/60">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي الإيرادات المحصلة</CardTitle>
                <CreditCard className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-500">
                  {isAnalyticsLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    `${analytics?.totalRevenueEgp?.toLocaleString() || 0} ج.م`
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">مدفوعات مؤكدة بنجاح</p>
              </CardContent>
            </Card>
          </div>

          {/* RECENT AUDIT LOG */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-primary" /> سجل الأمان والعمليات الحديثة
              </CardTitle>
              <CardDescription>توثيق حي للعمليات الحساسة وتغييرات الاشتراكات</CardDescription>
            </CardHeader>
            <CardContent>
              {isAnalyticsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (analytics?.recentAuditLogs?.length ?? 0) === 0 ? (
                <p className="text-center py-6 text-sm text-muted-foreground">لا توجد عمليات مسجلة حتى الآن</p>
              ) : (
                <div className="divide-y divide-border/40 overflow-hidden rounded-md border border-border/40">
                  {analytics?.recentAuditLogs?.map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between p-3 text-sm">
                      <div className="space-y-0.5">
                        <span className="font-medium text-foreground">{log.action}</span>
                        <p className="text-xs text-muted-foreground">
                          الهدف: {log.targetUserId || "عام"} | النوع: {log.entityType}
                        </p>
                      </div>
                      <div className="text-left text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString("ar-EG")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. PAYMENTS QUEUE TAB */}
        <TabsContent value="payments" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">طابور مراجعة التحويلات المالية</CardTitle>
                <CardDescription>
                  رقم التحويل المعتمد لاستلام الأموال: <strong className="text-primary font-mono" dir="ltr">01005209667</strong>
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchPayments()}>
                تحديث الطابور
              </Button>
            </CardHeader>
            <CardContent>
              {isPaymentsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : (paymentsData?.payments?.length ?? 0) === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p>لا توجد مدفوعات معلقة بانتظار المراجعة حالياً!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {paymentsData?.payments?.map((payment: any) => (
                    <div
                      key={payment.id}
                      className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-border/70 bg-card/40 p-4 shadow-sm"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-base">
                            {payment.user?.fullName}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground" dir="ltr">
                            ({payment.user?.phoneNumber})
                          </span>
                          <Badge variant="outline" className="font-mono">
                            {payment.paymentMethod === "VODAFONE_CASH" ? "فودافون كاش" : "إنستاباي"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          المبلغ: <strong className="text-foreground">{payment.amount} {payment.currency}</strong>
                          {payment.transactionReference && (
                            <span className="mr-3">
                              رقم المرجع: <strong className="font-mono text-foreground">{payment.transactionReference}</strong>
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          تاريخ الطلب: {new Date(payment.createdAt).toLocaleString("ar-EG")}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {payment.receipt && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenReceipt(payment.receipt.storageKey)}
                            className="flex items-center gap-1.5"
                          >
                            <Eye className="h-4 w-4" /> عرض الإيصال
                          </Button>
                        )}

                        <Button
                          size="sm"
                          disabled={reviewPaymentMutation.isPending}
                          onClick={() =>
                            reviewPaymentMutation.mutate({ paymentId: payment.id, action: "APPROVE" })
                          }
                          className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
                        >
                          <CheckCircle2 className="h-4 w-4" /> اعتماد وتفعيل
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={reviewPaymentMutation.isPending}
                          onClick={() => {
                            setRejectDialogPaymentId(payment.id);
                            setRejectionReason("");
                          }}
                          className="flex items-center gap-1"
                        >
                          <XCircle className="h-4 w-4" /> رفض
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. USERS MANAGEMENT TAB */}
        <TabsContent value="users" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg">إدارة الأعضاء والاشتراكات</CardTitle>
                <CardDescription>عرض تفاصيل الحسابات وتعديل الحالات والصلاحيات</CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث بالاسم أو رقم الهاتف..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pr-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isUsersLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-right text-muted-foreground">
                        <th className="pb-3 pr-2">الاسم</th>
                        <th className="pb-3">رقم الهاتف</th>
                        <th className="pb-3">الرتبة</th>
                        <th className="pb-3">حالة الحساب</th>
                        <th className="pb-3">الاشتراك</th>
                        <th className="pb-3">إجراءات الإشراف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {usersData?.users?.map((u: any) => (
                        <tr key={u.id} className="hover:bg-muted/30">
                          <td className="py-3 pr-2 font-medium text-foreground">{u.fullName}</td>
                          <td className="py-3 font-mono text-xs text-muted-foreground" dir="ltr">
                            {u.phoneNumber}
                          </td>
                          <td className="py-3">
                            <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                              {u.role}
                            </Badge>
                          </td>
                          <td className="py-3">
                            <Badge
                              variant={
                                u.accountStatus === "ACTIVE"
                                  ? "outline"
                                  : u.accountStatus === "BANNED"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {u.accountStatus === "ACTIVE"
                                ? "نشط"
                                : u.accountStatus === "BANNED"
                                ? "محظور"
                                : "معلق"}
                            </Badge>
                          </td>
                          <td className="py-3">
                            {u.hasActiveSubscription ? (
                              <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20">
                                نشط حتى {new Date(u.subscriptionEndDate).toLocaleDateString("ar-EG")}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">غير مشترك</span>
                            )}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-1.5">
                              {/* Status action */}
                              {u.accountStatus === "ACTIVE" ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-xs text-destructive hover:bg-destructive/10"
                                  onClick={() =>
                                    updateStatusMutation.mutate({
                                      userId: u.id,
                                      status: "BANNED",
                                      reason: "حظر بواسطة الإدارة",
                                    })
                                  }
                                >
                                  حظر
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-xs text-emerald-600 hover:bg-emerald-600/10"
                                  onClick={() =>
                                    updateStatusMutation.mutate({ userId: u.id, status: "ACTIVE" })
                                  }
                                >
                                  فك الحظر
                                </Button>
                              )}

                              {/* Extend subscription */}
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs flex items-center gap-1"
                                onClick={() => {
                                  setSelectedUserForExtension(u);
                                  setExtensionDays(30);
                                }}
                              >
                                <CalendarPlus className="h-3.5 w-3.5" /> تمديد
                              </Button>

                              {/* Toggle Role */}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-muted-foreground"
                                onClick={() =>
                                  updateRoleMutation.mutate({
                                    userId: u.id,
                                    role: u.role === "ADMIN" ? "USER" : "ADMIN",
                                  })
                                }
                              >
                                {u.role === "ADMIN" ? "تخفيض لمستخدم" : "ترقية لمشرف"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG: REJECT PAYMENT */}
      <Dialog open={!!rejectDialogPaymentId} onOpenChange={(open) => !open && setRejectDialogPaymentId(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد رفض طلب الدفع</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              يرجى كتابة سبب رفض الدفع ليظهر للمستخدم في إشعارات حسابه (مثلاً: التحويل لم يصل، أو الصورة غير واضحة).
            </p>
            <Textarea
              placeholder="اكتب سبب الرفض هنا..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              variant="destructive"
              disabled={!rejectionReason.trim() || reviewPaymentMutation.isPending}
              onClick={() => {
                if (!rejectDialogPaymentId) return;
                reviewPaymentMutation.mutate({
                  paymentId: rejectDialogPaymentId,
                  action: "REJECT",
                  rejectionReason,
                });
              }}
            >
              {reviewPaymentMutation.isPending ? "جارٍ الرفض..." : "تأكيد الرفض"}
            </Button>
            <Button variant="outline" onClick={() => setRejectDialogPaymentId(null)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: VIEW RECEIPT IMAGE */}
      <Dialog open={!!viewingReceiptKey} onOpenChange={(open) => !open && setViewingReceiptKey(null)}>
        <DialogContent className="max-w-xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>إيصال التحويل المرفق</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-2 min-h-[300px]">
            {viewReceiptMutation.isPending ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">جارٍ قراءة الإيصال من التخزين المشفر...</p>
              </div>
            ) : receiptImageDataUrl ? (
              <img
                src={receiptImageDataUrl}
                alt="إيصال التحويل"
                className="max-h-[70vh] w-auto rounded-lg object-contain border border-border shadow-md"
              />
            ) : (
              <p className="text-sm text-muted-foreground">تعذر عرض الإيصال</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingReceiptKey(null)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: EXTEND SUBSCRIPTION */}
      <Dialog
        open={!!selectedUserForExtension}
        onOpenChange={(open) => !open && setSelectedUserForExtension(null)}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تمديد اشتراك المستخدم يدوياً</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              تحديد عدد الأيام الإضافية لمنحها للمستخدم:{" "}
              <strong className="text-foreground">{selectedUserForExtension?.fullName}</strong>
            </p>
            <div className="flex items-center gap-3">
              {[7, 15, 30, 90].map((days) => (
                <Button
                  key={days}
                  type="button"
                  size="sm"
                  variant={extensionDays === days ? "default" : "outline"}
                  onClick={() => setExtensionDays(days)}
                >
                  {days} يوم
                </Button>
              ))}
            </div>
            <Input
              type="number"
              min={1}
              max={365}
              value={extensionDays}
              onChange={(e) => setExtensionDays(parseInt(e.target.value) || 30)}
              placeholder="عدد الأيام"
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              disabled={extendSubMutation.isPending}
              onClick={() => {
                if (!selectedUserForExtension) return;
                extendSubMutation.mutate({
                  userId: selectedUserForExtension.id,
                  additionalDays: extensionDays,
                });
              }}
            >
              {extendSubMutation.isPending ? "جارٍ التمديد..." : "تأكيد تمديد الاشتراك"}
            </Button>
            <Button variant="outline" onClick={() => setSelectedUserForExtension(null)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
