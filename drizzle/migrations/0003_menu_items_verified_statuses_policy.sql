-- Public menu reads accept the detailed verified-equivalent price statuses
DROP POLICY "Verified menus are publicly readable" ON public.menu_items;
CREATE POLICY "Verified menus are publicly readable" ON public.menu_items
  FOR SELECT TO anon, authenticated
  USING (verification_status IN ('verified', 'official_current', 'owner_confirmed', 'admin_verified'));