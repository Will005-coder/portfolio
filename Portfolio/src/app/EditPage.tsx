/**
 * Hidden content editor, route: /edit-w9k3x7m
 *
 * INTENTIONALLY unlinked from the site nav and sitemap.
 * Security comes from Supabase Auth (email/password) + TOTP MFA, NOT from
 * route obscurity alone. The obscure slug is a minor additional barrier.
 *
 * Auth flow:
 *   1. Email + password  →  Supabase signInWithPassword
 *   2. If MFA is enrolled: TOTP challenge  →  verifyTOTP
 *   3. If MFA not yet enrolled: show QR enrollment flow
 *   4. Once session established: render editor
 */

import { useState, useEffect } from "react";
import { toast, Toaster } from "sonner";
import { supabase } from "../lib/supabase";
import type { Factor } from "@supabase/supabase-js";
import {
  Eye, EyeOff, Save, LogOut, Palette, FileText, Monitor, QrCode,
  ShieldCheck, Users, FolderKanban, Plus, Trash2, ChevronDown, Image,
  Columns, Download, Smartphone,
} from "lucide-react";
import { PORTFOLIO } from "./content";
import { SHARDS } from "../data/shards";

const FONT_MONO = "'IBM Plex Mono', 'Courier New', monospace";
const FONT_SANS = "'Inter', system-ui, sans-serif";

// Convert Google Drive sharing links to direct embeddable image URLs.
// Drive sharing links open a webpage, not a raw image, <img> can't render them.
function normalizeDriveUrl(url: string): string {
  // Matches: drive.google.com/file/d/FILE_ID/... and drive.google.com/open?id=FILE_ID
  const fileId =
    url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/)?.[1] ??
    url.match(/[?&]id=([^&]+)/)?.[1];
  if (fileId && url.includes("drive.google.com")) {
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }
  return url;
}

// ─── Default design token values ─────────────────────────────────────────────
// 11 semantic palette tokens + font/type/star tokens.
// No colour literal appears anywhere outside this block and theme.css.

const DARK_BROWN_TEAL: Record<string, string> = {
  "--field":           "#241E19",
  "--field-raised":    "#2E2720",
  "--surface":         "#EAE5DC",
  "--ink":             "#F2EDE4",
  "--ink-muted":       "#A8A49E",
  "--ink-on-surface":  "#1E1915",
  "--accent":          "#5FD3C4",
  "--accent-surface":  "#2AA396",
  "--accent-fill":     "#3CBDB0",
  "--on-accent":       "#0C1F1E",
  "--edge":            "#38322B",
};

const DEFAULT_TOKENS: Record<string, string> = {
  ...DARK_BROWN_TEAL,
  // Font tokens
  "--font-display":        '"Instrument Serif", Georgia, "Times New Roman", serif',
  "--font-body":           '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
  "--font-data":           '"IBM Plex Mono", "SFMono-Regular", "Courier New", monospace',
  "--type-scale":          "1",
  // Star field controls. Read by ConstellationBackground on the live site.
  "--star-count":          "230",
  "--star-size-min":       "0.6",
  "--star-size-max":       "13",
  "--star-ray-density":    "0.13",
  "--star-ray-length":     "1",
  "--star-refraction":     "0.5",
  "--star-color":          "#F2EDE4",
  "--star-opacity":        "1",
};

