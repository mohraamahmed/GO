import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSubscriptionInfoFn, submitSubscriptionPaymentFn } from "@/lib/api-subscriptions.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  Sparkles,
  Copy,
  Check,
  UploadCloud,
  CheckCircle2,
  Clock,
  ShieldCheck,
  CreditCard,
  Loader2,
  Smartphone,
} from "lucide-react";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: any;
}

export function SubscriptionModal({ isOpen, onClose, user }: SubscriptionModalProps) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"VODAFONE_CASH" | "INSTAPAY">("VODAFONE_CASH");
  const [transactionRef, setTransactionRef] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: info, isLoading } = useQuery({
    queryKey: ["subscription-info"],
    queryFn: () => getSubscriptionInfoFn(),
    enabled: isOpen,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) {
        throw new Error("يرجى اختيار صورة إيصال التحويل أولاً");
      }

      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      return submitSubscriptionPaymentFn({
        data: {
          paymentMethod,
          transactionReference: transactionRef || undefined,
          receiptFilename: selectedFile.name,
          receiptMimeType: selectedFile.type,
          receiptBase64: base64,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["my-payments"] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.message || "حدث خطأ أثناء إرسال طلب الاشتراك");
    },
  });

  const handleCopy = () => {
    const number = info?.officialPaymentNumber || "01005209667";
    navigator.clipboard.writeText(number);
    setCopied(true);
    toast.success("تم نسخ رقم التحويل بنجاح");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("يرجى اختيار ملف صورة صالح (JPG أو PNG)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة يجب ألا يتجاوز 5 ميجابايت");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const paymentNumber = info?.officialPaymentNumber || "01005209667";
  const planPrice = info?.defaultPlan?.price || 100;
  const currency = info?.defaultPlan?.currency || "EGP";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogTitle className="text-2xl font-bold font-display text-foreground">
            الاشتراك في باقة CaféLens المميزة
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            استمتع بكافة مميزات المنصة وحاسبة الميزانية المتقدمة واستكشاف الكافيهات بدون قيود
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* PLAN CARD */}
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-center">
            <h3 className="font-semibold text-foreground text-lg">الباقة الشهرية الكاملة</h3>
            <div className="mt-1 flex items-baseline justify-center gap-1">
              <span className="text-3xl font-extrabold text-primary">{planPrice}</span>
              <span className="text-sm font-medium text-muted-foreground">{currency} / شهرياً</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">صلاحية لمدة 30 يوماً تبدأ فور اعتماد الإيصال</p>
          </div>

          {/* PAYMENT INSTRUCTIONS */}
          <div className="rounded-xl border border-border/80 bg-card/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">رقم التحويل المعتمد:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-foreground" dir="ltr">
                  {paymentNumber}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-border/50">
              <Label className="text-xs text-muted-foreground">طريقة التحويل المستخدمة:</Label>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(val) => setPaymentMethod(val as any)}
                className="grid grid-cols-2 gap-3"
              >
                <div
                  className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition ${
                    paymentMethod === "VODAFONE_CASH"
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                  onClick={() => setPaymentMethod("VODAFONE_CASH")}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="VODAFONE_CASH" id="voda" />
                    <Label htmlFor="voda" className="cursor-pointer text-xs font-semibold">
                      فودافون كاش
                    </Label>
                  </div>
                  <Smartphone className="h-4 w-4" />
                </div>

                <div
                  className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition ${
                    paymentMethod === "INSTAPAY"
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                  onClick={() => setPaymentMethod("INSTAPAY")}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="INSTAPAY" id="insta" />
                    <Label htmlFor="insta" className="cursor-pointer text-xs font-semibold">
                      إنستاباي InstaPay
                    </Label>
                  </div>
                  <CreditCard className="h-4 w-4" />
                </div>
              </RadioGroup>
            </div>
          </div>

          {/* FORM: REFERENCE & FILE */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ref-no" className="text-xs text-muted-foreground">
                رقم العملية أو المرجع (من رسالة التأكيد):
              </Label>
              <Input
                id="ref-no"
                placeholder="مثال: 9482710385"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                dir="ltr"
                className="text-right"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">صورة إيصال التحويل أو لقطة الشاشة:</Label>
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/80 p-4 transition hover:border-primary/50">
                {previewUrl ? (
                  <div className="relative w-full text-center">
                    <img
                      src={previewUrl}
                      alt="معاينة الإيصال"
                      className="mx-auto max-h-48 rounded-lg object-contain shadow-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 text-xs"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                    >
                      تغيير الصورة
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full cursor-pointer py-3">
                    <UploadCloud className="h-8 w-8 text-muted-foreground/60 mb-2" />
                    <span className="text-xs font-semibold text-foreground">اضغط لرفع صورة الإيصال</span>
                    <span className="text-[11px] text-muted-foreground mt-1">PNG أو JPG حتى 5 ميجابايت</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            className="w-full sm:w-auto font-medium"
            disabled={!selectedFile || submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جارٍ إرسال الإيصال...
              </>
            ) : (
              "إرسال الإيصال لتفعيل الاشتراك"
            )}
          </Button>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
