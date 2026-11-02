# ☕ CaféLens (عدسة الكافيهات) — Cairo Café Discovery & Outing Planner

منصة ذكية لاكتشاف وترشيح كافيهات القاهرة الكبرى، وتخطيط الخروجات وفقاً للميزانية، الأجواء، والخدمات المطلوبة بدقة عالية.

---

## ✨ المميزات الرئيسية (Key Features)

- **🔍 محرك ترشيح ذكي (Smart Recommendation Engine):** حساب نسبة التوافق (Match Score) لكل كافية بناءً على الميزانية المحددة للفرد، عدد الأشخاص، المنطقة، الأجواء (Work, Friends, Date, etc.)، والمرافق المتوفرة (WiFi, Outdoor, Outlets, etc.).
- **🧾 حاسبة الفاتورة التفاعلية (Interactive Bill & Outing Planner):**
  - اختيار الأصناف والكميات من قائمة الأسعار المحدثة.
  - احتساب ضريبة القيمة المضافة (14% VAT) ونسبة الخدمة (12% Service Charge) تلقائياً.
  - تقدير تكلفة المواصلات التقديرية حسب المنطقة.
  - كشف حالة الميزانية في الوقت الفعلي (ضمن الميزانية أو تجاوز).
  - مشاركة تفاصيل الخروجة عبر واتساب (WhatsApp Share).
- **📋 قوائم طعام تفاعلية (Interactive Menus):** تصفح المنيو بالأقسام (مشروبات ساخنة، مشروبات باردة، حلويات، مأكولات) مع صور الأصناف والأسعار.
- **📍 خرائط ومعلومات تفصيلية (Maps & Details):** مواعيد العمل، وسائل التواصل، روابط مباشرة لخرائط جوجل، ومؤشرات التحقق والمصداقية.
- **📱 تصميم متجاوب فائق الجمال (Responsive & Ergonomic UI):** دعم كامل للغة العربية (RTL)، مريح للعين، ومتوافق بسلاسة مع شاشات الهواتف والكمبيوتر (Desktop & Mobile).

---

## 🛠 التقنيات المستخدمة (Tech Stack)

- **Framework:** [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Routing:** TanStack Router
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) + Lucide Icons + Radix UI
- **State Management & Data:** Supabase + React Query
- **Animation:** Lucide / Smooth transitions

---

## 🚀 تشغيل المشروع محلياً (Getting Started)

1. **استنساخ المستودع (Clone):**
```bash
git clone https://github.com/mohraamahmed/GO.git
cd GO
```

2. **تثبيت الحزم (Install Dependencies):**
```bash
npm install
```

3. **إعداد متغيرات البيئة (Environment Setup):**
قم بإنشاء ملف `.env` استناداً إلى `.env.example`:
```env
VITE_SUPABASE_PROJECT_ID="your-project-id"
VITE_SUPABASE_PUBLISHABLE_KEY="your-publishable-key"
VITE_SUPABASE_URL="https://your-project.supabase.co"
```

4. **بدء خادم التطوير (Start Dev Server):**
```bash
npm run dev
```
افتح المتصفح على `http://localhost:8080`.

---

## 📄 الترخيص (License)
MIT License.
