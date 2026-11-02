CREATE TABLE public.cafes (
  id text PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  area text NOT NULL,
  address text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  rating numeric,
  rating_count integer,
  price_level smallint,
  phone text,
  website text,
  maps_url text,
  hours text[] NOT NULL DEFAULT '{}',
  photos jsonb NOT NULL DEFAULT '[]',
  services text[] NOT NULL DEFAULT '{}',
  category text,
  source text NOT NULL DEFAULT 'Google Maps',
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cafes TO anon, authenticated;
GRANT ALL ON public.cafes TO service_role;
ALTER TABLE public.cafes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cafes are public" ON public.cafes FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX cafes_area_idx ON public.cafes(area);