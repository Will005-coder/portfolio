import { useState, useEffect, useRef, createContext, useContext, useCallback } from "react";
import { createPortal } from "react-dom";
import { createHashRouter, RouterProvider, Navigate, useNavigate, useLocation, Outlet, Link, useOutletContext } from "react-router";
import {
  Menu, X, ArrowRight, Play, ExternalLink, Mail, Github, Linkedin, FileText,
  ChevronDown, Zap, Building2, Rocket, GraduationCap, Users, Copy, Check,
} from "lucide-react";
import { PORTFOLIO, type Project, type ProjectTeam } from "./content";

import EditPage from "./EditPage";
import { ShardHero } from "./ShardHeader";
import { supabase } from "../lib/supabase";

// Smooth-scroll helper, never touches window.location, safe with hash router
function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

// Prevent any stray hash-anchor clicks from corrupting the hash router URL
if (typeof window !== "undefined") {
  document.addEventListener("click", (e) => {
    const a = (e.target as Element).closest("a");
    if (!a) return;
    const href = a.getAttribute("href") ?? "";
    // Only intercept bare hash anchors like "#foo" or "#", not full URLs or mailto
    if (href.startsWith("#") && !href.startsWith("#/")) {
      e.preventDefault();
      const id = href.slice(1);
      if (id) document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }
  });
}

// Every font reference on the site resolves to one of the three tokens.
// Zero hardcoded families: change a token, the whole site follows.
const FONT_SERIF   = "var(--font-display)"; // display / headings
const FONT_HEADING = "var(--font-display)"; // display / headings (unified to 3 fonts)
const FONT_MONO    = "var(--font-data)";    // numbers, metadata, tags, code
const FONT_SANS    = "var(--font-body)";    // paragraphs, reading

// Default font-token stacks, merged under any saved editor overrides so the
// tokens always exist and always carry a real fallback stack.
const DEFAULT_FONT_TOKENS: Record<string, string> = {
  "--font-display": '"Instrument Serif", Georgia, "Times New Roman", serif',
  "--font-body": '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
  "--font-data": '"IBM Plex Mono", "SFMono-Regular", "Courier New", monospace',
  "--type-scale": "1",
};

const GOOGLE_FONT_WEIGHTS = "wght@400;500;600;700;800";
const SYSTEM_FONTS = new Set([
  "system-ui", "-apple-system", "segoe ui", "georgia", "times new roman",
  "courier new", "serif", "sans-serif", "monospace", "sfmono-regular", "arial",
]);