// ─── Contrast calculator (WCAG 2.1 relative luminance) ───────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace("#", "");
  if (h.length !== 6) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function relativeLuminance(r: number, g: number, b: number): number {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrastRatio(hex1: string, hex2: string): number | null {
  const a = hexToRgb(hex1);
  const b = hexToRgb(hex2);
  if (!a || !b) return null;
  const l1 = relativeLuminance(...a);
  const l2 = relativeLuminance(...b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function ContrastBadge({ fg, bg, min, target }: { fg: string; bg: string; min: number; target?: number }) {
  const ratio = contrastRatio(fg, bg);
  if (ratio === null) return null;
  const pass = ratio >= min;
  const label = ratio.toFixed(1) + ":1";
  return (
    <span
      className="ml-auto text-[10px] px-1.5 py-0.5 rounded"
      style={{
        fontFamily: FONT_MONO,
        background: pass ? "rgba(169,188,163,0.15)" : "rgba(196,74,60,0.2)",
        color: pass ? "#5FD3C4" : "#C4615A",
      }}
      title={`Ratio ${label} · min ${min}:1${target ? ` · target ${target}:1` : ""}`}
    >
      {label} {pass ? "✓" : "✕"}
    </span>
  );
}

// ─── Font option catalogues (label + full CSS stack) ──────────────────────────
// Display = headings, Body = reading, Data = numbers/metadata/mono. Three max.
const DISPLAY_FONTS: { label: string; stack: string }[] = [
  { label: "Instrument Serif",     stack: '"Instrument Serif", Georgia, serif' },
  { label: "Archivo",              stack: '"Archivo", system-ui, sans-serif' },
  { label: "Bricolage Grotesque",  stack: '"Bricolage Grotesque", system-ui, sans-serif' },
  { label: "Big Shoulders Display",stack: '"Big Shoulders Display", system-ui, sans-serif' },
  { label: "Roboto Condensed",     stack: '"Roboto Condensed", system-ui, sans-serif' },
  { label: "Fraunces",             stack: '"Fraunces", Georgia, serif' },
  { label: "Playfair Display",     stack: '"Playfair Display", Georgia, serif' },
];
const BODY_FONTS: { label: string; stack: string }[] = [
  { label: "Inter",         stack: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif' },
  { label: "Public Sans",   stack: '"Public Sans", system-ui, sans-serif' },
  { label: "Source Sans 3", stack: '"Source Sans 3", system-ui, sans-serif' },
  { label: "IBM Plex Sans", stack: '"IBM Plex Sans", system-ui, sans-serif' },
];
const DATA_FONTS: { label: string; stack: string }[] = [
  { label: "IBM Plex Mono",  stack: '"IBM Plex Mono", "Courier New", monospace' },
  { label: "JetBrains Mono", stack: '"JetBrains Mono", "Courier New", monospace' },
  { label: "Roboto Mono",    stack: '"Roboto Mono", "Courier New", monospace' },
];

const GF_WEIGHTS = "wght@400;500;600;700;800";
const GF_SYSTEM = new Set(["system-ui", "-apple-system", "segoe ui", "georgia", "times new roman", "courier new", "serif", "sans-serif", "monospace", "sfmono-regular", "arial"]);

function firstFamily(stack: string): string {
  return (stack.split(",")[0]?.trim() ?? "").replace(/^['"]|['"]$/g, "");
}

// Load a Google webfont on demand so the editor previews the real typeface.
function ensureGoogleFont(family: string) {
  if (typeof document === "undefined" || !family || GF_SYSTEM.has(family.toLowerCase())) return;
  const id = "gf-" + family.replace(/\s+/g, "-").toLowerCase();
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id; link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:${GF_WEIGHTS}&display=swap`;
  document.head.appendChild(link);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthStep = "credentials" | "mfa-enroll" | "mfa-verify" | "authenticated";
type EditorTab = "content" | "design" | "preview" | "personas" | "projects" | "shards" | "layout";

interface PersonaDraft {
  id: string;
  label: string;
  tagline: string;
  pitch: string;
  highlight_slug: string;
  order: number;
}

interface ContentDraft {
  hero_name: string;
  hero_role: string;
  hero_institution: string;
  hero_year: string;
  hero_tagline: string;
  hero_photo_url: string;
  hero_photo_size: number;
  about_bio: string;
  contact_email: string;
  github_url: string;
  linkedin_url: string;
  resume_url: string;
}

// ─── Projects data model (Prompt 3) ──────────────────────────────────────────
//
// Run this SQL in the Supabase dashboard (SQL Editor) before using this tab:
//
//   CREATE TABLE IF NOT EXISTS public.projects (
//     id             TEXT PRIMARY KEY,
//     tier           TEXT NOT NULL DEFAULT 'more',
//     title          TEXT NOT NULL DEFAULT '',
//     subtitle       TEXT NOT NULL DEFAULT '',
//     tags           TEXT[] NOT NULL DEFAULT '{}',
//     metrics        JSONB NOT NULL DEFAULT '[]',
//     hero_image     TEXT NOT NULL DEFAULT '',
//     hero_image_alt TEXT NOT NULL DEFAULT '',
//     video_url      TEXT NOT NULL DEFAULT '',
//     sections       JSONB NOT NULL DEFAULT
//                      '[{"id":"summary","title":"Summary","content":"","order":0}]',
//     "order"        INTEGER NOT NULL DEFAULT 0,
//     updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
//   );
//
//   ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
//
//   CREATE POLICY "projects_anon_select"
//     ON public.projects FOR SELECT TO anon USING (true);
//
//   CREATE POLICY "projects_authenticated_all"
//     ON public.projects FOR ALL TO authenticated
//     USING (true) WITH CHECK (true);
//
// Rationale: single-table JSONB sections column matches the existing
// site_content.data pattern; avoids cross-table joins on the public read path.

interface SectionSlide {
  id: string;
  image_url: string;
  image_alt: string;
  caption: string;
  order: number;
}

interface ProjectSection {
  id: string;       // "summary" for the pinned Summary section; UUID for custom ones
  title: string;
  content: string;
  slides?: SectionSlide[];
  order: number;
}

interface ProjectDraft {
  id: string;       // slug, also the Supabase primary key
  tier: "hero" | "featured" | "more";
  title: string;
  subtitle: string;
  tags: string[];
  metrics: Array<{ value: string; label: string }>;
  hero_image: string;
  hero_image_alt: string;
  video_url: string;
  sections: ProjectSection[];
  order: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Input({ label, value, onChange, multiline = false, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void;
  multiline?: boolean; type?: string;
}) {
  const base = "w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] rounded-md text-[#F0F0EC] text-sm px-3 py-2 focus:outline-none focus:border-[#C8FF00] transition-colors placeholder:text-[#6E6E68]";
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>
        {label}
      </label>
      {multiline ? (
        <textarea
          className={`${base} resize-y min-h-[80px]`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ fontFamily: FONT_SANS }}
        />
      ) : (
        <input
          type={type}
          className={base}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ fontFamily: FONT_SANS }}
        />
      )}
    </div>
  );
}

// Shows status + the actual Supabase error message so failures are diagnosable
// without opening DevTools.
function SaveBadge({ status, errorMsg }: {
  status: "idle" | "saving" | "saved" | "error";
  errorMsg?: string;
}) {
  const errText = errorMsg ?? "Save failed";
  const truncated = errText.length > 90 ? errText.slice(0, 87) + "…" : errText;
  const map = {
    idle:   null,
    saving: <span className="text-xs text-[#6E6E68]" style={{ fontFamily: FONT_MONO }}>Saving…</span>,
    saved:  <span className="text-xs text-[#C8FF00]" style={{ fontFamily: FONT_MONO }}>✓ Saved</span>,
    error:  <span className="text-xs text-[#FF4444]" style={{ fontFamily: FONT_MONO }} title={errText}>✕ {truncated}</span>,
  };
  return <>{map[status]}</>;
}

// ─── Auth screens ─────────────────────────────────────────────────────────────

function CredentialsScreen({ onSuccess }: { onSuccess: (step: AuthStep, factorId?: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (err) { setError(err.message); return; }
      if (!data.session) { setError("No session returned."); return; }

      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      // Already fully authenticated from a restored session
      if (aal?.currentLevel === "aal2") { onSuccess("authenticated"); return; }

      if (aal?.nextLevel === "aal2") {
        // MFA enrolled, find the factor and go to verify
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.totp?.[0];
        if (totp) { onSuccess("mfa-verify", totp.id); return; }
        // nextLevel says aal2 but no factor found, send to enroll
        onSuccess("mfa-enroll");
        return;
      }

      // nextLevel is aal1 or null, no MFA set up yet
      onSuccess("mfa-enroll");
    } catch (ex) {
      setLoading(false);
      setError(ex instanceof Error ? ex.message : "Unexpected error. Try again");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 w-full max-w-sm">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl text-[#F0F0EC]" style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}>
          Admin Login
        </h1>
        <p className="text-xs text-[#6E6E68]" style={{ fontFamily: FONT_MONO }}>
          Portfolio content editor · MFA required
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Input label="Email" value={email} onChange={setEmail} type="email" />
        <div className="flex flex-col gap-1.5 relative">
          <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Password</label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] rounded-md text-[#F0F0EC] text-sm px-3 py-2 pr-9 focus:outline-none focus:border-[#C8FF00] transition-colors"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ fontFamily: FONT_SANS }}
            />
            <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6E6E68] hover:text-[#F0F0EC] transition-colors">
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-[#FF4444]" style={{ fontFamily: FONT_MONO }}>{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2.5 bg-[#C8FF00] text-[#0A0A0A] text-sm font-medium rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF00]"
        style={{ fontFamily: FONT_MONO }}
      >
        {loading ? "Signing in…" : "Continue →"}
      </button>
    </form>
  );
}

function MfaEnrollScreen({ onSuccess, onRedirectToVerify }: { onSuccess: () => void; onRedirectToVerify: (factorId: string) => void }) {
  const [qrUrl, setQrUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Portfolio Admin" });
      if (err || !data) {
        // Enrollment failed, a factor may already exist. Try to recover.
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const existing = factors?.totp?.[0];
        if (existing) { onRedirectToVerify(existing.id); return; }
        setError(err?.message ?? "Enrollment failed");
        return;
      }
      setFactorId(data.id);
      setQrUrl(data.totp.qr_code);
      setSecret(data.totp.secret);
    })();
  }, []);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const { data: challenge } = await supabase.auth.mfa.challenge({ factorId });
    if (!challenge) { setError("Challenge failed"); setLoading(false); return; }
    const { error: err } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    setLoading(false);
    if (err) { setError("Invalid code. Try again"); return; }
    onSuccess();
  }

  return (
    <form onSubmit={verify} className="flex flex-col gap-6 w-full max-w-sm">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <QrCode size={16} className="text-[#C8FF00]" />
          <h2 className="text-xl text-[#F0F0EC]" style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}>Set up Authenticator</h2>
        </div>
        <p className="text-xs text-[#6E6E68]" style={{ fontFamily: FONT_MONO }}>
          Scan this QR with Google Authenticator, Authy, or 1Password. You'll need it for every login.
        </p>
      </div>

      {qrUrl && (
        <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-md">
          <img src={qrUrl} alt="TOTP QR code" className="w-40 h-40" />
          {secret && (
            <p className="text-xs text-[#0A0A0A] break-all text-center" style={{ fontFamily: FONT_MONO }}>
              Manual: {secret}
            </p>
          )}
        </div>
      )}

      <Input label="6-digit code from app" value={code} onChange={setCode} type="text" />
      {error && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[#FF4444]" style={{ fontFamily: FONT_MONO }}>{error}</p>
          <button
            type="button"
            onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
            className="text-xs text-[#6E6E68] hover:text-[#F0F0EC] underline text-left transition-colors"
            style={{ fontFamily: FONT_MONO }}
          >
            Sign out &amp; start over
          </button>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !qrUrl}
        className="px-4 py-2.5 bg-[#C8FF00] text-[#0A0A0A] text-sm font-medium rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
        style={{ fontFamily: FONT_MONO }}
      >
        {loading ? "Verifying…" : "Activate MFA & Enter →"}
      </button>
    </form>
  );
}

function MfaVerifyScreen({ factorId, onSuccess }: { factorId: string; onSuccess: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const { data: challenge, error: chalErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chalErr || !challenge) { setError(chalErr?.message ?? "Challenge failed"); setLoading(false); return; }
      const { error: err } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
      setLoading(false);
      if (err) { setError("Invalid code. Try again"); return; }
      onSuccess();
    } catch (ex) {
      setLoading(false);
      setError(ex instanceof Error ? ex.message : "Unexpected error");
    }
  }

  return (
    <form onSubmit={verify} className="flex flex-col gap-5 w-full max-w-sm">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-[#C8FF00]" />
          <h2 className="text-xl text-[#F0F0EC]" style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}>
            Two-factor verification
          </h2>
        </div>
        <p className="text-xs text-[#6E6E68]" style={{ fontFamily: FONT_MONO }}>
          Enter the 6-digit code from your authenticator app.
        </p>
      </div>
      <Input label="Authenticator code" value={code} onChange={setCode} type="text" />
      {error && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[#FF4444]" style={{ fontFamily: FONT_MONO }}>{error}</p>
          <button
            type="button"
            onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
            className="text-xs text-[#6E6E68] hover:text-[#F0F0EC] underline text-left transition-colors"
            style={{ fontFamily: FONT_MONO }}
          >
            Sign out &amp; start over
          </button>
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2.5 bg-[#C8FF00] text-[#0A0A0A] text-sm font-medium rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
        style={{ fontFamily: FONT_MONO }}
      >
        {loading ? "Verifying…" : "Enter editor →"}
      </button>
    </form>
  );
}

// ─── Content editor tab ───────────────────────────────────────────────────────

function ContentTab({ draft, onChange, onSave, saveStatus, errorMsg }: {
  draft: ContentDraft;
  onChange: (d: ContentDraft) => void;
  onSave: () => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
  errorMsg?: string;
}) {
  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <section className="flex flex-col gap-4">
        <h3 className="text-xs text-[#C8FF00] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Hero</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Name" value={draft.hero_name} onChange={(v) => onChange({ ...draft, hero_name: v })} />
          <Input label="Role" value={draft.hero_role} onChange={(v) => onChange({ ...draft, hero_role: v })} />
          <Input label="Institution" value={draft.hero_institution} onChange={(v) => onChange({ ...draft, hero_institution: v })} />
          <Input label="Year" value={draft.hero_year} onChange={(v) => onChange({ ...draft, hero_year: v })} />
        </div>
        <Input label="Tagline" value={draft.hero_tagline} onChange={(v) => onChange({ ...draft, hero_tagline: v })} />

        <div className="flex flex-col gap-2 pt-2">
          <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Headshot photo URL</label>
          <input
            type="url"
            value={draft.hero_photo_url}
            onChange={(e) => onChange({ ...draft, hero_photo_url: normalizeDriveUrl(e.target.value) })}
            placeholder="https://… (Google Drive links auto-converted)"
            className="w-full bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-md text-[#F0F0EC] text-sm px-3 py-2 focus:outline-none focus:border-[#C8FF00] transition-colors"
            style={{ fontFamily: FONT_MONO, fontSize: "12px" }}
          />
          {draft.hero_photo_url?.includes("lh3.googleusercontent.com") && (
            <p className="text-[10px] text-[#C8FF00]" style={{ fontFamily: FONT_MONO }}>✓ Drive link converted to direct URL</p>
          )}
          {draft.hero_photo_url && (
            <img src={draft.hero_photo_url} alt="Preview" className="w-20 h-20 rounded-full object-cover border border-[rgba(255,255,255,0.1)]" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>
            Photo size: <span className="text-[#F0F0EC]">{draft.hero_photo_size}px</span>
          </label>
          <input
            type="range"
            min={80} max={640} step={8}
            value={draft.hero_photo_size}
            onChange={(e) => onChange({ ...draft, hero_photo_size: Number(e.target.value) })}
            className="w-full accent-[#C8FF00]"
          />
          <div className="flex justify-between text-[10px] text-[#6E6E68]" style={{ fontFamily: FONT_MONO }}>
            <span>80px</span><span>640px</span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-xs text-[#C8FF00] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>About</h3>
        <Input label="Bio" value={draft.about_bio} onChange={(v) => onChange({ ...draft, about_bio: v })} multiline />
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-xs text-[#C8FF00] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Contact & Social</h3>
        <Input label="Email" value={draft.contact_email} onChange={(v) => onChange({ ...draft, contact_email: v })} type="email" />
        <Input label="GitHub URL" value={draft.github_url} onChange={(v) => onChange({ ...draft, github_url: normalizeDriveUrl(v) })} type="url" />
        <Input label="LinkedIn URL" value={draft.linkedin_url} onChange={(v) => onChange({ ...draft, linkedin_url: normalizeDriveUrl(v) })} type="url" />
        <Input label="Résumé URL (PDF or link)" value={draft.resume_url} onChange={(v) => onChange({ ...draft, resume_url: normalizeDriveUrl(v) })} type="url" />
      </section>

      <p className="text-xs text-[#6E6E68] border border-[rgba(255,255,255,0.06)] rounded-lg px-4 py-3" style={{ fontFamily: FONT_MONO }}>
        Project titles, sections, and content are managed in the <strong className="text-[#C8FF00]">Projects</strong> tab.
      </p>

      <div className="flex items-center gap-4 sticky bottom-0 bg-[#0A0A0A] py-4 border-t border-[rgba(255,255,255,0.06)]">
        <button
          onClick={onSave}
          disabled={saveStatus === "saving"}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#C8FF00] text-[#0A0A0A] text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
          style={{ fontFamily: FONT_MONO }}
        >
          <Save size={13} /> Save to Supabase
        </button>
        <SaveBadge status={saveStatus} errorMsg={errorMsg} />
      </div>
    </div>
  );
}

// ─── Design tokens tab ────────────────────────────────────────────────────────

// ─── Colour swatch + hex input pair ──────────────────────────────────────────

function ColourRow({ label, tokenKey, tokens, onChange, contrastSpec }: {
  label: string;
  tokenKey: string;
  tokens: Record<string, string>;
  onChange: (t: Record<string, string>) => void;
  contrastSpec?: { fg?: string; bg?: string; min: number; target?: number };
}) {
  const val = tokens[tokenKey] ?? "#888888";
  const isHex = /^#[0-9a-fA-F]{6}$/.test(val);
  const fgHex = contrastSpec?.fg ? (tokens[contrastSpec.fg] ?? contrastSpec.fg) : val;
  const bgHex = contrastSpec?.bg ? (tokens[contrastSpec.bg] ?? contrastSpec.bg) : val;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-[#6E6E68] uppercase tracking-widest flex-1" style={{ fontFamily: FONT_MONO }}>{label}</label>
        {contrastSpec && isHex && (tokens[contrastSpec.fg ?? ""] || tokens[contrastSpec.bg ?? ""]) && (
          <ContrastBadge
            fg={fgHex}
            bg={bgHex}
            min={contrastSpec.min}
            target={contrastSpec.target}
          />
        )}
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={isHex ? val : "#888888"}
          onChange={(e) => onChange({ ...tokens, [tokenKey]: e.target.value })}
          className="w-8 h-8 rounded border border-[rgba(255,255,255,0.1)] cursor-pointer bg-transparent shrink-0"
          title={val}
        />
        <input
          type="text"
          value={val}
          onChange={(e) => onChange({ ...tokens, [tokenKey]: e.target.value })}
          className="flex-1 bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] rounded-md text-[#F0F0EC] px-3 py-1.5 focus:outline-none focus:border-[#A9BCA3] transition-colors"
          style={{ fontFamily: FONT_MONO, fontSize: "11px" }}
        />
      </div>
    </div>
  );
}

function DesignTab({ tokens, onChange, onSave, saveStatus, errorMsg }: {
  tokens: Record<string, string>;
  onChange: (t: Record<string, string>) => void;
  onSave: () => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
  errorMsg?: string;
}) {
  const starColor = tokens["--star-color"] ?? "#EDEADC";
  function setStar(key: string, value: string) { onChange({ ...tokens, [key]: value }); }
  const starRanges: { key: string; label: string; min: number; max: number; step: number }[] = [
    { key: "--star-count",       label: "Count",           min: 40,  max: 400, step: 5 },
    { key: "--star-size-min",    label: "Size min (px)",   min: 0.2, max: 4,   step: 0.1 },
    { key: "--star-size-max",    label: "Size max (px)",   min: 4,   max: 24,  step: 0.5 },
    { key: "--star-ray-density", label: "Ray density",     min: 0,   max: 0.4, step: 0.01 },
    { key: "--star-ray-length",  label: "Ray length",      min: 0.3, max: 3,   step: 0.1 },
    { key: "--star-refraction",  label: "Refraction",      min: 0,   max: 1.5, step: 0.05 },
    { key: "--star-opacity",     label: "Opacity",         min: 0.2, max: 1,   step: 0.05 },
  ];

  // Load the three currently-selected webfonts so the previews render correctly.
  useEffect(() => {
    (["--font-display", "--font-body", "--font-data"] as const).forEach((k) => {
      if (tokens[k]) ensureGoogleFont(firstFamily(tokens[k]));
    });
  }, [tokens["--font-display"], tokens["--font-body"], tokens["--font-data"]]);

  function setFont(key: string, stack: string) {
    ensureGoogleFont(firstFamily(stack));
    onChange({ ...tokens, [key]: stack });
  }

  const scale = Number(tokens["--type-scale"] ?? "1") || 1;
  const fontSelectBase = "w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] rounded-md text-[#F0F0EC] text-sm px-3 py-2 focus:outline-none focus:border-[#A9BCA3] transition-colors";

  // Palette preview swatch (shows the two-accent rule visually)
  const p = tokens;

  return (
    <div className="flex flex-col gap-8">

      {/* ── Palette preview ───────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs text-[#5FD3C4] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Palette preview</h3>
          <button
            onClick={() => onChange({ ...tokens, ...DARK_BROWN_TEAL })}
            className="text-[10px] px-2 py-1 border border-[rgba(95,211,196,0.3)] text-[#5FD3C4] hover:bg-[rgba(95,211,196,0.08)] transition-colors rounded"
            style={{ fontFamily: FONT_MONO }}
            title="Reset to dark brown and teal defaults"
          >
            Reset to dark brown + teal
          </button>
        </div>
        <div className="rounded-md overflow-hidden border border-[rgba(255,255,255,0.06)] text-xs" style={{ fontFamily: FONT_MONO }}>
          {/* Field strip */}
          <div className="flex items-center gap-4 px-4 py-3" style={{ background: p["--field"] ?? "#2A241C" }}>
            <span style={{ color: p["--ink"] ?? "#EDEADC" }}>--ink on --field</span>
            <span style={{ color: p["--ink-muted"] ?? "#C4C2B2", opacity: 0.85 }}>--ink-muted</span>
            <span style={{ color: p["--accent"] ?? "#A9BCA3", textDecoration: "underline", textUnderlineOffset: "3px" }}>sage link</span>
            <span className="ml-auto px-2 py-0.5 rounded" style={{ background: p["--accent-fill"] ?? "#8A9A86", color: p["--on-accent"] ?? "#1B211A" }}>button</span>
          </div>
          {/* Field-raised strip */}
          <div className="flex items-center gap-4 px-4 py-2" style={{ background: p["--field-raised"] ?? "#352E24", borderTop: `1px solid ${p["--edge"] ?? "#463F33"}` }}>
            <span style={{ color: p["--ink"] ?? "#EDEADC", fontSize: "10px" }}>--field-raised (nav, footer)</span>
          </div>
          {/* Surface (card) strip */}
          <div className="flex items-center gap-4 px-4 py-3" style={{ background: p["--surface"] ?? "#E4E2D2", borderTop: `1px solid ${p["--edge"] ?? "#463F33"}` }}>
            <span style={{ color: p["--ink-on-surface"] ?? "#25291F" }}>--ink-on-surface</span>
            <span style={{ color: p["--accent-surface"] ?? "#4F5C4B", textDecoration: "underline", textUnderlineOffset: "3px" }}>sage-surface link</span>
            <span className="ml-auto px-2 py-0.5 rounded" style={{ background: p["--accent-fill"] ?? "#8A9A86", color: p["--on-accent"] ?? "#1B211A" }}>button</span>
          </div>
        </div>
      </section>

      {/* ── Field group ──────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <h3 className="text-xs text-[#5FD3C4] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Field</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ColourRow label="--field (page background)" tokenKey="--field" tokens={tokens} onChange={onChange} />
          <ColourRow label="--field-raised (nav, footer)" tokenKey="--field-raised" tokens={tokens} onChange={onChange} />
          <ColourRow label="--edge (borders, dividers)" tokenKey="--edge" tokens={tokens} onChange={onChange} />
        </div>
      </section>

      {/* ── Surface (card) group ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <h3 className="text-xs text-[#5FD3C4] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Surface</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ColourRow label="--surface (cards)" tokenKey="--surface" tokens={tokens} onChange={onChange} />
          <ColourRow
            label="--ink-on-surface (card text)"
            tokenKey="--ink-on-surface"
            tokens={tokens}
            onChange={onChange}
            contrastSpec={{ fg: "--ink-on-surface", bg: "--surface", min: 7, target: 12 }}
          />
        </div>
      </section>

      {/* ── Ink group ────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <h3 className="text-xs text-[#5FD3C4] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Ink</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ColourRow
            label="--ink (primary text on field)"
            tokenKey="--ink"
            tokens={tokens}
            onChange={onChange}
            contrastSpec={{ fg: "--ink", bg: "--field", min: 7, target: 11 }}
          />
          <ColourRow
            label="--ink-muted (captions, metadata)"
            tokenKey="--ink-muted"
            tokens={tokens}
            onChange={onChange}
            contrastSpec={{ fg: "--ink-muted", bg: "--field", min: 4.5 }}
          />
        </div>
      </section>

      {/* ── Accent group ─────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-xs text-[#5FD3C4] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Accent (two-value rule)</h3>
          <p className="text-[10px] text-[#6E6E68] leading-relaxed" style={{ fontFamily: FONT_MONO }}>
            Sage must split: light value on dark field, dark value inside light cards. The preview above shows both.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ColourRow
            label="--accent (links/stats on field)"
            tokenKey="--accent"
            tokens={tokens}
            onChange={onChange}
            contrastSpec={{ fg: "--accent", bg: "--field", min: 4.5 }}
          />
          <ColourRow
            label="--accent-surface (links/stats in card)"
            tokenKey="--accent-surface"
            tokens={tokens}
            onChange={onChange}
            contrastSpec={{ fg: "--accent-surface", bg: "--surface", min: 4.5 }}
          />
          <ColourRow
            label="--accent-fill (button/tag backgrounds)"
            tokenKey="--accent-fill"
            tokens={tokens}
            onChange={onChange}
          />
          <ColourRow
            label="--on-accent (labels on accent-fill)"
            tokenKey="--on-accent"
            tokens={tokens}
            onChange={onChange}
            contrastSpec={{ fg: "--on-accent", bg: "--accent-fill", min: 4.5 }}
          />
        </div>
      </section>

      {/* ── Typography ───────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <h3 className="text-xs text-[#5FD3C4] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Typography</h3>
        <p className="text-[11px] text-[#6E6E68] leading-relaxed" style={{ fontFamily: FONT_MONO }}>
          Three tokens, three jobs. Display for headings, Body for reading, Data for numbers and tags.
        </p>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Display font (headings)</label>
          <select
            className={fontSelectBase}
            value={tokens["--font-display"] ?? DISPLAY_FONTS[0].stack}
            onChange={(e) => setFont("--font-display", e.target.value)}
            style={{ fontFamily: FONT_MONO }}
          >
            {DISPLAY_FONTS.map((f) => <option key={f.label} value={f.stack}>{f.label}</option>)}
          </select>
          <span className="text-[#F0F0EC] leading-none pt-1" style={{ fontFamily: tokens["--font-display"], fontSize: "30px", fontWeight: 700 }}>
            Building robots that work
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Body font (reading)</label>
          <select
            className={fontSelectBase}
            value={tokens["--font-body"] ?? BODY_FONTS[0].stack}
            onChange={(e) => setFont("--font-body", e.target.value)}
            style={{ fontFamily: FONT_MONO }}
          >
            {BODY_FONTS.map((f) => <option key={f.label} value={f.stack}>{f.label}</option>)}
          </select>
          <span className="text-[#B8B8B0]" style={{ fontFamily: tokens["--font-body"], fontSize: "16px", lineHeight: 1.6 }}>
            I prototype fast, validate with data, and ship hardware that works.
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Data font (numbers, tags)</label>
          <select
            className={fontSelectBase}
            value={tokens["--font-data"] ?? DATA_FONTS[0].stack}
            onChange={(e) => setFont("--font-data", e.target.value)}
            style={{ fontFamily: FONT_MONO }}
          >
            {DATA_FONTS.map((f) => <option key={f.label} value={f.stack}>{f.label}</option>)}
          </select>
          <span className="text-[#B8B8B0]" style={{ fontFamily: tokens["--font-data"], fontSize: "15px", letterSpacing: "0.06em" }}>
            350% · 4mm · &lt; 8% · 2026
          </span>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>
            Type scale <span className="text-[#F0F0EC]">{scale.toFixed(2)}x</span>
          </label>
          <input
            type="range"
            min={0.85} max={1.3} step={0.01}
            value={scale}
            onChange={(e) => onChange({ ...tokens, "--type-scale": e.target.value })}
            className="w-full accent-[#A9BCA3]"
          />
          <div className="flex justify-between text-[10px] text-[#6E6E68]" style={{ fontFamily: FONT_MONO }}>
            <span>0.85x</span><span>compact to large</span><span>1.30x</span>
          </div>
        </div>
      </section>

      {/* ── Star Field ───────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <h3 className="text-xs text-[#5FD3C4] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Star Field</h3>
        <p className="text-[11px] text-[#6E6E68] leading-relaxed" style={{ fontFamily: FONT_MONO }}>
          Faceted shard background. Tune geometry and refracted rays, applies live after Save.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {starRanges.map((r) => {
            const val = Number(tokens[r.key] ?? "0") || 0;
            return (
              <div key={r.key} className="flex flex-col gap-1.5">
                <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>
                  {r.label} <span className="text-[#F0F0EC]">{val}</span>
                </label>
                <input
                  type="range"
                  min={r.min} max={r.max} step={r.step}
                  value={val}
                  onChange={(e) => setStar(r.key, e.target.value)}
                  className="w-full accent-[#A9BCA3]"
                />
              </div>
            );
          })}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Shard colour</label>
            <div className="flex gap-2 items-center">
              <input type="color" value={starColor} onChange={(e) => setStar("--star-color", e.target.value)} className="w-8 h-8 rounded-md border border-[rgba(255,255,255,0.1)] cursor-pointer bg-transparent" />
              <input type="text" value={starColor} onChange={(e) => setStar("--star-color", e.target.value)} className="flex-1 bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] rounded-md text-[#F0F0EC] px-3 py-1.5 focus:outline-none focus:border-[#A9BCA3]" style={{ fontFamily: FONT_MONO, fontSize: "11px" }} />
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-4 sticky bottom-0 bg-[#0A0A0A] py-4 border-t border-[rgba(255,255,255,0.06)]">
        <button
          onClick={onSave}
          disabled={saveStatus === "saving"}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#A9BCA3] text-[#1B211A] text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
          style={{ fontFamily: FONT_MONO }}
        >
          <Save size={13} /> Save tokens
        </button>
        <SaveBadge status={saveStatus} errorMsg={errorMsg} />
      </div>
    </div>
  );
}

// ─── Preview tab ──────────────────────────────────────────────────────────────

function PreviewTab({ exportData }: { exportData: () => Record<string, unknown> }) {
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");

  function downloadJson() {
    const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "portfolio-content.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const btn = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-colors ${
      active
        ? "bg-[#C8FF00] text-black border-[#C8FF00]"
        : "bg-[#111] text-[#8C8A82] border-[rgba(255,255,255,0.08)] hover:text-[#F0F0EC]"
    }`;

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-[#6E6E68]" style={{ fontFamily: FONT_MONO }}>
          Live preview reflects saved design tokens. Content changes appear after save.
        </p>
        <div className="flex items-center gap-2" style={{ fontFamily: FONT_MONO }}>
          <button type="button" className={btn(device === "desktop")} onClick={() => setDevice("desktop")}>
            <Monitor size={13} /> Desktop
          </button>
          <button type="button" className={btn(device === "phone")} onClick={() => setDevice("phone")}>
            <Smartphone size={13} /> Phone
          </button>
          <button type="button" className={btn(false)} onClick={downloadJson}>
            <Download size={13} /> Export JSON
          </button>
        </div>
      </div>
      <div className="flex-1 rounded-md overflow-auto border border-[rgba(255,255,255,0.08)] flex justify-center bg-[#0B0B0A]" style={{ minHeight: "600px" }}>
        {device === "phone" ? (
          <div className="my-6 rounded-[2rem] overflow-hidden border-[6px] border-[#1A1A17] shadow-2xl" style={{ width: "390px", height: "844px", flex: "0 0 auto" }}>
            <iframe src="/" title="Portfolio phone preview" className="border-0" style={{ width: "390px", height: "844px" }} />
          </div>
        ) : (
          <iframe
            src="/"
            title="Portfolio preview"
            className="w-full h-full border-0"
            style={{ minHeight: "600px", transform: "scale(0.85)", transformOrigin: "top left", width: "117.6%", height: "117.6%" }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Personas tab ─────────────────────────────────────────────────────────────

function PersonasTab({ personas, onChange, onSave, saveStatus, errorMsg }: {
  personas: PersonaDraft[];
  onChange: (p: PersonaDraft[]) => void;
  onSave: () => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
  errorMsg?: string;
}) {
  function updateField(id: string, field: keyof PersonaDraft, value: string) {
    onChange(personas.map((p) => p.id === id ? { ...p, [field]: value } : p));
  }

  const fieldBase = "w-full bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-md text-[#F0F0EC] text-sm px-3 py-2 focus:outline-none focus:border-[#C8FF00] transition-colors";

  return (
    <div className="flex flex-col gap-8">
      <p className="text-xs text-[#6E6E68]" style={{ fontFamily: FONT_MONO }}>
        These personas power the "Viewing As" bar. Changes save to Supabase and appear on the live site.
      </p>
      {personas.map((p) => (
        <section key={p.id} className="flex flex-col gap-4 border border-[rgba(255,255,255,0.06)] rounded-xl p-5">
          <h3 className="text-xs text-[#C8FF00] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>{p.id}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Tab label</label>
              <input className={fieldBase} value={p.label} onChange={(e) => updateField(p.id, "label", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Highlight slug</label>
              <input className={fieldBase} value={p.highlight_slug} onChange={(e) => updateField(p.id, "highlight_slug", e.target.value)} placeholder="project slug" style={{ fontFamily: FONT_MONO, fontSize: "11px" }} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Tagline (hero bio line)</label>
            <input className={fieldBase} value={p.tagline} onChange={(e) => updateField(p.id, "tagline", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Quick pitch text</label>
            <textarea className={`${fieldBase} resize-y min-h-[80px]`} value={p.pitch} onChange={(e) => updateField(p.id, "pitch", e.target.value)} />
          </div>
        </section>
      ))}
      <div className="flex items-center gap-4 sticky bottom-0 bg-[#0A0A0A] py-4 border-t border-[rgba(255,255,255,0.06)]">
        <button
          onClick={onSave}
          disabled={saveStatus === "saving"}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#C8FF00] text-[#0A0A0A] text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
          style={{ fontFamily: FONT_MONO }}
        >
          <Save size={13} /> Save personas
        </button>
        <SaveBadge status={saveStatus} errorMsg={errorMsg} />
      </div>
    </div>
  );
}

// ─── Projects tab (Prompt 3) ──────────────────────────────────────────────────

function slugify(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const DEFAULT_SECTIONS: ProjectSection[] = [
  { id: "summary", title: "Summary", content: "", order: 0 },
];

function ProjectsTab({ projects, onChange, onSave, saveStatus, errorMsg, tableExists, seeded }: {
  projects: ProjectDraft[];
  onChange: (p: ProjectDraft[]) => void;
  onSave: () => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
  errorMsg?: string;
  tableExists: boolean;
  seeded: boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  function createProject() {
    const title = newTitle.trim();
    if (!title) return;
    const id = slugify(title) || `project-${Date.now()}`;
    const project: ProjectDraft = {
      id,
      tier: "more",
      title,
      subtitle: "",
      tags: [],
      metrics: [],
      hero_image: "",
      hero_image_alt: "",
      video_url: "",
      sections: [{ id: "summary", title: "Summary", content: "", order: 0 }],
      order: projects.length,
    };
    onChange([...projects, project]);
    setNewTitle("");
    setExpanded(id);
  }

  function updateProject(id: string, updates: Partial<ProjectDraft>) {
    onChange(projects.map((p) => p.id === id ? { ...p, ...updates } : p));
  }

  function deleteProject(id: string) {
    onChange(projects.filter((p) => p.id !== id).map((p, i) => ({ ...p, order: i })));
    if (expanded === id) setExpanded(null);
  }

  function moveProject(id: string, dir: -1 | 1) {
    const sorted = [...projects].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((p) => p.id === id);
    const next = idx + dir;
    if (next < 0 || next >= sorted.length) return;
    [sorted[idx], sorted[next]] = [sorted[next], sorted[idx]];
    onChange(sorted.map((p, i) => ({ ...p, order: i })));
  }

  function addSection(projectId: string) {
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;
    const nonSummaryCount = proj.sections.filter((s) => s.id !== "summary").length;
    const section: ProjectSection = {
      id: crypto.randomUUID(),
      title: `Section ${nonSummaryCount + 1}`,
      content: "",
      order: proj.sections.length,
    };
    updateProject(projectId, { sections: [...proj.sections, section] });
  }

  function updateSection(projectId: string, sectionId: string, updates: Partial<ProjectSection>) {
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;
    updateProject(projectId, {
      sections: proj.sections.map((s) => s.id === sectionId ? { ...s, ...updates } : s),
    });
  }

  function deleteSection(projectId: string, sectionId: string) {
    if (sectionId === "summary") return;
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;
    updateProject(projectId, {
      sections: proj.sections
        .filter((s) => s.id !== sectionId)
        .map((s, i) => ({ ...s, order: i })),
    });
  }

  function moveSection(projectId: string, sectionId: string, dir: -1 | 1) {
    if (sectionId === "summary") return;
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;
    const sorted = [...proj.sections].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((s) => s.id === sectionId);
    const targetIdx = idx + dir;
    // Don't allow moving before Summary (index 0)
    if (targetIdx <= 0 || targetIdx >= sorted.length) return;
    [sorted[idx], sorted[targetIdx]] = [sorted[targetIdx], sorted[idx]];
    updateProject(projectId, { sections: sorted.map((s, i) => ({ ...s, order: i })) });
  }

  function addSlideToSection(projectId: string, sectionId: string) {
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;
    const sec = proj.sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const slide: SectionSlide = { id: crypto.randomUUID(), image_url: "", image_alt: "", caption: "", order: (sec.slides ?? []).length };
    updateSection(projectId, sectionId, { slides: [...(sec.slides ?? []), slide] });
  }

  function updateSectionSlide(projectId: string, sectionId: string, slideId: string, updates: Partial<SectionSlide>) {
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;
    const sec = proj.sections.find((s) => s.id === sectionId);
    if (!sec) return;
    updateSection(projectId, sectionId, {
      slides: (sec.slides ?? []).map((sl) => sl.id === slideId ? { ...sl, ...updates } : sl),
    });
  }

  function removeSectionSlide(projectId: string, sectionId: string, slideId: string) {
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;
    const sec = proj.sections.find((s) => s.id === sectionId);
    if (!sec) return;
    updateSection(projectId, sectionId, {
      slides: (sec.slides ?? []).filter((sl) => sl.id !== slideId).map((sl, i) => ({ ...sl, order: i })),
    });
  }

  function addMetric(projectId: string) {
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;
    updateProject(projectId, { metrics: [...proj.metrics, { value: "", label: "" }] });
  }

  function updateMetric(projectId: string, i: number, field: "value" | "label", val: string) {
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;
    updateProject(projectId, {
      metrics: proj.metrics.map((m, j) => j === i ? { ...m, [field]: val } : m),
    });
  }

  function removeMetric(projectId: string, i: number) {
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;
    updateProject(projectId, { metrics: proj.metrics.filter((_, j) => j !== i) });
  }

  const sorted = [...projects].sort((a, b) => a.order - b.order);
  const fieldBase = "bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-md text-[#F0F0EC] text-sm px-3 py-2 focus:outline-none focus:border-[#C8FF00] transition-colors";

  return (
    <div className="flex flex-col gap-6">
      {/* SQL setup notice, shown when table doesn't exist */}
      {!tableExists && (
        <div className="p-4 border border-[rgba(232,54,42,0.35)] bg-[rgba(232,54,42,0.08)] rounded-xl flex flex-col gap-3">
          <p className="text-xs text-[#FF8A82] font-medium" style={{ fontFamily: FONT_MONO }}>
            ⚠ projects table not found. Run this SQL in the Supabase dashboard first:
          </p>
          <pre className="text-[10px] text-[#6E6E68] leading-relaxed whitespace-pre-wrap break-all" style={{ fontFamily: FONT_MONO }}>{`CREATE TABLE IF NOT EXISTS public.projects (
  id             TEXT PRIMARY KEY,
  tier           TEXT NOT NULL DEFAULT 'more',
  title          TEXT NOT NULL DEFAULT '',
  subtitle       TEXT NOT NULL DEFAULT '',
  tags           TEXT[] NOT NULL DEFAULT '{}',
  metrics        JSONB NOT NULL DEFAULT '[]',
  hero_image     TEXT NOT NULL DEFAULT '',
  hero_image_alt TEXT NOT NULL DEFAULT '',
  video_url      TEXT NOT NULL DEFAULT '',
  sections       JSONB NOT NULL DEFAULT
    '[{"id":"summary","title":"Summary","content":"","order":0}]',
  "order"        INTEGER NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_anon_select"
  ON public.projects FOR SELECT TO anon USING (true);
CREATE POLICY "projects_authenticated_all"
  ON public.projects FOR ALL TO authenticated
  USING (true) WITH CHECK (true);`}</pre>
        </div>
      )}

      {/* Seeded-from-code banner */}
      {seeded && (
        <div className="p-4 border border-[rgba(200,255,0,0.25)] bg-[rgba(200,255,0,0.06)] rounded-xl flex items-start gap-3">
          <span className="text-[#C8FF00] shrink-0 mt-0.5">↓</span>
          <p className="text-xs text-[#C8FF00]/80 leading-relaxed" style={{ fontFamily: FONT_MONO }}>
            Pre-loaded from your hardcoded portfolio data. Edit anything, then hit <strong className="text-[#C8FF00]">Save projects</strong>. After that, the live site reads from the database and changes appear instantly.
          </p>
        </div>
      )}

      {/* New project form */}
      <div className="flex gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") createProject(); }}
          placeholder="New project title…"
          className={`${fieldBase} flex-1`}
          style={{ fontFamily: FONT_SANS }}
        />
        <button
          onClick={createProject}
          disabled={!newTitle.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#C8FF00] text-[#0A0A0A] text-xs font-medium rounded-md hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0"
          style={{ fontFamily: FONT_MONO }}
        >
          <Plus size={12} /> Create
        </button>
      </div>

      {/* Project list */}
      {sorted.length === 0 && (
        <p className="text-xs text-[#6E6E68] text-center py-8" style={{ fontFamily: FONT_MONO }}>
          No projects yet. Create one above.
        </p>
      )}

      {sorted.map((proj, idx) => (
        <div key={proj.id} className="border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden">
          {/* Project header */}
          <div
            className="flex items-center gap-3 px-4 py-3 bg-[#111] cursor-pointer hover:bg-[#181818] transition-colors"
            onClick={() => setExpanded(expanded === proj.id ? null : proj.id)}
          >
            <span className="text-xs text-[#C8FF00] w-6 shrink-0" style={{ fontFamily: FONT_MONO }}>
              {String(idx + 1).padStart(2, "0")}
            </span>
            <span className="flex-1 text-sm text-[#F0F0EC] truncate" style={{ fontFamily: FONT_SANS }}>
              {proj.title || "Untitled"}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-md border shrink-0 ${
              proj.tier === "hero" ? "border-[#C8FF00]/40 text-[#C8FF00]" :
              proj.tier === "featured" ? "border-[rgba(255,255,255,0.2)] text-[#F0F0EC]" :
              "border-[rgba(255,255,255,0.08)] text-[#6E6E68]"
            }`} style={{ fontFamily: FONT_MONO }}>{proj.tier}</span>
            <div className="flex items-center gap-1">
              <button onClick={(e) => { e.stopPropagation(); moveProject(proj.id, -1); }} disabled={idx === 0}
                className="p-1 text-[#6E6E68] hover:text-[#F0F0EC] disabled:opacity-30 transition-colors" aria-label="Move up">↑</button>
              <button onClick={(e) => { e.stopPropagation(); moveProject(proj.id, 1); }} disabled={idx === sorted.length - 1}
                className="p-1 text-[#6E6E68] hover:text-[#F0F0EC] disabled:opacity-30 transition-colors" aria-label="Move down">↓</button>
              <button
                onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${proj.title}"?`)) deleteProject(proj.id); }}
                className="p-1 text-[#6E6E68] hover:text-[#FF4444] transition-colors ml-1"
                aria-label="Delete project"
              >
                <Trash2 size={13} />
              </button>
              <ChevronDown size={12} className={`text-[#6E6E68] ml-1 transition-transform ${expanded === proj.id ? "rotate-180" : ""}`} />
            </div>
          </div>

          {/* Project edit form */}
          {expanded === proj.id && (
            <div className="flex flex-col gap-6 p-5 bg-[#0D0D0D] border-t border-[rgba(255,255,255,0.06)]">
              {/* Basic fields */}
              <div className="flex flex-col gap-3">
                <h4 className="text-[10px] text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Basic info</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Title</label>
                    <input className={`${fieldBase} w-full`} value={proj.title} onChange={(e) => updateProject(proj.id, { title: e.target.value })} style={{ fontFamily: FONT_SANS }} />
                  </div>
                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Subtitle</label>
                    <input className={`${fieldBase} w-full`} value={proj.subtitle} onChange={(e) => updateProject(proj.id, { subtitle: e.target.value })} style={{ fontFamily: FONT_SANS }} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Tier</label>
                    <select
                      className={`${fieldBase} w-full`}
                      value={proj.tier}
                      onChange={(e) => updateProject(proj.id, { tier: e.target.value as ProjectDraft["tier"] })}
                      style={{ fontFamily: FONT_MONO }}
                    >
                      <option value="hero">hero</option>
                      <option value="featured">featured</option>
                      <option value="more">more</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Video URL</label>
                    <input className={`${fieldBase} w-full`} value={proj.video_url} onChange={(e) => updateProject(proj.id, { video_url: e.target.value })} placeholder="YouTube embed URL" style={{ fontFamily: FONT_MONO, fontSize: "11px" }} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Hero image URL</label>
                    <input className={`${fieldBase} w-full`} value={proj.hero_image} onChange={(e) => updateProject(proj.id, { hero_image: normalizeDriveUrl(e.target.value) })} placeholder="https://… (Drive links auto-converted)" style={{ fontFamily: FONT_MONO, fontSize: "11px" }} />
                    {proj.hero_image?.includes("lh3.googleusercontent.com") && (
                      <p className="text-[10px] text-[#C8FF00]" style={{ fontFamily: FONT_MONO }}>✓ Drive link converted</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Hero image alt</label>
                    <input className={`${fieldBase} w-full`} value={proj.hero_image_alt} onChange={(e) => updateProject(proj.id, { hero_image_alt: e.target.value })} style={{ fontFamily: FONT_SANS }} />
                  </div>
                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Tags (one per line)</label>
                    <textarea
                      className={`${fieldBase} w-full resize-y min-h-[60px]`}
                      value={proj.tags.join("\n")}
                      onChange={(e) => updateProject(proj.id, { tags: e.target.value.split("\n").map((t) => t.trim()).filter(Boolean) })}
                      style={{ fontFamily: FONT_MONO, fontSize: "12px" }}
                    />
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Metrics</h4>
                  <button onClick={() => addMetric(proj.id)} className="inline-flex items-center gap-1 text-[10px] text-[#C8FF00] hover:opacity-80 transition-opacity" style={{ fontFamily: FONT_MONO }}>
                    <Plus size={10} /> Add
                  </button>
                </div>
                {proj.metrics.map((m, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      className={`${fieldBase} w-24 shrink-0`}
                      value={m.value}
                      onChange={(e) => updateMetric(proj.id, i, "value", e.target.value)}
                      placeholder="< 8%"
                      style={{ fontFamily: FONT_MONO, fontSize: "12px" }}
                    />
                    <input
                      className={`${fieldBase} flex-1`}
                      value={m.label}
                      onChange={(e) => updateMetric(proj.id, i, "label", e.target.value)}
                      placeholder="FEA vs. experiment"
                      style={{ fontFamily: FONT_SANS }}
                    />
                    <button onClick={() => removeMetric(proj.id, i)} className="p-1.5 text-[#6E6E68] hover:text-[#FF4444] transition-colors shrink-0">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {proj.metrics.length === 0 && (
                  <p className="text-[10px] text-[#6E6E68]" style={{ fontFamily: FONT_MONO }}>No metrics yet.</p>
                )}
              </div>

              {/* Sections */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Sections</h4>
                  <button onClick={() => addSection(proj.id)} className="inline-flex items-center gap-1 text-[10px] text-[#C8FF00] hover:opacity-80 transition-opacity" style={{ fontFamily: FONT_MONO }}>
                    <Plus size={10} /> Add section
                  </button>
                </div>

                {[...proj.sections]
                  .sort((a, b) => a.order - b.order)
                  .map((sec, secIdx, arr) => {
                    const isSummary = sec.id === "summary";
                    return (
                      <div key={sec.id} className={`flex flex-col gap-2 p-3 rounded-lg border ${isSummary ? "border-[rgba(200,255,0,0.15)] bg-[rgba(200,255,0,0.04)]" : "border-[rgba(255,255,255,0.06)] bg-[#111]"}`}>
                        <div className="flex items-center gap-2">
                          {isSummary ? (
                            <span className="text-xs text-[#C8FF00] flex-1" style={{ fontFamily: FONT_MONO }}>
                              Summary <span className="text-[10px] text-[#6E6E68]">(pinned)</span>
                            </span>
                          ) : (
                            <input
                              className="flex-1 bg-transparent text-xs text-[#F0F0EC] focus:outline-none border-b border-[rgba(255,255,255,0.1)] focus:border-[#C8FF00] transition-colors py-0.5"
                              value={sec.title}
                              onChange={(e) => updateSection(proj.id, sec.id, { title: e.target.value })}
                              placeholder="Section title"
                              style={{ fontFamily: FONT_MONO }}
                            />
                          )}
                          {!isSummary && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => moveSection(proj.id, sec.id, -1)} disabled={secIdx <= 1}
                                className="text-[#6E6E68] hover:text-[#F0F0EC] disabled:opacity-30 transition-colors text-xs px-1" aria-label="Move up">↑</button>
                              <button onClick={() => moveSection(proj.id, sec.id, 1)} disabled={secIdx === arr.length - 1}
                                className="text-[#6E6E68] hover:text-[#F0F0EC] disabled:opacity-30 transition-colors text-xs px-1" aria-label="Move down">↓</button>
                              <button onClick={() => deleteSection(proj.id, sec.id)} className="text-[#6E6E68] hover:text-[#FF4444] transition-colors p-1" aria-label="Delete section">
                                <Trash2 size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                        <textarea
                          className={`${fieldBase} w-full resize-y min-h-[80px] bg-[#0A0A0A]`}
                          value={sec.content}
                          onChange={(e) => updateSection(proj.id, sec.id, { content: e.target.value })}
                          placeholder={isSummary ? "Project summary, shown on cards and in the quick-view modal." : "Section content…"}
                          style={{ fontFamily: FONT_SANS, fontSize: "13px" }}
                        />

                        {/* Per-section slides */}
                        <div className="flex flex-col gap-2 pt-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>
                              Slides <span className="normal-case opacity-60">({(sec.slides ?? []).length})</span>
                            </span>
                            <button
                              onClick={() => addSlideToSection(proj.id, sec.id)}
                              className="inline-flex items-center gap-1 text-[10px] text-[#C8FF00] hover:opacity-80 transition-opacity"
                              style={{ fontFamily: FONT_MONO }}
                            >
                              <Image size={10} /> Add slide
                            </button>
                          </div>
                          {(sec.slides ?? []).sort((a, b) => a.order - b.order).map((sl, slIdx) => (
                            <div key={sl.id} className="flex flex-col gap-2 p-3 bg-[#0A0A0A] border border-[rgba(255,255,255,0.06)] rounded-lg">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] text-[#6E6E68]" style={{ fontFamily: FONT_MONO }}>Slide {slIdx + 1}</span>
                                <button onClick={() => removeSectionSlide(proj.id, sec.id, sl.id)} className="text-[#6E6E68] hover:text-[#FF4444] transition-colors p-0.5">
                                  <Trash2 size={10} />
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  className={`${fieldBase} col-span-2`}
                                  value={sl.image_url}
                                  onChange={(e) => updateSectionSlide(proj.id, sec.id, sl.id, { image_url: normalizeDriveUrl(e.target.value) })}
                                  placeholder="Image URL or Drive link (auto-converted)"
                                  style={{ fontFamily: FONT_MONO, fontSize: "11px" }}
                                />
                                <input
                                  className={fieldBase}
                                  value={sl.image_alt}
                                  onChange={(e) => updateSectionSlide(proj.id, sec.id, sl.id, { image_alt: e.target.value })}
                                  placeholder="Alt text"
                                  style={{ fontFamily: FONT_SANS }}
                                />
                                <input
                                  className={fieldBase}
                                  value={sl.caption}
                                  onChange={(e) => updateSectionSlide(proj.id, sec.id, sl.id, { caption: e.target.value })}
                                  placeholder="Caption (optional)"
                                  style={{ fontFamily: FONT_SANS }}
                                />
                              </div>
                              {sl.image_url && (
                                <img src={sl.image_url} alt={sl.image_alt} className="w-full h-24 object-cover rounded-md border border-[rgba(255,255,255,0.06)]" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="flex items-center gap-4 sticky bottom-0 bg-[#0A0A0A] py-4 border-t border-[rgba(255,255,255,0.06)]">
        <button
          onClick={onSave}
          disabled={saveStatus === "saving" || !tableExists}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#C8FF00] text-[#0A0A0A] text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
          style={{ fontFamily: FONT_MONO }}
        >
          <Save size={13} /> Save projects
        </button>
        <SaveBadge status={saveStatus} errorMsg={errorMsg} />
      </div>
    </div>
  );
}

// ─── Shards tab ───────────────────────────────────────────────────────────────
// Image URLs keyed by shard index (0 to 5). Stored in site_content row id="shards".

interface ShardsTabProps {
  images: Record<string, string>;
  onChange: (images: Record<string, string>) => void;
  onSave: () => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
  errorMsg?: string;
}

function ShardsTab({ images, onChange, onSave, saveStatus, errorMsg }: ShardsTabProps) {
  function set(id: number, url: string) {
    onChange({ ...images, [String(id)]: normalizeDriveUrl(url.trim()) });
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base text-[#F0F0EC] font-medium" style={{ fontFamily: FONT_MONO }}>Shard Photos</h2>
          <p className="text-xs text-[#6E6E68]" style={{ fontFamily: FONT_SANS }}>
            Paste a direct image URL or Google Drive share link for each project photo. Leave blank to show a placeholder.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <SaveBadge status={saveStatus} errorMsg={errorMsg} />
          <button
            onClick={onSave}
            disabled={saveStatus === "saving"}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#F2C230] text-[#34332F] text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C230]"
            style={{ fontFamily: FONT_MONO }}
          >
            <Save size={12} /> Save Photos
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {SHARDS.map((shard) => {
          const url = images[String(shard.id)] ?? "";
          return (
            <div key={shard.id} className="flex flex-col gap-3 p-4 border border-[rgba(255,255,255,0.07)] rounded-md bg-[#1a1a1a]">
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-[#F2C230] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>{shard.figNum}</span>
                <span className="text-xs text-[#F0F0EC] font-medium" style={{ fontFamily: FONT_MONO }}>{shard.title}</span>
                <span className="text-[10px] text-[#6E6E68] border border-[rgba(255,255,255,0.08)] px-1.5 py-0.5 ml-auto" style={{ fontFamily: FONT_MONO }}>{shard.tag}</span>
              </div>
              <div className="flex gap-3 items-start">
                {/* Preview */}
                <div
                  className="shrink-0 w-20 h-14 rounded overflow-hidden border border-[rgba(255,255,255,0.08)] flex items-center justify-center"
                  style={{ background: url ? "transparent" : "#1E2416" }}
                >
                  {url ? (
                    <img src={url} alt={shard.altText} className="w-full h-full object-cover" />
                  ) : (
                    <Image size={16} className="text-[#6E6E68]" />
                  )}
                </div>
                {/* URL input */}
                <div className="flex-1">
                  <input
                    type="url"
                    placeholder="https://… or Google Drive share link"
                    value={url}
                    onChange={(e) => set(shard.id, e.target.value)}
                    className="w-full bg-[#111] border border-[rgba(255,255,255,0.1)] text-[#F0F0EC] text-xs px-3 py-2 focus:outline-none focus:border-[#F2C230] transition-colors placeholder:text-[#4E4E4E]"
                    style={{ fontFamily: FONT_SANS }}
                  />
                  <p className="text-[10px] text-[#6E6E68] mt-1.5" style={{ fontFamily: FONT_SANS }}>
                    Alt: {shard.altText}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Layout tab ─────────────────────────────────────────────────────────────

function LayoutTab({ layout, projects, onChange, onSave, saveStatus, errorMsg }: {
  layout: Record<string, string>;
  projects: ProjectDraft[];
  onChange: (l: Record<string, string>) => void;
  onSave: () => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
  errorMsg?: string;
}) {
  const set = (k: string, v: string) => onChange({ ...layout, [k]: v });
  const num = (k: string, d: number) => {
    const v = parseFloat(layout[k]);
    return Number.isFinite(v) ? v : d;
  };

  const fieldBase = "w-full bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-md text-[#F0F0EC] text-sm px-3 py-2 focus:outline-none focus:border-[#C8FF00] transition-colors";
  const labelBase = "text-xs text-[#6E6E68] uppercase tracking-widest";

  const globalMode = (layout.media_side || "alternate").toLowerCase();

  // Records that read the shared media renderer: projects plus the two teams.
  const records = [
    ...projects.map((p) => ({ key: `side_${p.id}`, name: p.title || p.id, group: "Project" })),
    ...PORTFOLIO.teams.map((t) => ({ key: `side_${t.id}`, name: t.team, group: "Team" })),
  ];

  const SideSelect = ({ k, includeInherit }: { k: string; includeInherit: boolean }) => (
    <select className={fieldBase} value={layout[k] || (includeInherit ? "inherit" : "alternate")} onChange={(e) => set(k, e.target.value)}>
      {includeInherit && <option value="inherit">Inherit global</option>}
      <option value="left">Media left</option>
      <option value="right">Media right</option>
      {!includeInherit && <option value="alternate">Alternate</option>}
    </select>
  );

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <p className="text-xs text-[#6E6E68]" style={{ fontFamily: FONT_MONO }}>
        One shared media renderer drives projects, work experience, and project teams. Changes save to Supabase and appear on the live site.
      </p>

      <section className="flex flex-col gap-4 border border-[rgba(255,255,255,0.06)] rounded-xl p-5">
        <h3 className="text-xs text-[#C8FF00] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Global media side</h3>
        <div className="flex flex-col gap-1.5" style={{ fontFamily: FONT_MONO }}>
          <label className={labelBase}>Default for every section</label>
          <select className={fieldBase} value={globalMode} onChange={(e) => set("media_side", e.target.value)}>
            <option value="left">Media left</option>
            <option value="right">Media right</option>
            <option value="alternate">Alternate</option>
          </select>
        </div>
      </section>

      <section className="flex flex-col gap-4 border border-[rgba(255,255,255,0.06)] rounded-xl p-5">
        <h3 className="text-xs text-[#C8FF00] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Per record override</h3>
        <div className="grid grid-cols-2 gap-3" style={{ fontFamily: FONT_MONO }}>
          {records.map((r) => (
            <div key={r.key} className="flex flex-col gap-1.5">
              <label className={labelBase}>{r.group}: {r.name}</label>
              <SideSelect k={r.key} includeInherit />
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4 border border-[rgba(255,255,255,0.06)] rounded-xl p-5">
        <h3 className="text-xs text-[#C8FF00] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Self initiated builds folder</h3>
        <div className="grid grid-cols-2 gap-3" style={{ fontFamily: FONT_MONO }}>
          <div className="flex flex-col gap-1.5 col-span-2">
            <label className={labelBase}>Folder label</label>
            <input className={fieldBase} value={layout.folder_label ?? "Self initiated builds"} onChange={(e) => set("folder_label", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelBase}>Thumbnail count (2 to 4): {num("folder_count", 4)}</label>
            <input type="range" min={2} max={4} step={1} value={num("folder_count", 4)} onChange={(e) => set("folder_count", e.target.value)} className="accent-[#C8FF00]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelBase}>Rotation deg: {num("folder_rotation", 7)}</label>
            <input type="range" min={0} max={16} step={1} value={num("folder_rotation", 7)} onChange={(e) => set("folder_rotation", e.target.value)} className="accent-[#C8FF00]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelBase}>Fan distance px: {num("folder_fan", 84)}</label>
            <input type="range" min={40} max={160} step={2} value={num("folder_fan", 84)} onChange={(e) => set("folder_fan", e.target.value)} className="accent-[#C8FF00]" />
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={saveStatus === "saving"}
          className="inline-flex items-center gap-2 bg-[#C8FF00] text-black text-xs font-medium px-4 py-2 rounded-md hover:bg-[#B8EF00] transition-colors disabled:opacity-50"
          style={{ fontFamily: FONT_MONO }}
        >
          <Save size={13} /> Save layout
        </button>
        <SaveBadge status={saveStatus} errorMsg={errorMsg} />
      </div>
    </div>
  );
}

// ─── Main editor shell ────────────────────────────────────────────────────────

function EditorShell() {
  const [tab, setTab] = useState<EditorTab>("content");
  const [dataLoaded, setDataLoaded] = useState(false);

  // Save status + diagnostic error message for each tab
  const [contentSave, setContentSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [contentErr,  setContentErr]  = useState("");
  const [designSave,  setDesignSave]  = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [designErr,   setDesignErr]   = useState("");
  const [personaSave, setPersonaSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [personaErr,  setPersonaErr]  = useState("");
  const [projectSave, setProjectSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [projectErr,  setProjectErr]  = useState("");
  const [shardSave,   setShardSave]   = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [shardErr,    setShardErr]    = useState("");
  const [layoutSave,  setLayoutSave]  = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [layoutErr,   setLayoutErr]   = useState("");

  const [layout, setLayout] = useState<Record<string, string>>({});
  const [tokens,   setTokens]   = useState<Record<string, string>>(DEFAULT_TOKENS);
  const [shardImages, setShardImages] = useState<Record<string, string>>({});
  const [personas, setPersonas] = useState<PersonaDraft[]>([]);
  const [projects,   setProjects]  = useState<ProjectDraft[]>([]);
  const [projectTableExists, setProjectTableExists] = useState(true);
  const [projectsSeeded, setProjectsSeeded] = useState(false);

  const [draft, setDraft] = useState<ContentDraft>({
    hero_name: PORTFOLIO.hero.name,
    hero_role: PORTFOLIO.hero.role,
    hero_institution: PORTFOLIO.hero.institution,
    hero_year: PORTFOLIO.hero.year,
    hero_tagline: PORTFOLIO.hero.tagline,
    hero_photo_url: "",
    hero_photo_size: 240,
    about_bio: PORTFOLIO.about.bio,
    contact_email: "wdakare@bu.edu",
    github_url: "https://github.com",
    linkedin_url: "https://linkedin.com",
    resume_url: "#",
  });

  // Load existing data from Supabase on mount.
  // Use .maybeSingle() instead of .single() so a missing row returns null
  // rather than a 406 error, the row may not exist yet on first run.
  useEffect(() => {
    (async () => {
      const [
        { data: tokenRow },
        { data: contentRows },
        { data: personaRows },
        { data: projectRows, error: projectRowsErr },
      ] = await Promise.all([
        supabase.from("design_tokens").select("tokens").eq("id", "tokens").maybeSingle(),
        supabase.from("site_content").select("id, data"),
        supabase.from("personas").select("*").order("order"),
        supabase.from("projects").select("*").order("order"),
      ]);

      // Merge over defaults so font/type-scale tokens exist even for legacy rows.
      if (tokenRow?.tokens) setTokens({ ...DEFAULT_TOKENS, ...(tokenRow.tokens as Record<string, string>) });

      if (contentRows) {
        const hero = contentRows.find((r) => r.id === "hero")?.data as Partial<ContentDraft> | undefined;
        if (hero) setDraft((d) => ({
          ...d,
          ...hero,
          hero_photo_size: Number((hero as Record<string, unknown>).hero_photo_size) || d.hero_photo_size,
        }));

        const shards = contentRows.find((r) => r.id === "shards")?.data as Record<string, string> | undefined;
        if (shards) setShardImages(shards);

        const layoutRow = contentRows.find((r) => r.id === "layout")?.data as Record<string, string> | undefined;
        if (layoutRow) setLayout(layoutRow);
      }

      if (personaRows?.length) setPersonas(personaRows as PersonaDraft[]);

      // Detect whether the projects table exists
      if (projectRowsErr) {
        // PostgREST returns code 42P01 (relation does not exist) or PGRST200
        const code = (projectRowsErr as { code?: string }).code ?? "";
        if (code === "42P01" || code === "PGRST200" || projectRowsErr.message?.includes("does not exist")) {
          setProjectTableExists(false);
        }
      } else if (projectRows) {
        if (projectRows.length > 0) {
          setProjects(projectRows.map((r) => ({
            id: r.id,
            tier: (r.tier as ProjectDraft["tier"]) ?? "more",
            title: r.title ?? "",
            subtitle: r.subtitle ?? "",
            tags: (r.tags as string[]) ?? [],
            metrics: (r.metrics as Array<{ value: string; label: string }>) ?? [],
            hero_image: r.hero_image ?? "",
            hero_image_alt: r.hero_image_alt ?? "",
            video_url: r.video_url ?? "",
            sections: (r.sections as ProjectSection[]) ?? DEFAULT_SECTIONS,
            order: r.order ?? 0,
          })));
        } else {
          // Table exists but is empty, seed from hardcoded PORTFOLIO so existing
          // projects appear in the editor immediately. User must save to persist.
          setProjectsSeeded(true);
          setProjects(PORTFOLIO.projects.map((p, i) => ({
            id: p.slug,
            tier: p.tier,
            title: p.title,
            subtitle: p.subtitle,
            tags: p.tags,
            metrics: p.metrics,
            hero_image: p.hero_image,
            hero_image_alt: p.hero_image_alt,
            video_url: p.video_url,
            sections: [
              { id: "summary",     title: "Summary",             content: p.summary,      order: 0 },
              { id: "problem",     title: "Problem",             content: p.problem,      order: 1 },
              { id: "constraints", title: "Constraints",         content: p.constraints,  order: 2 },
              { id: "approach",    title: "Approach",            content: p.approach,     order: 3 },
              { id: "iteration",   title: "Iteration & Failure", content: p.iteration,    order: 4 },
              { id: "result",      title: "Result",              content: p.result,       order: 5 },
              { id: "future_work", title: "Future Work",         content: p.future_work,  order: 6 },
            ].filter((s) => s.content),
            order: i,
          })));
        }
      }
      // Only unlock editing UI after all data is set, prevents a race condition
      // where the user starts typing before the Supabase fetch returns and overwrites them.
      setDataLoaded(true);
    })();
  }, []);

  function fmtErr(err: { code?: string; message?: string } | null | undefined): string {
    if (!err) return "Unknown error";
    const code = err.code ? `[${err.code}] ` : "";
    return `${code}${err.message ?? "Unknown error"}`;
  }

  async function saveContent() {
    setContentSave("saving"); setContentErr("");
    try {
      const { error } = await supabase.from("site_content").upsert([
        { id: "hero", section: "hero", data: {
            hero_name: draft.hero_name, hero_role: draft.hero_role,
            hero_institution: draft.hero_institution, hero_year: draft.hero_year,
            hero_tagline: draft.hero_tagline, about_bio: draft.about_bio,
            contact_email: draft.contact_email,
            hero_photo_url: draft.hero_photo_url, hero_photo_size: draft.hero_photo_size,
            github_url: draft.github_url, linkedin_url: draft.linkedin_url, resume_url: draft.resume_url,
        }},
      ]);
      if (error) {
        const msg = fmtErr(error);
        setContentErr(msg); setContentSave("error");
        toast.error(`Content not saved. ${msg}`);
      } else {
        setContentSave("saved");
        toast.success("Content saved to Supabase");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setContentErr(msg); setContentSave("error");
      toast.error(`Content not saved. ${msg}`);
    }
    setTimeout(() => setContentSave("idle"), 4000);
  }

  async function saveShards() {
    setShardSave("saving"); setShardErr("");
    try {
      const { error } = await supabase.from("site_content").upsert([
        { id: "shards", section: "shards", data: shardImages },
      ]);
      if (error) {
        const msg = fmtErr(error);
        setShardErr(msg); setShardSave("error");
        toast.error(`Shard photos not saved. ${msg}`);
      } else {
        setShardSave("saved");
        toast.success("Shard photos saved");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setShardErr(msg); setShardSave("error");
      toast.error(`Shard photos not saved. ${msg}`);
    }
    setTimeout(() => setShardSave("idle"), 4000);
  }

  async function saveLayout() {
    setLayoutSave("saving"); setLayoutErr("");
    try {
      const { error } = await supabase.from("site_content").upsert([
        { id: "layout", section: "layout", data: layout },
      ]);
      if (error) {
        const msg = fmtErr(error);
        setLayoutErr(msg); setLayoutSave("error");
        toast.error(`Layout not saved. ${msg}`);
      } else {
        setLayoutSave("saved");
        toast.success("Layout saved to Supabase");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setLayoutErr(msg); setLayoutSave("error");
      toast.error(`Layout not saved. ${msg}`);
    }
    setTimeout(() => setLayoutSave("idle"), 4000);
  }

  async function savePersonas() {
    setPersonaSave("saving"); setPersonaErr("");
    try {
      const { error } = await supabase.from("personas").upsert(personas);
      if (error) {
        const msg = fmtErr(error);
        setPersonaErr(msg); setPersonaSave("error");
        toast.error(`Personas not saved. ${msg}`);
      } else {
        setPersonaSave("saved");
        toast.success("Personas saved to Supabase");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setPersonaErr(msg); setPersonaSave("error");
      toast.error(`Personas not saved. ${msg}`);
    }
    setTimeout(() => setPersonaSave("idle"), 4000);
  }

  async function saveTokens() {
    setDesignSave("saving"); setDesignErr("");
    try {
      const { error } = await supabase.from("design_tokens").upsert({ id: "tokens", tokens });
      if (error) {
        const msg = fmtErr(error);
        setDesignErr(msg); setDesignSave("error");
        toast.error(`Design tokens not saved. ${msg}`);
      } else {
        setDesignSave("saved");
        toast.success("Design tokens saved to Supabase");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setDesignErr(msg); setDesignSave("error");
      toast.error(`Design tokens not saved. ${msg}`);
    }
    setTimeout(() => setDesignSave("idle"), 4000);
  }

  async function saveProjects() {
    setProjectSave("saving"); setProjectErr("");

    // Alt text is required for every image. Block the save (not silent) and
    // point at the first offending project so the user can fix it inline.
    for (const p of projects) {
      const name = p.title || p.id;
      if (p.hero_image && !p.hero_image_alt.trim()) {
        const msg = `Alt text required for the hero image on "${name}".`;
        setProjectErr(msg); setProjectSave("error");
        toast.error(`Projects not saved. ${msg}`);
        setTimeout(() => setProjectSave("idle"), 4000);
        return;
      }
      const badSlide = (p.sections ?? []).flatMap((s) => (s as { slides?: SectionSlide[] }).slides ?? [])
        .find((sl) => sl.image_url && !(sl.image_alt ?? "").trim());
      if (badSlide) {
        const msg = `Alt text required for a section image on "${name}".`;
        setProjectErr(msg); setProjectSave("error");
        toast.error(`Projects not saved. ${msg}`);
        setTimeout(() => setProjectSave("idle"), 4000);
        return;
      }
    }

    try {
      // Remove deleted projects from Supabase
      const { data: existing, error: fetchErr } = await supabase.from("projects").select("id");
      if (fetchErr) throw new Error(fmtErr(fetchErr));

      const existingIds = (existing ?? []).map((r: { id: string }) => r.id);
      const newIds = projects.map((p) => p.id);
      const toDelete = existingIds.filter((id) => !newIds.includes(id));
      if (toDelete.length) {
        const { error: delErr } = await supabase.from("projects").delete().in("id", toDelete);
        if (delErr) throw new Error(fmtErr(delErr));
      }

      const rows = projects.map((p) => ({
        id: p.id,
        tier: p.tier,
        title: p.title,
        subtitle: p.subtitle,
        tags: p.tags,
        metrics: p.metrics,
        hero_image: p.hero_image,
        hero_image_alt: p.hero_image_alt,
        video_url: p.video_url,
        sections: p.sections,
        order: p.order,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("projects").upsert(rows);
      if (error) throw new Error(fmtErr(error));
      setProjectsSeeded(false);
      setProjectSave("saved");
      toast.success(`${rows.length} project${rows.length !== 1 ? "s" : ""} saved to Supabase`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setProjectErr(msg);
      setProjectSave("error");
      toast.error(`Projects not saved. ${msg}`);
    }
    setTimeout(() => setProjectSave("idle"), 4000);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const tabDefs: { id: EditorTab; label: string; Icon: React.ElementType }[] = [
    { id: "content",  label: "Content",  Icon: FileText     },
    { id: "design",   label: "Design",   Icon: Palette      },
    { id: "shards",   label: "Shards",   Icon: Image        },
    { id: "personas", label: "Personas", Icon: Users        },
    { id: "projects", label: "Projects", Icon: FolderKanban },
    { id: "layout",   label: "Layout",   Icon: Columns      },
    { id: "preview",  label: "Preview",  Icon: Monitor      },
  ];

  // Block the editing UI until the initial Supabase fetch completes.
  // Without this guard the fetch can return mid-edit and overwrite the user's changes.
  if (!dataLoaded) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center gap-3">
        <span className="w-4 h-4 border-2 border-[#C8FF00] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-[#6E6E68] animate-pulse" style={{ fontFamily: FONT_MONO }}>Loading editor…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F0F0EC]" style={{ fontFamily: FONT_SANS }}>
      <Toaster position="bottom-right" theme="dark" richColors closeButton />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0A0A0A]/95 backdrop-blur-sm border-b border-[rgba(255,255,255,0.08)] h-12 flex items-center px-6 gap-4">
        <span className="text-sm font-medium" style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}>
          William Dakare · Editor
        </span>
        <span className="text-[10px] text-[#6E6E68] border border-[rgba(255,255,255,0.1)] px-2 py-0.5 rounded-md" style={{ fontFamily: FONT_MONO }}>
          /edit-w9k3x7m
        </span>
        <div className="ml-auto flex items-center gap-2">
          <ShieldCheck size={12} className="text-[#C8FF00]" />
          <span className="text-xs text-[#6E6E68]" style={{ fontFamily: FONT_MONO }}>MFA verified</span>
          <button onClick={signOut} className="ml-4 inline-flex items-center gap-1.5 text-xs text-[#6E6E68] hover:text-[#F0F0EC] transition-colors" style={{ fontFamily: FONT_MONO }}>
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-3rem)]">
        {/* Sidebar tabs */}
        <aside className="w-40 border-r border-[rgba(255,255,255,0.06)] flex flex-col pt-4 gap-1 px-2 shrink-0">
          {tabDefs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-3 py-2 text-xs rounded-md transition-colors text-left ${tab === id ? "bg-[rgba(200,255,0,0.12)] text-[#C8FF00]" : "text-[#6E6E68] hover:text-[#F0F0EC] hover:bg-[#1C1C1C]"}`}
              style={{ fontFamily: FONT_MONO }}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-8">
          {tab === "content" && (
            <ContentTab draft={draft} onChange={setDraft} onSave={saveContent} saveStatus={contentSave} errorMsg={contentErr} />
          )}
          {tab === "design" && (
            <DesignTab tokens={tokens} onChange={setTokens} onSave={saveTokens} saveStatus={designSave} errorMsg={designErr} />
          )}
          {tab === "shards" && (
            <ShardsTab images={shardImages} onChange={setShardImages} onSave={saveShards} saveStatus={shardSave} errorMsg={shardErr} />
          )}
          {tab === "personas" && (
            <PersonasTab personas={personas} onChange={setPersonas} onSave={savePersonas} saveStatus={personaSave} errorMsg={personaErr} />
          )}
          {tab === "projects" && (
            <ProjectsTab
              projects={projects}
              onChange={setProjects}
              onSave={saveProjects}
              saveStatus={projectSave}
              errorMsg={projectErr}
              tableExists={projectTableExists}
              seeded={projectsSeeded}
            />
          )}
          {tab === "layout" && (
            <LayoutTab layout={layout} projects={projects} onChange={setLayout} onSave={saveLayout} saveStatus={layoutSave} errorMsg={layoutErr} />
          )}
          {tab === "preview" && (
            <PreviewTab exportData={() => ({ tokens, layout, personas, projects, content: draft, shards: shardImages })} />
          )}
        </main>
      </div>
    </div>
  );
}

// ─── EditPage root ─────────────────────────────────────────────────────────────

export default function EditPage() {
  const [step, setStep] = useState<AuthStep>("credentials");
  const [factorId, setFactorId] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal?.currentLevel === "aal2") { setStep("authenticated"); }
        else if (aal?.nextLevel === "aal2") {
          const { data: factors } = await supabase.auth.mfa.listFactors();
          const totp = (factors?.totp as Factor[] | undefined)?.[0];
          if (totp) { setFactorId(totp.id); setStep("mfa-verify"); }
          else setStep("mfa-enroll");
        } else {
          setStep("mfa-enroll");
        }
      }
      setChecking(false);
    })();
  }, []);

  function handleCredentials(nextStep: AuthStep, fid?: string) {
    if (fid) setFactorId(fid);
    setStep(nextStep);
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <span className="text-xs text-[#6E6E68] animate-pulse" style={{ fontFamily: FONT_MONO }}>Checking session…</span>
      </div>
    );
  }

  if (step === "authenticated") return <EditorShell />;

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {step === "credentials" && <CredentialsScreen onSuccess={handleCredentials} />}
        {step === "mfa-enroll"  && <MfaEnrollScreen   onSuccess={() => setStep("authenticated")} onRedirectToVerify={(fid) => { setFactorId(fid); setStep("mfa-verify"); }} />}
        {step === "mfa-verify"  && <MfaVerifyScreen   factorId={factorId} onSuccess={() => setStep("authenticated")} />}
      </div>
    </div>
  );
}
