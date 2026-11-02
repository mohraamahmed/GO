
-- 1) Area classification on cafes (6 classes, evidence-based, admin-editable)
ALTER TABLE public.cafes
  ADD COLUMN area_class TEXT,
  ADD COLUMN area_class_source TEXT,
  ADD COLUMN area_classified_at TIMESTAMPTZ;

-- Backfill from address-text evidence only (no coordinate guessing)
UPDATE public.cafes SET
  area_class = 'sheikh_zayed',
  area_class_source = 'search_region',
  area_classified_at = now()
WHERE area = 'الشيخ زايد';

UPDATE public.cafes SET
  area_class = 'fifth_settlement',
  area_class_source = 'search_region',
  area_classified_at = now()
WHERE area = 'التجمع الخامس';

UPDATE public.cafes SET
  area_class = 'fifth_settlement',
  area_class_source = 'address_text',
  area_classified_at = now()
WHERE area = 'القاهرة الجديدة' AND (
  address ILIKE '%teseen%' OR address ILIKE '%التسعين%'
  OR address ILIKE '%fifth settlement%' OR address ILIKE '%5th settlement%' OR address ILIKE '%التجمع الخامس%'
  OR address ILIKE '%waterway%' OR address ILIKE '%festival city%' OR address ILIKE '%downtown katameya%'
  OR address ILIKE '%concord plaza%' OR address ILIKE '%point 90%' OR address ILIKE '%arabella%'
  OR address ILIKE '%cairo festival%' OR address ILIKE '%the spot%'
);

UPDATE public.cafes SET
  area_class = 'new_cairo_other',
  area_class_source = 'address_text',
  area_classified_at = now()
WHERE area = 'القاهرة الجديدة' AND area_class IS NULL AND (
  address ILIKE '%rehab%' OR address ILIKE '%الرحاب%'
  OR address ILIKE '%madinaty%' OR address ILIKE '%مدينتي%'
  OR address ILIKE '%first settlement%' OR address ILIKE '%التجمع الأول%'
  OR address ILIKE '%al shorouk%' OR address ILIKE '%الشروق%'
);

UPDATE public.cafes SET
  area_class = 'new_cairo_unclassified',
  area_class_source = 'insufficient_evidence',
  area_classified_at = now()
WHERE area = 'القاهرة الجديدة' AND area_class IS NULL;

ALTER TABLE public.cafes
  ADD CONSTRAINT cafes_area_class_check CHECK (area_class IN (
    'fifth_settlement','new_cairo_other','new_cairo_unclassified','sheikh_zayed','outside_coverage','pending_verification'
  )),
  ALTER COLUMN area_class SET NOT NULL;

-- 2) Structured café attributes with verification states (all UNKNOWN until sourced)
CREATE TABLE public.cafe_attributes (
  cafe_id TEXT PRIMARY KEY REFERENCES public.cafes(id) ON DELETE CASCADE,
  noise_level SMALLINT,
  noise_level_status TEXT NOT NULL DEFAULT 'unknown',
  seating_comfort SMALLINT,
  seating_comfort_status TEXT NOT NULL DEFAULT 'unknown',
  group_seating BOOLEAN,
  group_seating_status TEXT NOT NULL DEFAULT 'unknown',
  couple_friendly BOOLEAN,
  couple_friendly_status TEXT NOT NULL DEFAULT 'unknown',
  outdoor_seating BOOLEAN,
  outdoor_seating_status TEXT NOT NULL DEFAULT 'unknown',
  workspace_suitability SMALLINT,
  workspace_suitability_status TEXT NOT NULL DEFAULT 'unknown',
  wifi_available BOOLEAN,
  wifi_available_status TEXT NOT NULL DEFAULT 'unknown',
  measured_wifi_speed NUMERIC,
  measured_wifi_speed_status TEXT NOT NULL DEFAULT 'unknown',
  power_outlets BOOLEAN,
  power_outlets_status TEXT NOT NULL DEFAULT 'unknown',
  laptop_friendly BOOLEAN,
  laptop_friendly_status TEXT NOT NULL DEFAULT 'unknown',
  atmosphere_tags TEXT[] NOT NULL DEFAULT '{}',
  atmosphere_tags_status TEXT NOT NULL DEFAULT 'unknown',
  visit_reports JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cafe_attributes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cafe_attributes TO authenticated;
GRANT ALL ON public.cafe_attributes TO service_role;
ALTER TABLE public.cafe_attributes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attributes are publicly readable" ON public.cafe_attributes FOR SELECT TO anon, authenticated USING (true);

-- 3) Per-branch menu items (sourced + verified only; no invented prices)
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id TEXT NOT NULL REFERENCES public.cafes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  size TEXT,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EGP',
  price_source TEXT NOT NULL,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  source_license TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.menu_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Verified menus are publicly readable" ON public.menu_items FOR SELECT TO anon, authenticated USING (verification_status = 'verified');

-- 4) Per-branch fees (service charge / VAT) — NULL means unknown, shown as such in the bill
CREATE TABLE public.cafe_fees (
  cafe_id TEXT PRIMARY KEY REFERENCES public.cafes(id) ON DELETE CASCADE,
  service_charge_pct NUMERIC,
  vat_pct NUMERIC,
  source TEXT,
  verified_at TIMESTAMPTZ
);
GRANT SELECT ON public.cafe_fees TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cafe_fees TO authenticated;
GRANT ALL ON public.cafe_fees TO service_role;
ALTER TABLE public.cafe_fees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fees are publicly readable" ON public.cafe_fees FOR SELECT TO anon, authenticated USING (true);
