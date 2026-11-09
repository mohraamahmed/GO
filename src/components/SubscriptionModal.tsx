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
  MessageCircle,
  Calendar,
} from "lucide-react";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: any;
}

export function SubscriptionModal({ isOpen, onClose, user }: SubscriptionModalProps) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"VODAFONE_CASH" | "INSTAPAY">("VODAFONE_CASH");
  const [transactionRef, setTransactionRef] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: info, isLoading } = useQuery({
    queryKey: ["subscription-info"],
    queryFn: () => getSubscriptionInfoFn(),
    enabled: isOpen,
  });

  const plans = info?.plans && info.plans.length > 0 ? info.plans : [
    { id: "1m", name: "اشتراك شهر", price: 100, durationDays: 30, description: "باقة 30 يوماً متكاملة" },
    { id: "2m", name: "اشتراك شهرين", price: 200, durationDays: 60, description: "باقة 60 يوماً لرواد الكافيهات" },
    { id: "3m", name: "اشتراك 3 شهور", price: 280, durationDays: 90, description: "باقة 90 يوماً بتوفير إضافي" },
    { id: "1y", name: "اشتراك سنوي (VIP)", price: 1000, durationDays: 365, description: "باقة العام الكامل (توفير 200 ج.م)" },
  ];

  const currentPlan = (plans.find((p) => p.id === selectedPlanId) || plans[0])!;

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
          planId: currentPlan.id.length > 5 ? currentPlan.id : undefined,
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

      // Open WhatsApp automatically with user and payment details
      const adminWhatsApp = "201005209667";
      const userName = user?.fullName || "عضو كافيلينز";
      const userPhone = user?.phoneNumber || "غير محدد";
      const planName = currentPlan.name;
      const amount = currentPlan.price;
      const ref = transactionRef ? `\nرقم العملية/المرجع: ${transactionRef}` : "";

      const msg = encodeURIComponent(
        `مرحباً كافيلينز، قمت بتحويل مبلغ الاشتراك لتفعيل الحساب ☕✨\n\n` +
        `👤 الاسم: ${userName}\n` +
        `📱 الهاتف: ${userPhone}\n` +
        `📦 الباقة: ${planName} (${amount} ج.م)\n` +
        `💳 طريقة الدفع: ${paymentMethod === "VODAFONE_CASH" ? "فودافون كاش" : "إنستاباي"}${ref}\n\n` +
        `مرفق صورة إيصال التحويل على الموقع، برجاء تفعيل الاشتراك.`
      );

      window.open(`https://wa.me/${adminWhatsApp}?text=${msg}`, "_blank");
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
    toast.success("تم نسخ رقم فودافون كاش بنجاح");
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogTitle className="text-2xl font-bold font-display text-foreground">
            باقات الاشتراك في CaféLens
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            اختر باقتك المفضلة، حوّل المبلغ إلى فودافون كاش، وسيتم فتح الخدمة والتواصل معك فوراً
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* PLANS SELECTION */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">اختر الباقة المناسبة لك:</Label>
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              {plans.map((p) => {
                const isSelected = (selectedPlanId ? p.id === selectedPlanId : p === plans[0]);
                const isYearly = p.durationDays >= 365;

                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPlanId(p.id)}
                    className={`relative flex flex-col justify-between rounded-xl border p-3 cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40 font-bold"
                        : "border-border/70 bg-card/40 hover:border-primary/40 hover:bg-card/70"
                    }`}
                  >
                    {isYearly && (
                      <span className="absolute -top-2 left-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-2 py-0.5 text-[9px] font-bold text-black shadow">
                        الأوفر والأفضل
                      </span>
                    )}
                    <div>
                      <h4 className="text-xs sm:text-sm text-foreground">{p.name}</h4>
                      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                        {p.durationDays} يوم
                      </p>
                    </div>
                    <div className="mt-2 text-left" dir="ltr">
                      <span className="text-base sm:text-lg font-extrabold text-primary">{p.price}</span>
                      <span className="text-[10px] text-muted-foreground ml-1">ج.م</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PAYMENT INSTRUCTIONS */}
          <div className="rounded-xl border border-border/80 bg-card/60 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">رقم التحويل (فودافون كاش):</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm sm:text-base font-bold text-foreground tracking-wider" dir="ltr">
                  {paymentNumber}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
              <span className="text-muted-foreground">المبلغ المطلوب تحويله:</span>
              <span className="font-bold text-primary text-sm">{currentPlan.price} ج.م</span>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-border/50">
              <Label className="text-xs text-muted-foreground">طريقة التحويل المستخدمة:</Label>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(val) => setPaymentMethod(val as any)}
                className="grid grid-cols-2 gap-2"
              >
                <div
                  className={`flex items-center justify-between rounded-lg border p-2.5 cursor-pointer transition ${
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
                  <Smartphone className="h-4 w-4 text-primary" />
                </div>

                <div
                  className={`flex items-center justify-between rounded-lg border p-2.5 cursor-pointer transition ${
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
                  <CreditCard className="h-4 w-4 text-primary" />
                </div>
              </RadioGroup>
            </div>
          </div>

          {/* FORM: REFERENCE & FILE */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="ref-no" className="text-xs text-muted-foreground">
                رقم العملية أو المرجع (اختياري من رسالة فودافون كاش):
              </Label>
              <Input
                id="ref-no"
                placeholder="مثال: 9482710385"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                dir="ltr"
                className="text-right text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">صورة إيصال التحويل (سكرين شوت من الهاتف):</Label>
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/80 p-3 transition hover:border-primary/50">
                {previewUrl ? (
                  <div className="relative w-full text-center">
                    <img
                      src={previewUrl}
                      alt="معاينة الإيصال"
                      className="mx-auto max-h-40 rounded-lg object-contain shadow-sm"
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
                  <label className="flex flex-col items-center justify-center w-full cursor-pointer py-2">
                    <UploadCloud className="h-7 w-7 text-primary/70 mb-1.5" />
                    <span className="text-xs font-semibold text-foreground">اضغط هنا لرفع صورة الإيصال</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">PNG أو JPG (حتى 5 ميجابايت)</span>
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

        <DialogFooter className="gap-2 sm:justify-start pt-1">
          <Button
            className="w-full sm:w-auto font-semibold flex items-center justify-center gap-2"
            disabled={!selectedFile || submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جارٍ تأكيد الاشتراك...
              </>
            ) : (
              <>
                <MessageCircle className="h-4 w-4" />
                تأكيد الاشتراك والدفع وفتح واتساب
              </>
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