// Pull the primary family name out of a CSS font stack: `"Archivo", ui-sans` -> Archivo
function firstFamily(stack: string): string {
  const first = stack.split(",")[0]?.trim() ?? "";
  return first.replace(/^['"]|['"]$/g, "");
}

// Load a Google webfont on demand (font-display: swap), once per family.
function ensureGoogleFont(family: string) {
  if (typeof document === "undefined" || !family) return;
  if (SYSTEM_FONTS.has(family.toLowerCase())) return;
  const id = "gf-" + family.replace(/\s+/g, "-").toLowerCase();
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:${GOOGLE_FONT_WEIGHTS}&display=swap`;
  document.head.appendChild(link);
}

// ─── DB project types ─────────────────────────────────────────────────────────

interface DbSection {
  id: string;
  title: string;
  content: string;
  order: number;
  slides?: Array<{ id: string; image_url: string; image_alt: string; caption: string; order: number }>;
}

interface DbProject {
  id: string;
  tier: "hero" | "featured" | "more";
  title: string;
  subtitle: string;
  tags: string[];
  metrics: Array<{ value: string; label: string }>;
  hero_image: string;
  hero_image_alt: string;
  video_url: string;
  sections: DbSection[];
  order: number;
}

type RenderProject = Project & { _dbSections?: DbSection[] };

function dbToRender(db: DbProject): RenderProject {
  const sec = (id: string) => db.sections.find((s) => s.id === id)?.content ?? "";
  return {
    slug: db.id,
    tier: db.tier,
    title: db.title,
    subtitle: db.subtitle,
    summary: sec("summary"),
    problem: sec("problem"),
    constraints: sec("constraints"),
    approach: sec("approach"),
    iteration: sec("iteration"),
    result: sec("result"),
    future_work: sec("future_work"),
    metrics: db.metrics,
    tags: db.tags,
    hero_image: db.hero_image,
    hero_image_alt: db.hero_image_alt,
    gallery: [],
    video_url: db.video_url,
    _dbSections: db.sections,
  };
}

// ─── Feature flags ────────────────────────────────────────────────────────────
const SHOW_AVAILABILITY_BADGE = false; // "Open to opportunities" pulsing badge in nav

// ─── Themes ──────────────────────────────────────────────────────────────────

type ThemeId = "dark" | "light" | "warm" | "signal" | "blueprint" | "plasma";

interface ThemeDef {
  label: string;
  swatch: string;
  pattern: "none" | "grid" | "dots" | "diagonal" | "radial" | "wave";
  vars: Record<string, string>;
}

const THEMES: Record<ThemeId, ThemeDef> = {
  dark: {
    label: "Dark",
    swatch: "#5FD3C4",
    pattern: "none",
    vars: {
      // Semantic 11-token palette (mirrors theme.css defaults)
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
      // Tailwind contract tokens (needed so THEMES override the theme.css vars)
      "--background": "#241E19", "--foreground": "#F2EDE4",
      "--card": "#EAE5DC", "--card-foreground": "#1E1915",
      "--secondary": "#2E2720", "--secondary-foreground": "#F2EDE4",
      "--muted": "#2E2720", "--muted-foreground": "#A8A49E",
      "--primary": "#5FD3C4", "--primary-foreground": "#0C1F1E",
      "--accent": "#3CBDB0", "--accent-foreground": "#0C1F1E",
      "--border": "#38322B", "--ring": "#5FD3C4",
    },
  },
  light: {
    label: "Light",
    swatch: "#B89A6A",
    pattern: "none",
    vars: {
      "--background": "#FAF6ED", "--foreground": "#0D0D0A",
      "--card": "#F3EEE2", "--card-foreground": "#0D0D0A",
      "--secondary": "#EDE7D8", "--secondary-foreground": "#0D0D0A",
      "--muted": "#EDE7D8", "--muted-foreground": "#5C5848",
      "--primary": "#B89A6A", "--primary-foreground": "#FAF6ED",
      "--accent": "#E5DBCB", "--accent-foreground": "#0D0D0A",
      "--border": "rgba(0,0,0,0.10)", "--ring": "#B89A6A",
    },
  },
  warm: {
    label: "Warm",
    swatch: "#DDD0B8",
    pattern: "none",
    vars: {
      "--background": "#141210", "--foreground": "#DDD0B8",
      "--card": "#1C1916", "--card-foreground": "#DDD0B8",
      "--secondary": "#221E19", "--secondary-foreground": "#DDD0B8",
      "--muted": "#221E19", "--muted-foreground": "#8A7D66",
      "--primary": "#C8FF00", "--primary-foreground": "#141210",
      "--accent": "#1F1C12", "--accent-foreground": "#C8FF00",
      "--border": "rgba(221,208,184,0.09)", "--ring": "#C8FF00",
    },
  },
  signal: {
    label: "Signal",
    swatch: "#E8362A",
    pattern: "diagonal",
    vars: {
      "--background": "#0C0808", "--foreground": "#F5EDEC",
      "--card": "#160D0C", "--card-foreground": "#F5EDEC",
      "--secondary": "#1A0E0D", "--secondary-foreground": "#F5EDEC",
      "--muted": "#1A0E0D", "--muted-foreground": "#7A6866",
      "--primary": "#E8362A", "--primary-foreground": "#F5EDEC",
      "--accent": "#280C0A", "--accent-foreground": "#E8362A",
      "--border": "rgba(232,54,42,0.18)", "--ring": "#E8362A",
    },
  },
  blueprint: {
    label: "Blueprint",
    swatch: "#3B82FF",
    pattern: "dots",
    vars: {
      "--background": "#07090F", "--foreground": "#E2ECFF",
      "--card": "#0C1020", "--card-foreground": "#E2ECFF",
      "--secondary": "#101828", "--secondary-foreground": "#E2ECFF",
      "--muted": "#101828", "--muted-foreground": "#5E7090",
      "--primary": "#3B82FF", "--primary-foreground": "#07090F",
      "--accent": "#0A1530", "--accent-foreground": "#3B82FF",
      "--border": "rgba(59,130,255,0.18)", "--ring": "#3B82FF",
    },
  },
  plasma: {
    label: "Plasma",
    swatch: "#D929E8",
    pattern: "radial",
    vars: {
      "--background": "#0B0710", "--foreground": "#F2E8FF",
      "--card": "#120B18", "--card-foreground": "#F2E8FF",
      "--secondary": "#1A1024", "--secondary-foreground": "#F2E8FF",
      "--muted": "#1A1024", "--muted-foreground": "#826890",
      "--primary": "#D929E8", "--primary-foreground": "#0B0710",
      "--accent": "#200B28", "--accent-foreground": "#D929E8",
      "--border": "rgba(217,41,232,0.18)", "--ring": "#D929E8",
    },
  },
};

const THEME_ORDER: ThemeId[] = ["dark", "light", "warm", "signal", "blueprint", "plasma"];

// ─── Audience modes ───────────────────────────────────────────────────────────

type AudienceId = "companies" | "startups" | "grad" | "networking";

const AUDIENCE: Record<AudienceId, {
  label: string; Icon: React.ElementType;
  tagline: string; pitch: string; highlight: string;
}> = {
  companies: {
    label: "Companies", Icon: Building2,
    tagline: "Seeking full-time roles in robotics R&D, mechatronics, and hardware engineering.",
    pitch: "I prototype fast, validate with data, and ship hardware that works. FEA-validated models within 8% of experiment in six weeks.",
    highlight: "byu-nsr-reu-compliant-mechanisms",
  },
  startups: {
    label: "Startups", Icon: Rocket,
    tagline: "Building 0→1 hardware? I bring compliant mechanisms, controls, and DFM under one roof.",
    pitch: "350% bend angle improvement at 4 mm diameter. I build the rig, write the MATLAB, and machine the part, then iterate.",
    highlight: "bu-bronchoscopy-soft-robot",
  },
  grad: {
    label: "Grad School", Icon: GraduationCap,
    tagline: "Targeting MS/PhD programs in robotics, compliant mechanisms, and soft actuation.",
    pitch: "NSF REU: validated kinematic and quasi-static models for cable-driven isoperimetric soft robots, handed off as a research baseline.",
    highlight: "byu-nsr-reu-compliant-mechanisms",
  },
  networking: {
    label: "Networking", Icon: Users,
    tagline: "Always down to talk soft robots, compliant mechanisms, and hardware side projects.",
    pitch: "I build things that move. Let's swap ideas, compliant mechanisms, VLA grippers, maze solvers, whatever you're hacking on.",
    highlight: "self-initiated-builds",
  },
};

// ─── Context ──────────────────────────────────────────────────────────────────

type PersonaMap = typeof AUDIENCE;

interface AppCtx {
  theme: ThemeId; setTheme: (t: ThemeId) => void;
  audience: AudienceId; setAudience: (a: AudienceId) => void;
  personas: PersonaMap;
  heroPhoto: { url: string; size: number };
  contentOverrides: Record<string, Record<string, string>>;
}

interface HowThinkItem {
  question: string;
  answer: string;
}

function parseHowThink(value: string | undefined): HowThinkItem[] {
  if (!value) return PORTFOLIO.how_think.questions;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return PORTFOLIO.how_think.questions;
    return parsed.filter((item): item is HowThinkItem =>
      typeof item === "object" && item !== null &&
      typeof (item as HowThinkItem).question === "string" &&
      typeof (item as HowThinkItem).answer === "string"
    );
  } catch {
    return PORTFOLIO.how_think.questions;
  }
}
const Ctx = createContext<AppCtx>({
  theme: "light", setTheme: () => {},
  audience: "companies", setAudience: () => {},
  personas: AUDIENCE,
  heroPhoto: { url: "", size: 240 },
  contentOverrides: {},
});

// ─── Shared media side-swap (Task 5) ────────────────────────────────────────────
// One global setting drives media placement across every modular section. Modes:
// "left" all media left, "right" all media right, "alternate" odd/even. A record
// may override with its own side; "inherit" (or empty) defers to the global mode.
// Returns flip = true meaning media sits on the RIGHT (text left) at >= lg width.
function resolveMediaFlip(globalMode: string | undefined, index: number, override?: string): boolean {
  const ov = override && override !== "inherit" ? override : undefined;
  const mode = (ov || globalMode || "alternate").toLowerCase();
  if (mode === "left") return false;
  if (mode === "right") return true;
  return index % 2 === 1; // alternate
}


// ─── Background patterns ──────────────────────────────────────────────────────

function ThemePattern({ pattern, primary }: { pattern: ThemeDef["pattern"]; primary: string }) {
  if (pattern === "none") return null;

  const p = encodeURIComponent(primary);

  const svgPatterns: Record<typeof pattern, string> = {
    none: "",
    grid: `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'><path d='M 48 0 L 0 0 0 48' fill='none' stroke='${p}' stroke-width='0.4' opacity='0.25'/></svg>`,
    dots: `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='12' cy='12' r='1' fill='${p}' opacity='0.35'/></svg>`,
    diagonal: `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><line x1='0' y1='24' x2='24' y2='0' stroke='${p}' stroke-width='0.5' opacity='0.20'/></svg>`,
    radial: "",
    wave: "",
  };

  if (pattern === "radial") {
    return (
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }} aria-hidden="true">
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse 60% 60% at 80% 20%, ${primary}18 0%, transparent 70%), radial-gradient(ellipse 40% 40% at 20% 80%, ${primary}10 0%, transparent 60%)`,
        }} />
      </div>
    );
  }

  const svg = svgPatterns[pattern];
  if (!svg) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, backgroundImage: `url("data:image/svg+xml,${svg}")` }}
      aria-hidden="true"
    />
  );
}

// ─── Theme picker ─────────────────────────────────────────────────────────────

function ThemePicker() {
  const { theme, setTheme } = useContext(Ctx);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 px-3 py-1.5 border border-border rounded-md text-xs text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ fontFamily: FONT_MONO }}
        aria-label="Choose colour theme"
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: THEMES[theme].swatch }} aria-hidden="true" />
        Theme
        <ChevronDown size={10} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 bg-card border border-border rounded-md p-3 flex flex-col gap-2 z-50 shadow-2xl min-w-[140px]">
          {THEME_ORDER.map((id) => (
            <button
              key={id}
              onClick={() => { setTheme(id); setOpen(false); }}
              className={`flex items-center gap-2.5 text-xs px-2 py-1.5 rounded-md transition-colors w-full text-left ${theme === id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
              style={{ fontFamily: FONT_MONO }}
            >
              <span className="w-3 h-3 rounded-full shrink-0 border border-border/50" style={{ background: THEMES[id].swatch }} aria-hidden="true" />
              {THEMES[id].label}
              {theme === id && <span className="ml-auto text-primary" style={{ fontSize: 8 }}>●</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Audience lens bar ────────────────────────────────────────────────────────

// ─── Persona gate (shown once on first visit, blurs page behind it) ───────────

function PersonaGate({ onDone }: { onDone: () => void }) {
  const { setAudience, personas } = useContext(Ctx);
  const ids = Object.keys(personas) as AudienceId[];
  const [selected, setSelected] = useState<AudienceId | null>(null);
  const [leaving, setLeaving] = useState(false);

  function choose(id: AudienceId) {
    setSelected(id);
    setAudience(id);
    setLeaving(true);
    setTimeout(onDone, 420);
  }

  const SHARD_CLIPS = [
    "polygon(4% 0%, 96% 6%, 100% 92%, 0% 100%)",
    "polygon(0% 4%, 100% 0%, 94% 96%, 6% 100%)",
    "polygon(2% 8%, 100% 0%, 98% 100%, 0% 92%)",
    "polygon(0% 0%, 98% 8%, 100% 96%, 2% 100%)",
  ];

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center px-6"
      style={{
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        opacity: leaving ? 0 : 1,
        transition: "opacity 0.4s ease",
      }}
      aria-modal="true"
      role="dialog"
      aria-label="Who's there?"
    >
      <div
        className="flex flex-col items-center gap-12 text-center"
        style={{
          transform: leaving ? "scale(1.05) translateY(-16px)" : "scale(1) translateY(0)",
          transition: "transform 0.4s cubic-bezier(0.32,0.72,0,1)",
        }}
      >
        <div className="flex flex-col gap-2 relative">
          <span className="text-xs text-primary uppercase tracking-widest absolute -top-6 left-1/2 -translate-x-1/2" style={{ fontFamily: FONT_MONO }}>
            Welcome
          </span>
          <h1
            className="text-foreground leading-none"
            style={{
              fontFamily: FONT_HEADING,
              fontSize: "clamp(2.5rem, 7vw, 4.5rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em"
            }}
          >
            WHO'S THERE?
          </h1>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto mt-2" style={{ fontFamily: FONT_SANS }}>
            Pick a lens and I'll tailor the pitch to what matters most to you.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-3xl">
          {ids.map((id, i) => {
            const p = personas[id];
            if (!p) return null;
            const { label, Icon } = p;
            const isSelected = selected === id;
            return (
              <button
                key={id}
                onClick={() => choose(id)}
                className={`relative flex flex-col items-center justify-center gap-4 px-4 py-8 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group overflow-hidden`}
                style={{
                  clipPath: SHARD_CLIPS[i % 4],
                  background: isSelected ? "var(--primary)" : "var(--card)",
                  color: isSelected ? "var(--primary-foreground)" : "var(--foreground)",
                  transform: isSelected ? "scale(1.05)" : "scale(1)",
                }}
              >
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: isSelected ? "transparent" : "rgba(255,255,255,0.04)" }}
                />
                <Icon size={24} className={isSelected ? "text-primary-foreground" : "text-primary group-hover:scale-110 transition-transform duration-300"} />
                <span className="text-sm font-semibold leading-tight uppercase tracking-wider" style={{ fontFamily: FONT_MONO }}>
                  {label}
                </span>
                
                {/* Crack highlight accent */}
                <div className="absolute top-0 left-0 w-full h-[2px] bg-white/10" style={{ transform: "rotate(-10deg) scale(1.5)", opacity: 0.5 }} />
              </button>
            );
          })}
        </div>

        <button
          onClick={() => choose("networking")}
          className="text-xs text-muted-foreground/50 hover:text-primary transition-colors underline underline-offset-4 tracking-widest uppercase mt-4"
          style={{ fontFamily: FONT_MONO }}
        >
          Skip, just browsing
        </button>
      </div>
    </div>
  );
}

