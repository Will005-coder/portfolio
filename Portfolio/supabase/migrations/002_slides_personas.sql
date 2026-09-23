-- ─── Slides ──────────────────────────────────────────────────────────────────
-- Run in Supabase Dashboard → SQL Editor after 001_portfolio_content.sql

CREATE TABLE IF NOT EXISTS public.slides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',
  image_url   TEXT NOT NULL DEFAULT '',
  image_alt   TEXT NOT NULL DEFAULT '',
  bg_color    TEXT NOT NULL DEFAULT '',
  "order"     INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── Personas ("Viewing As" bar) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.personas (
  id            TEXT PRIMARY KEY,     -- e.g. "companies", "startups"
  label         TEXT NOT NULL,
  tagline       TEXT NOT NULL,
  pitch         TEXT NOT NULL,
  highlight_slug TEXT NOT NULL DEFAULT '',
  "order"       INTEGER NOT NULL DEFAULT 0
);

-- ─── Slideshow settings (timer, etc.) — stored as a row in site_content ──────
-- INSERT happens below after content table exists.

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.slides   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_slides"    ON public.slides   FOR SELECT USING (true);
CREATE POLICY "public_read_personas"  ON public.personas FOR SELECT USING (true);

CREATE POLICY "auth_write_slides"
  ON public.slides FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "auth_write_personas"
  ON public.personas FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── Seed default personas ────────────────────────────────────────────────────
INSERT INTO public.personas (id, label, tagline, pitch, highlight_slug, "order") VALUES
  ('companies',  'Companies',  'Seeking full-time roles in robotics R&D, mechatronics, and hardware engineering.', 'I prototype fast, validate with data, and ship hardware that works. FEA-validated models within 8% of experiment in six weeks.', 'byu-nsr-reu-compliant-mechanisms', 0),
  ('startups',   'Startups',   'Building 0→1 hardware? I bring compliant mechanisms, controls, and DFM under one roof.', '350% bend angle improvement at 4 mm diameter. I build the rig, write the MATLAB, and machine the part — then iterate.', 'bu-bronchoscopy-soft-robot', 1),
  ('grad',       'Grad School','Targeting MS/PhD programs in robotics, compliant mechanisms, and soft actuation.', 'NSF REU: validated kinematic and quasi-static models for cable-driven isoperimetric soft robots — handed off as a research baseline.', 'byu-nsr-reu-compliant-mechanisms', 2),
  ('networking', 'Networking', 'Always down to talk soft robots, compliant mechanisms, and hardware side projects.', 'I build things that move. Let''s swap ideas — compliant mechanisms, VLA grippers, maze solvers, whatever you''re hacking on.', 'self-initiated-builds', 3)
ON CONFLICT (id) DO NOTHING;

-- ─── Seed slideshow settings row into site_content ───────────────────────────
INSERT INTO public.site_content (id, section, data) VALUES
  ('slideshow_settings', 'meta', '{"timer_seconds": 5}')
ON CONFLICT (id) DO NOTHING;

-- ─── Add hero_photo fields to site_content hero row (if it exists) ────────────
-- (Run only after you have created a hero row; safe to run even before then)
UPDATE public.site_content
SET data = data || '{"hero_photo_url": "", "hero_photo_size": "md"}'
WHERE id = 'hero';
