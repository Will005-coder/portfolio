-- ─── Portfolio CMS schema ────────────────────────────────────────────────────
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).

-- 1. site_content: one row per content section (hero, each project, contact …)
CREATE TABLE IF NOT EXISTS public.site_content (
  id          TEXT PRIMARY KEY,          -- e.g. "hero", "project__byu-reu"
  section     TEXT NOT NULL,             -- e.g. "hero", "project", "contact"
  data        JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. design_tokens: single row holding all theme CSS variable values
CREATE TABLE IF NOT EXISTS public.design_tokens (
  id          TEXT PRIMARY KEY DEFAULT 'tokens',
  tokens      JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE public.site_content  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_tokens ENABLE ROW LEVEL SECURITY;

-- Public site can read freely (content is not sensitive)
CREATE POLICY "public_read_site_content"
  ON public.site_content FOR SELECT USING (true);

CREATE POLICY "public_read_design_tokens"
  ON public.design_tokens FOR SELECT USING (true);

-- Only authenticated users (the admin) may insert / update / delete
CREATE POLICY "auth_write_site_content"
  ON public.site_content FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "auth_write_design_tokens"
  ON public.design_tokens FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── Seed: default design tokens ─────────────────────────────────────────────
INSERT INTO public.design_tokens (id, tokens) VALUES ('tokens', '{
  "--background": "#FAF6ED",
  "--foreground": "#0D0D0A",
  "--card": "#F3EEE2",
  "--primary": "#B89A6A",
  "--primary-foreground": "#FAF6ED",
  "--muted-foreground": "#5C5848",
  "--border": "rgba(0,0,0,0.10)"
}')
ON CONFLICT (id) DO NOTHING;

-- ─── MFA setup note ──────────────────────────────────────────────────────────
-- To require TOTP MFA for the admin account:
--   1. Go to Supabase Dashboard → Authentication → Sign-In Methods
--   2. Enable "Multi-factor Authentication (TOTP)"
--   3. Create the admin user (Authentication → Users → Invite user)
--   4. On first editor login the UI will prompt MFA enrollment (scan QR with
--      Google Authenticator / Authy / 1Password). After enrolment, every
--      subsequent login requires both password + 6-digit TOTP code.