// ─── Quick pitch overlay ──────────────────────────────────────────────────────

function QuickPitch({ onClose }: { onClose: () => void }) {
  const { audience, personas, contentOverrides } = useContext(Ctx);
  const mode = personas[audience] ?? AUDIENCE[audience];
  const { hero } = PORTFOLIO;
  const displayName = contentOverrides["hero"]?.hero_name || hero.name;

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-background/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="bg-card/90 backdrop-blur-md border border-border rounded-2xl max-w-lg w-full p-8 flex flex-col gap-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Quick pitch"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-primary uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>
              30-sec pitch · {mode.label}
            </span>
            <h2 style={{ fontFamily: FONT_SERIF, fontSize: "var(--fs-h3)" }} className="text-foreground leading-tight">
              {displayName}
            </h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors mt-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-md p-1">
            <X size={16} />
          </button>
        </div>

        <p className="text-foreground leading-relaxed" style={{ fontFamily: FONT_SANS, fontSize: "1.0625rem" }}>
          {mode.pitch}
        </p>

        <div className="grid grid-cols-2 gap-3 py-4 border-y border-border">
          {PORTFOLIO.projects.find((p) => p.tier === "hero")?.metrics.map((m) => (
            <div key={m.label} className="flex flex-col gap-0.5">
              <span className="font-medium" style={{ fontFamily: FONT_MONO, fontSize: "1.25rem", color: "var(--accent-surface)" }}>{m.value}</span>
              <span className="text-xs uppercase tracking-widest" style={{ fontFamily: FONT_MONO, color: "var(--ink-on-surface)", opacity: 0.6 }}>{m.label}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {hero.credentials.map((c) => (
            <span key={c} className="px-2 py-0.5 text-xs border border-border text-muted-foreground rounded-md" style={{ fontFamily: FONT_MONO }}>{c}</span>
          ))}
          {buildCtaLinks(contentOverrides["hero"] ?? {}).map((l) => {
            const isExternal = l.href.startsWith("http") || l.href.startsWith("mailto:");
            return (
              <a key={l.label} href={isExternal ? l.href : undefined} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noopener noreferrer" : undefined} onClick={!isExternal ? (e) => e.preventDefault() : undefined} className="px-2 py-0.5 text-xs border border-primary text-primary rounded-md hover:bg-accent transition-colors" style={{ fontFamily: FONT_MONO }}>
                {l.label} ↗
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Utility: animated reveal on scroll ──────────────────────────────────────

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function AnimatedMetric({ value, label }: { value: string; label: string }) {
  const { ref, visible } = useInView(0.3);
  return (
    <div
      ref={ref}
      className="flex flex-col gap-1 transition-all duration-700"
      style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(16px)" }}
    >
      <span className="text-primary leading-none font-medium" style={{ fontFamily: FONT_MONO, fontSize: "clamp(1.5rem, 3vw, 2.25rem)" }}>
        {value}
      </span>
      <span className="text-muted-foreground text-xs uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>
        {label}
      </span>
    </div>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-md"
      style={{ fontFamily: FONT_MONO }}
      aria-label="Copy email address"
    >
      {copied ? <Check size={12} className="text-primary" /> : <Copy size={12} />}
      {copied ? "Copied!" : email}
    </button>
  );
}

// ─── Social / CTA links (built from editable content overrides) ───────────────

function buildCtaLinks(ov: Record<string, string>) {
  return [
    { label: "Résumé",   href: ov.resume_url   || "#",                            type: "primary"   as const },
    { label: "GitHub",   href: ov.github_url   || "https://github.com",           type: "secondary" as const },
    { label: "LinkedIn", href: ov.linkedin_url || "https://linkedin.com",         type: "secondary" as const },
    { label: "Email",    href: `mailto:${ov.contact_email || "wdakare@bu.edu"}`,  type: "secondary" as const },
  ];
}

// ─── Tag filter ───────────────────────────────────────────────────────────────

function TagFilter({ allTags, active, onChange }: { allTags: string[]; active: string | null; onChange: (t: string | null) => void }) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-xs text-muted-foreground" style={{ fontFamily: FONT_MONO }}>Filter:</span>
      <button
        onClick={() => onChange(null)}
        className={`px-2.5 py-1 text-xs rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${active === null ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
        style={{ fontFamily: FONT_MONO }}
      >
        All
      </button>
      {allTags.map((t) => (
        <button
          key={t}
          onClick={() => onChange(active === t ? null : t)}
          className={`px-2.5 py-1 text-xs rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${active === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
          style={{ fontFamily: FONT_MONO }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ─── Utility tag chip ─────────────────────────────────────────────────────────

function Tag({ children, surface }: { children: React.ReactNode; surface?: "accent" }) {
  return (
    <span className={`inline-block px-2 py-0.5 text-xs border rounded-md ${surface ? "border-[var(--accent-surface)]" : "text-muted-foreground border-border"}`} style={{ color: surface ? "var(--on-accent)" : undefined, fontFamily: FONT_MONO, letterSpacing: "0.02em" }}>
      {children}
    </span>
  );
}

// ─── Video placeholder ────────────────────────────────────────────────────────

function VideoPlaceholder({ url }: { url: string }) {
  if (url) {
    return (
      <div className="relative w-full aspect-video bg-secondary rounded-md overflow-hidden">
        <iframe src={url} title="Project demo video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="absolute inset-0 w-full h-full border-0" />
      </div>
    );
  }
  return (
    <div className="relative w-full aspect-video bg-secondary rounded-md flex items-center justify-center group border border-border">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="w-14 h-14 rounded-full border border-border flex items-center justify-center group-hover:border-primary group-hover:text-primary transition-colors duration-200">
          <Play size={20} className="ml-1" />
        </div>
        <span className="text-xs" style={{ fontFamily: FONT_MONO }}>Demo video coming soon</span>
      </div>
    </div>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────────────

function Nav({ onPitch }: { onPitch: () => void }) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [activeSection, setActiveSection] = useState("home");
  const lastScroll = useRef(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setVisible(y < lastScroll.current || y < 80);
      lastScroll.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = ["home", "work", "contact"];
    const observers: IntersectionObserver[] = [];
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setActiveSection(id); }, { rootMargin: "-40% 0px -40% 0px" });
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [location.pathname]);

  const navLinks = [
    { id: "work", label: "Work", path: "/" },
    { id: "about", label: "About", path: "/" },
    { id: "contact", label: "Contact", path: "/" },
    { id: "resume", label: "Résumé", path: "/" },
  ];

  const handleNavClick = (id: string, path: string) => {
    if (path === "/about") {
      navigate("/about");
      window.scrollTo(0, 0);
    } else {
      if (location.pathname !== "/") {
        navigate("/");
        setTimeout(() => scrollTo(id), 100);
      } else {
        scrollTo(id);
      }
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-transform duration-300 border-b border-border/60 bg-background/80 backdrop-blur-lg" style={{ transform: visible ? "translateY(0)" : "translateY(-100%)" }}>
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-4">
        <button onClick={() => handleNavClick("home", "/")} className="text-sm font-medium text-foreground hover:text-primary transition-colors mr-auto focus-visible:outline-none" style={{ fontFamily: FONT_MONO, letterSpacing: "0.04em" }}>WD</button>

        {/* Availability badge, SHOW_AVAILABILITY_BADGE to re-enable */}
        {SHOW_AVAILABILITY_BADGE && (
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-xs text-muted-foreground" style={{ fontFamily: FONT_MONO }}>Open to opportunities</span>
          </div>
        )}

        <ul className="hidden md:flex items-center gap-6">
          {navLinks.map(({ id, label, path }) => {
            const isActive = (path === "/about" && location.pathname === "/about") || (location.pathname === "/" && activeSection === id);
            return (
              <li key={id}>
                <button
                  onClick={() => handleNavClick(id, path)}
                  className={`text-sm transition-colors duration-150 focus-visible:outline-none ${isActive ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                  style={{ fontFamily: FONT_MONO, letterSpacing: "0.03em" }}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>

        <button
          onClick={onPitch}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 border border-primary text-primary text-xs rounded-md hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ fontFamily: FONT_MONO }}
          aria-label="Open quick pitch overlay"
        >
          <Zap size={11} /> Quick Pitch
        </button>

        <ThemePicker />

        <button className="md:hidden text-foreground p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setOpen(!open)} aria-label="Toggle navigation">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-background px-6 pb-4 pt-2 flex flex-col gap-4">
          {navLinks.map(({ id, label, path }) => (
            <button key={id} onClick={() => { handleNavClick(id, path); setOpen(false); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left focus-visible:outline-none" style={{ fontFamily: FONT_MONO }}>{label}</button>
          ))}
          <button onClick={() => { setOpen(false); onPitch(); }} className="inline-flex items-center gap-1.5 text-xs text-primary" style={{ fontFamily: FONT_MONO }}>
            <Zap size={11} /> Quick Pitch
          </button>
        </div>
      )}
    </nav>
  );
}

// ─── Hero section ─────────────────────────────────────────────────────────────

function Hero({ onPitch }: { onPitch: () => void }) {
  const { hero } = PORTFOLIO;
  const { audience, personas, contentOverrides } = useContext(Ctx);
  const mode = personas[audience] ?? AUDIENCE[audience];
  const ov = contentOverrides["hero"] ?? {};
  const shardImages = contentOverrides["shards"] ?? {};
  const displayName = ov.hero_name || hero.name;
  const displayRole = ov.hero_role || hero.role;
  const displayYear = ov.hero_year || hero.year;
  const ctaLinks = buildCtaLinks(ov);

  return (
    <ShardHero
      displayName={displayName}
      displayRole={displayRole}
      displayYear={displayYear}
      tagline={mode.tagline}
      ctaLinks={ctaLinks}
      shardImages={shardImages}
      onPitch={onPitch}
    />
  );
}


// ─── Collapsible section ──────────────────────────────────────────────────────

function Collapsible({ label, children, defaultOpen = false }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full py-3 gap-4 focus-visible:outline-none focus-visible:text-primary group"
        aria-expanded={open}
      >
        <span className="text-xs text-primary uppercase tracking-widest group-hover:opacity-80 transition-opacity" style={{ fontFamily: FONT_MONO }}>{label}</span>
        <ChevronDown size={12} className={`text-muted-foreground transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-[1000px] pb-4" : "max-h-0"}`}>
        {children}
      </div>
    </div>
  );
}

// ─── Hero Project (Level 1) ────────────────────────────────────────────────────

interface CaseSection {
  label: string;
  text: string;
  image?: string;
  imageAlt?: string;
}

function HeroProject({ project }: { project: RenderProject }) {
  const { audience, contentOverrides } = useContext(Ctx);
  const mediaMode = contentOverrides["layout"]?.media_side;
  const isHighlighted = AUDIENCE[audience].highlight === project.slug;
  const dbSecs = project._dbSections;
  const summaryText = dbSecs ? (dbSecs.find((s) => s.id === "summary")?.content ?? project.summary) : project.summary;

  // Build the ordered case-study sections, each carrying its own picture
  const sections: CaseSection[] = (dbSecs
    ? dbSecs.filter((s) => s.id !== "summary" && s.content).sort((a, b) => a.order - b.order).map((s) => ({
        label: s.title,
        text: s.content,
        image: s.slides?.[0]?.image_url,
        imageAlt: s.slides?.[0]?.image_alt,
      }))
    : [
        { label: "Problem", text: project.problem },
        { label: "Constraints", text: project.constraints },
        { label: "Approach", text: project.approach },
        { label: "Iteration & Failure", text: project.iteration },
        { label: "Result", text: project.result },
        { label: "Future Work", text: project.future_work },
      ]
  )
    .filter((s) => s.text)
    .map((s, i) => ({
      ...s,
      // fall back to gallery images, then the hero image, so every row has a visual
      image: s.image || project.gallery[i]?.src || project.hero_image,
      imageAlt: s.imageAlt || project.gallery[i]?.alt || project.hero_image_alt,
    }));

  return (
    <section id="work" className="bg-secondary border-y border-border relative z-10">
      <div className="max-w-6xl mx-auto px-6 py-20 lg:py-28">
        <div className="flex items-center gap-3 mb-12">
          <span className="text-xs text-primary uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Projects</span>
          {isHighlighted && (
            <span className="px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-md" style={{ fontFamily: FONT_MONO }}>
              ★ Recommended for {AUDIENCE[audience].label}
            </span>
          )}
        </div>

        {/* Intro, title, summary, metrics, lead media */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center mb-20 lg:mb-28">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>{project.subtitle}</p>
              <h2 className="text-foreground leading-[1.08] tracking-tight" style={{ fontFamily: FONT_SERIF, fontSize: "var(--fs-h2)" }}>
                {project.title}
              </h2>
            </div>
            <p className="text-muted-foreground leading-relaxed" style={{ fontFamily: FONT_SANS }}>{summaryText}</p>
            <div className="grid grid-cols-3 gap-6 py-6 border-y border-border">
              {project.metrics.map((m) => <AnimatedMetric key={m.label} value={m.value} label={m.label} />)}
            </div>
            <div className="flex flex-wrap gap-2">
              {project.tags.map((t) => <Tag key={t}>{t}</Tag>)}
            </div>
          </div>
          <div className="rounded-md overflow-hidden border border-border shadow-lg">
            <VideoPlaceholder url={project.video_url} />
          </div>
        </div>

        {/* Case-study sections, picture alternates left / right each section */}
        <div className="flex flex-col gap-16 lg:gap-24">
          {sections.map((sec, i) => (
            <CaseStudyRow key={sec.label} section={sec} flip={resolveMediaFlip(mediaMode, i)} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CaseStudyRow({ section, flip }: { section: CaseSection; flip: boolean }) {
  const { ref, visible } = useInView(0.2);
  return (
    <div
      ref={ref}
      className={`grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center transition-all duration-700 ${flip ? "lg:[&>*:first-child]:order-2" : ""}`}
      style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(28px)" }}
    >
      {/* Picture */}
      <div className="w-full aspect-[4/3] rounded-md overflow-hidden bg-muted border border-border shadow-md group">
        {section.image ? (
          <img src={section.image} alt={section.imageAlt || section.label} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/40" style={{ fontFamily: FONT_MONO, fontSize: "0.75rem" }}>
            {section.label}
          </div>
        )}
      </div>

      {/* Copy */}
      <div className="flex flex-col gap-4">
        <span className="text-xs text-primary uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>{section.label}</span>
        <p className="text-muted-foreground leading-relaxed" style={{ fontFamily: FONT_SANS, fontSize: "1.0625rem", maxWidth: "56ch" }}>
          {section.text}
        </p>
      </div>
    </div>
  );
}

// ─── Featured Projects (Level 2) ──────────────────────────────────────────────

// ─── Project detail modal ─────────────────────────────────────────────────────

function ProjectModal({ project, onClose }: { project: RenderProject; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", fn);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="relative bg-card border border-border w-full sm:max-w-2xl max-h-[92dvh] sm:max-h-[85dvh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl"
        style={{ animation: "slideUp 0.28s cubic-bezier(0.32,0.72,0,1)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={project.title}
      >
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(32px); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
        `}</style>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>{project.subtitle}</p>
            <h2 className="text-foreground leading-tight" style={{ fontFamily: FONT_SERIF, fontSize: "var(--fs-h2)" }}>
              {project.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="mt-1 shrink-0 w-7 h-7 flex items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Close"
          >
            <X size={13} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-6 flex flex-col gap-6">
          {/* Metrics — inside bg-card (light surface): use --accent-surface (dark sage) */}
          {project.metrics.length > 0 && (
            <div className="grid grid-cols-3 gap-4 py-4 border-y border-border">
              {project.metrics.map((m) => (
                <div key={m.label} className="flex flex-col gap-0.5">
                  <span className="font-medium" style={{ fontFamily: FONT_MONO, fontSize: "1.25rem", color: "var(--accent-surface)" }}>{m.value}</span>
                  <span className="text-xs uppercase tracking-widest" style={{ fontFamily: FONT_MONO, color: "var(--ink-on-surface)", opacity: 0.6 }}>{m.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          <p className="text-foreground leading-relaxed" style={{ fontFamily: FONT_SANS }}>
            {project._dbSections ? (project._dbSections.find((s) => s.id === "summary")?.content ?? project.summary) : project.summary}
          </p>

          {/* Case study sections, DB sections when available, else hardcoded fields */}
          {(project._dbSections
            ? project._dbSections.filter((s) => s.id !== "summary" && s.content).sort((a, b) => a.order - b.order).map((s) => ({ label: s.title, text: s.content }))
            : [
                { label: "Problem", text: project.problem },
                { label: "Approach", text: project.approach },
                { label: "Iteration & Failure", text: project.iteration },
                { label: "Result", text: project.result },
                { label: "Future Work", text: project.future_work },
              ].filter((s) => s.text)
          ).map(({ label, text }) => (
            <div key={label} className="flex flex-col gap-2">
              <span className="text-xs text-primary uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>{label}</span>
              <p className="text-muted-foreground text-sm leading-relaxed" style={{ fontFamily: FONT_SANS }}>{text}</p>
            </div>
          ))}

          {project.hero_image && (
            <div className="w-full aspect-video rounded-lg overflow-hidden bg-muted">
              <img src={project.hero_image} alt={project.hero_image_alt} className="w-full h-full object-cover" loading="lazy" />
            </div>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 pt-2">
            {project.tags.map((t) => <Tag key={t}>{t}</Tag>)}
          </div>
        </div>

        {/* Footer drag handle (mobile hint) */}
        <div className="sm:hidden absolute top-3 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-border" />
      </div>
    </div>
  , document.body);
}

function FeaturedProjects({ projects }: { projects: RenderProject[] }) {
  const { audience, contentOverrides } = useContext(Ctx);
  const highlight = AUDIENCE[audience].highlight;
  const layout = contentOverrides["layout"] ?? {};
  const mediaMode = layout.media_side;

  const allTags = Array.from(new Set(projects.flatMap((p) => p.tags))).slice(0, 8);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [modalProject, setModalProject] = useState<RenderProject | null>(null);
  const filtered = activeTag ? projects.filter((p) => p.tags.includes(activeTag)) : projects;

  const sorted = [...filtered].sort((a, b) => {
    if (a.slug === highlight) return -1;
    if (b.slug === highlight) return 1;
    return 0;
  });

  // Separate flat projects (alternating rows) from folder collections (full-width)
  const rows = sorted.filter((p) => !p.isFolder);
  const folders = sorted.filter((p) => p.isFolder);

  return (
    <section className="max-w-6xl mx-auto px-6 py-20 lg:py-24 relative z-10">
      {modalProject && <ProjectModal project={modalProject} onClose={() => setModalProject(null)} />}

      <div className="mb-8">
        <span className="text-xs text-primary uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Work Experience</span>
      </div>

      <div className="mb-12">
        <TagFilter allTags={allTags} active={activeTag} onChange={setActiveTag} />
      </div>

      {/* Alternating case-study rows, media flips left/right each project */}
      <div className="flex flex-col gap-16 lg:gap-24">
        {rows.map((project, i) => (
          <FeaturedRow
            key={project.slug}
            project={project}
            index={i}
            flip={resolveMediaFlip(mediaMode, i, layout[`side_${project.slug}`])}
            highlighted={project.slug === highlight}
            onOpen={() => setModalProject(project)}
          />
        ))}
      </div>

      {folders.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-16">
          {folders.map((project) => (
            <FolderCard key={project.slug} project={project} highlighted={project.slug === highlight} />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Alternating case-study row ────────────────────────────────────────────────

function FeaturedRow({ project, index, flip, highlighted, onOpen }: { project: RenderProject; index: number; flip: boolean; highlighted: boolean; onOpen: () => void }) {
  const { ref, visible } = useInView(0.2);
  const summary = project._dbSections ? (project._dbSections.find((s) => s.id === "summary")?.content ?? project.summary) : project.summary;

  // Media: prefer the demo video, else the hero image, else a placeholder
  const media = project.video_url
    ? <VideoPlaceholder url={project.video_url} />
    : project.hero_image
      ? (
        <div className="w-full aspect-video bg-muted overflow-hidden relative group">
          <img src={project.hero_image} alt={project.hero_image_alt} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700" loading="lazy" />
        </div>
      )
      : <VideoPlaceholder url="" />;

  return (
    <article
      ref={ref}
      className={`grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center transition-all duration-700 ${flip ? "lg:[&>*:first-child]:order-2" : ""}`}
      style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(28px)" }}
    >
      {/* Media panel */}
      <div className="relative">
        <div
          className={`overflow-hidden rounded-md border shadow-lg ${highlighted ? "border-primary/40 ring-1 ring-primary/20" : "border-border"}`}
        >
          {media}
        </div>
        {highlighted && (
          <span className="absolute -top-3 left-4 px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-sm shadow" style={{ fontFamily: FONT_MONO }}>★ Recommended</span>
        )}
        {/* Big index numeral tucked into the corner */}
        <span
          className="absolute -bottom-6 text-foreground/5 select-none pointer-events-none leading-none"
          style={{ fontFamily: FONT_HEADING, fontWeight: 800, fontSize: "clamp(4rem, 9vw, 7rem)", [flip ? "left" : "right"]: "-0.5rem" } as React.CSSProperties}
          aria-hidden="true"
        >
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      {/* Content panel */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground" style={{ fontFamily: FONT_MONO, letterSpacing: "0.04em" }}>{project.subtitle}</p>
          <h3 className="text-foreground leading-[1.1]" style={{ fontFamily: FONT_SERIF, fontSize: "var(--fs-h3)" }}>{project.title}</h3>
        </div>

        {project.metrics.length > 0 && (
          <div className="grid grid-cols-3 gap-4 py-4 border-y border-border">
            {project.metrics.slice(0, 3).map((m) => <AnimatedMetric key={m.label} value={m.value} label={m.label} />)}
          </div>
        )}

        <p className="text-muted-foreground leading-relaxed" style={{ fontFamily: FONT_SANS }}>{summary}</p>

        <div className="flex flex-wrap gap-1.5">
          {project.tags.map((t) => <Tag key={t}>{t}</Tag>)}
        </div>

        <button
          onClick={onOpen}
          className="group inline-flex items-center gap-2 text-sm text-primary hover:gap-3.5 transition-all duration-200 self-start mt-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-md"
          style={{ fontFamily: FONT_MONO }}
          aria-label={`View case study: ${project.title}`}
        >
          View case study
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <ArrowRight size={12} />
          </span>
        </button>
      </div>
    </article>
  );
}

// ─── Folder Card ──────────────────────────────────────────────────────────────

// A real folder object: a body with a raised tab, holding loose "papers" that
// fan apart on hover/focus. Each thumbnail is its own link to its own project.
function FolderCard({ project, highlighted }: { project: RenderProject; highlighted: boolean }) {
  const { contentOverrides } = useContext(Ctx);
  const layout = contentOverrides["layout"] ?? {};
  const [modalProject, setModalProject] = useState<RenderProject | null>(null);

  const allChildren = (project.children ?? []) as RenderProject[];
  const count = Math.max(2, Math.min(4, parseInt(layout.folder_count) || allChildren.length || 2));
  const children = allChildren.slice(0, count);
  const label = layout.folder_label || "Self initiated builds";
  const rotation = Number.isFinite(parseFloat(layout.folder_rotation)) ? parseFloat(layout.folder_rotation) : 7;
  const fan = Number.isFinite(parseFloat(layout.folder_fan)) ? parseFloat(layout.folder_fan) : 84;
  const mid = (children.length - 1) / 2;

  return (
    <>
      {modalProject && <ProjectModal project={modalProject} onClose={() => setModalProject(null)} />}
      <section
        role="group"
        aria-label={`${label}, ${children.length} projects`}
        className={`group relative pt-7 ${highlighted ? "drop-shadow-[0_0_0_1px_var(--primary)]" : ""}`}
      >
        {/* Raised tab, top left */}
        <div className="absolute top-0 left-5 z-20">
          <div className="h-9 px-4 flex items-center rounded-t-lg border border-b-0" style={{ background: "var(--accent)", borderColor: "var(--accent-surface)" }}>
            <span className="uppercase" style={{ color: "var(--on-accent)", fontFamily: FONT_MONO, fontSize: "12px", letterSpacing: "0.08em" }}>
              {label}
            </span>
          </div>
        </div>

        {/* Folder body */}
        <div
          className="relative rounded-2xl rounded-tl-none border px-6 pt-8 pb-6 overflow-hidden"
          style={{ background: "var(--accent)", borderColor: "var(--accent-surface)" }}
        >
          {/* Loose papers */}
          <div className="relative mx-auto h-56 w-full">
            {children.map((child, i) => {
              const offset = i - mid;
              const rest = `translateX(${offset * 26}px) rotate(${offset * rotation}deg)`;
              const fanned = `translateX(${offset * fan}px) translateY(-10px) rotate(${offset * rotation * 0.5}deg)`;
              return (
                <button
                  key={child.slug}
                  onClick={() => setModalProject(child)}
                  aria-label={`Open project: ${child.title}`}
                  className="absolute left-1/2 top-2 -ml-24 w-48 origin-bottom rounded-lg border border-[var(--accent-surface)] bg-card overflow-hidden shadow-xl transition-transform duration-150 ease-out motion-reduce:transition-none motion-reduce:transform-none group-hover:[transform:var(--fanned)] group-focus-within:[transform:var(--fanned)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--on-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--accent)]"
                  style={{ ["--fanned" as string]: fanned, transform: rest, zIndex: 10 + i } as React.CSSProperties}
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                    {child.hero_image ? (
                      <img src={child.hero_image} alt={child.hero_image_alt || child.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full" style={{ background: `hsl(${i * 48 + 24}, 22%, 22%)` }} />
                    )}
                  </div>
                  <p className="px-3 py-2 text-foreground/90 leading-tight text-left truncate" style={{ fontFamily: FONT_MONO, fontSize: "11px", letterSpacing: "0.03em" }}>
                    {child.title}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Summary tags */}
          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border/60 pt-4">
            {project.tags.map((t) => <Tag key={t} surface="accent">{t}</Tag>)}
          </div>
        </div>
      </section>
    </>
  );
}

function HowIThink() {
  const { contentOverrides } = useContext(Ctx);
  const content = contentOverrides["hero"] ?? {};
  const items = parseHowThink(content.how_think_questions);
  const intro = content.how_think_intro || PORTFOLIO.how_think.intro;
  const prompt = content.how_think_prompt || PORTFOLIO.how_think.prompt;
  const imageUrl = content.how_think_image_url || PORTFOLIO.how_think.image_url;
  const imageAlt = content.how_think_image_alt || PORTFOLIO.how_think.image_alt;

  return (
    <section id="how-i-think" className="border-y border-border relative z-10">
      <div className="max-w-6xl mx-auto px-6 py-20 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-16 items-start">
          <div className="flex flex-col gap-4">
            <span className="text-xs text-primary uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>How I think?</span>
            <h2 className="text-foreground leading-tight" style={{ fontFamily: FONT_SERIF, fontSize: "var(--fs-h2)" }}>How I think?</h2>
            <p className="text-muted-foreground leading-relaxed" style={{ fontFamily: FONT_SANS, maxWidth: "42ch" }}>{intro}</p>
            {imageUrl && <img src={imageUrl} alt={imageAlt || "Engineering process"} className="w-full max-w-sm aspect-[4/3] object-cover rounded-md border border-border" loading="lazy" />}
          </div>
          <div className="border-t border-border">
            {items.map((item) => (
              <Collapsible key={item.question} label={item.question}>
                <p className="text-muted-foreground leading-relaxed pr-8" style={{ fontFamily: FONT_SANS }}>{item.answer}</p>
              </Collapsible>
            ))}
            <p className="pt-6 text-primary leading-relaxed" style={{ fontFamily: FONT_MONO, fontSize: "0.82rem" }}>
              {prompt}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Project Teams (Section 05) ───────────────────────────────────────────────

function ProjectTeams() {
  const teams: ProjectTeam[] = PORTFOLIO.teams ?? [];
  const { contentOverrides } = useContext(Ctx);
  const layout = contentOverrides["layout"] ?? {};
  const mediaMode = layout.media_side;

  return (
    <section id="teams" className="border-t border-border relative z-10">
      <div className="max-w-6xl mx-auto px-6 py-16 lg:py-20">
        <div className="flex items-center gap-3 mb-10">
          <span className="text-xs text-primary uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Project Teams</span>
        </div>

        <div className="flex flex-col gap-8 lg:gap-12">
          {teams.map((team, i) => (
            <TeamCard key={team.id} team={team} flip={resolveMediaFlip(mediaMode, i, layout[`side_${team.id}`])} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TeamCard({ team, flip }: { team: ProjectTeam; flip: boolean }) {
  const accent = team.accentColor ?? "var(--primary)";
  const initials = team.team.split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase();

  return (
    <article
      className={`grid grid-cols-1 lg:grid-cols-[minmax(0,320px)_1fr] gap-6 lg:gap-10 items-stretch border border-border bg-card/60 overflow-hidden hover:border-foreground/20 transition-colors duration-300 ${flip ? "lg:[&>*:first-child]:order-2" : ""}`}
    >
      {/* Accent media panel (source order first, so it stacks on top under 860px) */}
      <div
        className="relative min-h-[160px] lg:min-h-full flex items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 40%, #111))` }}
        aria-hidden="true"
      >
        <span className="text-white/90" style={{ fontFamily: FONT_HEADING, fontWeight: 800, fontSize: "clamp(2.5rem, 6vw, 4rem)", letterSpacing: "-0.02em" }}>
          {initials}
        </span>
        <span className="absolute bottom-3 left-4 text-white/70 text-xs uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>
          {team.period.includes("Present") ? "Active" : "Alumni"}
        </span>
      </div>

      <div className="flex flex-col gap-4 p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-muted-foreground uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>
              {team.org}
            </p>
            <h3 className="text-foreground leading-tight" style={{ fontFamily: FONT_HEADING, fontSize: "var(--fs-h3)", fontWeight: 700, letterSpacing: "-0.01em" }}>
              {team.team}
            </h3>
          </div>
          <span
            className="text-xs px-2 py-1 shrink-0 border"
            style={{ fontFamily: FONT_MONO, borderColor: accent, color: accent, letterSpacing: "0.04em" }}
          >
            {team.period.includes("Present") ? "Active" : "Alumni"}
          </span>
        </div>

        {/* Role + period */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ fontFamily: FONT_MONO, color: accent, letterSpacing: "0.04em" }}>
            {team.role}
          </span>
          <span className="text-muted-foreground/40 text-xs">·</span>
          <span className="text-xs text-muted-foreground" style={{ fontFamily: FONT_MONO }}>
            {team.period}
          </span>
        </div>

        {/* Description */}
        <p className="text-muted-foreground text-sm leading-relaxed" style={{ fontFamily: FONT_SANS }}>
          {team.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {team.tags.map((t) => <Tag key={t}>{t}</Tag>)}
        </div>
      </div>
    </article>
  );
}

// ─── About ────────────────────────────────────────────────────────────────────

function About() {
  const { heroPhoto, contentOverrides } = useContext(Ctx);
  const ov = contentOverrides["hero"] ?? {};
  const bio   = ov.about_bio      || PORTFOLIO.about.bio;
  const email = ov.contact_email  || "wdakare@bu.edu";
  const linkedinUrl = ov.linkedin_url || "https://linkedin.com";

  return (
    <section id="about" className="bg-secondary border-y border-border relative z-10">
      <div className="max-w-6xl mx-auto px-6 py-20 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-6 items-start">
          <div className="lg:col-span-4 flex flex-col gap-3">
            {heroPhoto.url && (
              <div className="flex items-start">
                <img
                  src={heroPhoto.url}
                  alt="William Dakare"
                  style={{ width: "100%", height: "auto", aspectRatio: "3/4", borderRadius: "8px", objectFit: "cover", border: "2px solid var(--border)", clipPath: "polygon(2% 0%, 100% 2%, 96% 98%, 0% 100%)" }}
                />
              </div>
            )}
          </div>
          <div className="lg:col-start-6 lg:col-span-7 flex flex-col gap-6 pt-4 lg:pt-0">
            <div className="flex flex-col gap-3">
              <span className="text-xs text-primary uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>About Me</span>
              <h2 className="text-foreground leading-tight" style={{ fontFamily: FONT_SERIF, fontSize: "var(--fs-h2)" }}>
                Building robots that work in the real world.
              </h2>
            </div>
            <p className="text-muted-foreground leading-relaxed" style={{ fontFamily: FONT_SANS, fontSize: "1.0625rem", maxWidth: "60ch" }}>
              {bio}
            </p>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <CopyEmail email={email} />
              <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors" style={{ fontFamily: FONT_MONO }}>
                <Linkedin size={12} /> LinkedIn <ExternalLink size={10} className="opacity-40" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Skills ───────────────────────────────────────────────────────────────────

function Skills() {
  return (
    <section id="skills" className="max-w-6xl mx-auto px-6 py-20 lg:py-24 relative z-10">
      <div className="mb-12">
        <span className="text-xs text-primary uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Skills</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
        {PORTFOLIO.skills.groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-4">
            <h3 className="text-xs text-muted-foreground uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>{group.label}</h3>
            <div className="flex flex-wrap gap-2">
              {group.items.map((item) => <Tag key={item}>{item}</Tag>)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  const { hero } = PORTFOLIO;
  const { audience, contentOverrides } = useContext(Ctx);
  const mode = AUDIENCE[audience];
  const displayName = contentOverrides["hero"]?.hero_name || hero.name;

  return (
    <footer id="contact" className="border-t border-border relative z-10">
      <div className="max-w-6xl mx-auto px-6 py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 items-end">
          <div className="flex flex-col gap-4">
            <span className="text-xs text-primary uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Contact</span>
            <h2 className="text-foreground leading-tight" style={{ fontFamily: FONT_SERIF, fontSize: "var(--fs-h2)" }}>
              Let's work together.
            </h2>
            <p className="text-muted-foreground max-w-md" style={{ fontFamily: FONT_SANS }}>
              {mode.pitch}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {buildCtaLinks(contentOverrides["hero"] ?? {}).map((link) => {
              const isExternal = link.href.startsWith("http") || link.href.startsWith("mailto:");
              return (
                <a key={link.label} href={isExternal ? link.href : undefined} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noopener noreferrer" : undefined} onClick={!isExternal ? (e) => e.preventDefault() : undefined} className="inline-flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:text-primary" style={{ fontFamily: FONT_MONO, letterSpacing: "0.03em" }}>
                  {link.label === "Résumé" && <FileText size={13} />}
                  {link.label === "GitHub" && <Github size={13} />}
                  {link.label === "LinkedIn" && <Linkedin size={13} />}
                  {link.label === "Email" && <Mail size={13} />}
                  {link.label}
                  <ExternalLink size={11} className="opacity-40" />
                </a>
              );
            })}
          </div>
        </div>

        <div className="mt-16 pt-6 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground/50" style={{ fontFamily: FONT_MONO }}>© {new Date().getFullYear()} {displayName}</span>
          <span className="text-xs text-muted-foreground/30" style={{ fontFamily: FONT_MONO }}>Boston University · MechE '29</span>
        </div>
      </div>
    </footer>
  );
}

// ─── Portfolio app (the public site) ─────────────────────────────────────────

function RootLayout() {
  const [theme, setTheme] = useState<ThemeId>("dark");
  const [audience, setAudience] = useState<AudienceId>("companies");
  const [pitch, setPitch] = useState(false);
  const [gateOpen, setGateOpen] = useState(() => !sessionStorage.getItem("persona-chosen"));
  const [personas, setPersonas] = useState<PersonaMap>(AUDIENCE);
  const [heroPhoto, setHeroPhoto] = useState<{ url: string; size: number }>({ url: "", size: 240 });
  const [contentOverrides, setContentOverrides] = useState<Record<string, Record<string, string>>>({});
  const [dbTokens, setDbTokens] = useState<React.CSSProperties>({});
  const [renderProjects, setRenderProjects] = useState<RenderProject[]>(PORTFOLIO.projects as RenderProject[]);

  // Fetch Supabase personas and hero photo settings on mount
  useEffect(() => {
    (async () => {
      // Personas
      const { data: personaRows } = await supabase.from("personas").select("*").order("order");
      if (personaRows?.length) {
        const map: PersonaMap = {} as PersonaMap;
        for (const row of personaRows) {
          map[row.id as AudienceId] = { label: row.label, tagline: row.tagline, pitch: row.pitch, highlight_slug: row.highlight_slug };
        }
        setPersonas(map);
      }

      // Design tokens
      const { data: tokensRow } = await supabase.from("design_tokens").select("tokens").eq("id", "tokens").maybeSingle();
      if (tokensRow?.tokens) setDbTokens(tokensRow.tokens as React.CSSProperties);

      // Hero photo + content overrides
      const { data: heroRow } = await supabase.from("site_content").select("data").eq("id", "hero").maybeSingle();
      if (heroRow?.data) {
        const d = heroRow.data as Record<string, string>;
        if (d.hero_photo_url) setHeroPhoto({ url: d.hero_photo_url, size: Number(d.hero_photo_size) || 240 });
      }

      // Content overrides (all sections)
      const { data: contentRows } = await supabase.from("site_content").select("id, data");
      if (contentRows?.length) {
        const overrides: Record<string, Record<string, string>> = {};
        for (const row of contentRows) overrides[row.id] = row.data as Record<string, string>;
        setContentOverrides(overrides);
      }

      // Projects from DB, overrides hardcoded PORTFOLIO when available
      const { data: projectRows } = await supabase.from("projects").select("*").order("order");
      if (projectRows?.length) {
        setRenderProjects(projectRows.map((r) => dbToRender({
          id: r.id,
          tier: (r.tier as DbProject["tier"]) ?? "more",
          title: r.title ?? "",
          subtitle: r.subtitle ?? "",
          tags: (r.tags as string[]) ?? [],
          metrics: (r.metrics as DbProject["metrics"]) ?? [],
          hero_image: r.hero_image ?? "",
          hero_image_alt: r.hero_image_alt ?? "",
          video_url: r.video_url ?? "",
          sections: (r.sections as DbSection[]) ?? [],
          order: r.order ?? 0,
        })));
      }
    })();
  }, []);

  const themeData = THEMES[theme];
  // Font defaults sit under theme colours, which sit under saved dbTokens (editor).
  const themeVars = { ...DEFAULT_FONT_TOKENS, ...themeData.vars, ...dbTokens } as React.CSSProperties;

  // Load whichever webfonts the three font tokens resolve to (defaults or overrides).
  const fontDisplay = (themeVars as Record<string, string>)["--font-display"];
  const fontBody    = (themeVars as Record<string, string>)["--font-body"];
  const fontData    = (themeVars as Record<string, string>)["--font-data"];
  useEffect(() => {
    [fontDisplay, fontBody, fontData].forEach((stack) => stack && ensureGoogleFont(firstFamily(stack)));
  }, [fontDisplay, fontBody, fontData]);

  const handlePitch = useCallback(() => setPitch(true), []);

  return (
    <Ctx.Provider value={{ theme, setTheme, audience, setAudience, personas, heroPhoto, contentOverrides }}>
      <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: FONT_SANS, ...themeVars }}>
        <style>{`
          html { scroll-behavior: smooth; position: relative; }
        `}</style>

        {/* Static SVG/CSS theme pattern overlay (Blueprint dots, Signal hatching, etc.) */}
        <ThemePattern pattern={themeData.pattern} primary={themeData.swatch} />

        {gateOpen && (
          <PersonaGate onDone={() => {
            sessionStorage.setItem("persona-chosen", "1");
            setGateOpen(false);
          }} />
        )}

        {pitch && <QuickPitch onClose={() => setPitch(false)} />}

        <Nav onPitch={handlePitch} />
        <Outlet context={{ onPitch: handlePitch, renderProjects }} />
        <Footer />
      </div>
    </Ctx.Provider>
  );
}

function HomePage() {
  const { onPitch, renderProjects } = useOutletContext<{ onPitch: () => void; renderProjects: RenderProject[] }>();
  const heroProject = (renderProjects.find((p) => p.tier === "hero") ?? PORTFOLIO.projects.find((p) => p.tier === "hero"))!;
  const featured    = renderProjects.filter((p) => p.tier === "featured");

  return (
    <main>
      <Hero onPitch={onPitch} />
      <About />
      <HowIThink />
      <HeroProject project={heroProject} />
      <FeaturedProjects projects={featured} />
      <ProjectTeams />
    </main>
  );
}

function AboutPage() {
  return null; // Deprecated by single-page layout
}

// ─── Router ───────────────────────────────────────────────────────────────────
// Hash routing works on GitHub Pages without server config.
// /edit-w9k3x7m is the hidden editor, intentionally unlinked from nav/sitemap.

const router = createHashRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "about", element: <AboutPage /> },
    ],
  },
  { path: "/edit-w9k3x7m", element: <EditPage /> },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
