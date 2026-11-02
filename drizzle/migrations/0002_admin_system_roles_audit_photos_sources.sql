-- Roles
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'data_manager', 'content_reviewer', 'support');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin', 'data_manager', 'content_reviewer', 'support')
  )
$$;

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Super admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Audit log (immutable: no UPDATE/DELETE granted to app roles)
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'approved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read audit log" ON public.audit_log
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert audit log" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND actor_id = auth.uid());

-- Price history (old prices are never deleted)
CREATE TABLE public.menu_item_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EGP',
  source TEXT,
  changed_by UUID,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.menu_item_price_history TO authenticated;
GRANT ALL ON public.menu_item_price_history TO service_role;
ALTER TABLE public.menu_item_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read price history" ON public.menu_item_price_history
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert price history" ON public.menu_item_price_history
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- Photo library with license/permission states
CREATE TABLE public.cafe_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cafe_id TEXT NOT NULL REFERENCES public.cafes(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  source TEXT,
  rights_holder TEXT,
  license_type TEXT,
  permission_proof TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review',
  uploaded_by UUID,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ
);
GRANT SELECT ON public.cafe_photos TO anon;
GRANT SELECT, INSERT, UPDATE ON public.cafe_photos TO authenticated;
GRANT ALL ON public.cafe_photos TO service_role;
ALTER TABLE public.cafe_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved photos are public" ON public.cafe_photos
  FOR SELECT TO anon, authenticated USING (status = 'approved');
CREATE POLICY "Staff read all photos" ON public.cafe_photos
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert photos" ON public.cafe_photos
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update photos" ON public.cafe_photos
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Sources registry
CREATE TABLE public.sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT,
  cafe_id TEXT REFERENCES public.cafes(id) ON DELETE SET NULL,
  supports_field TEXT,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT
);
GRANT SELECT, INSERT, UPDATE ON public.sources TO authenticated;
GRANT ALL ON public.sources TO service_role;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read sources" ON public.sources
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert sources" ON public.sources
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update sources" ON public.sources
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Verification center requests (user corrections + staff review queues)
CREATE TABLE public.verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  cafe_id TEXT REFERENCES public.cafes(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  decision_reason TEXT
);
GRANT SELECT, INSERT, UPDATE ON public.verification_requests TO authenticated;
GRANT ALL ON public.verification_requests TO service_role;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own requests" ON public.verification_requests
  FOR SELECT TO authenticated USING (auth.uid() = submitted_by);
CREATE POLICY "Staff read all requests" ON public.verification_requests
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Signed-in users submit requests" ON public.verification_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = submitted_by AND status = 'pending');
CREATE POLICY "Staff decide requests" ON public.verification_requests
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Cafes: archive + area-review provenance columns (additive)
ALTER TABLE public.cafes ADD COLUMN archived_at TIMESTAMPTZ;
ALTER TABLE public.cafes ADD COLUMN area_classified_by UUID;
ALTER TABLE public.cafes ADD COLUMN area_review_reason TEXT;

-- Staff write policies on existing data tables
CREATE POLICY "Staff insert cafes" ON public.cafes
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update cafes" ON public.cafes
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert menu items" ON public.menu_items
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update menu items" ON public.menu_items
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update attributes" ON public.cafe_attributes
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert attributes" ON public.cafe_attributes
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff manage fees" ON public.cafe_fees
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update fees" ON public.cafe_fees
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));