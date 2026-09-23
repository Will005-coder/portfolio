import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "../lib/supabase";

export interface Slide {
  id: string;
  title: string;
  body: string;
  image_url: string;
  image_alt: string;
  bg_color: string;
  order: number;
}

const FONT_SERIF = "'Instrument Serif', Georgia, serif";
const FONT_MONO  = "'JetBrains Mono', 'Courier New', monospace";
const FONT_SANS  = "'Inter', system-ui, sans-serif";

// ── Admin slide editor (used inside EditPage) ─────────────────────────────────

interface SlideEditorProps {
  slides: Slide[];
  timerSeconds: number;
  onChangeTimer: (s: number) => void;
  onSave: (slides: Slide[], timer: number) => Promise<void>;
  saveStatus: "idle" | "saving" | "saved" | "error";
  errorMsg?: string;
}

export function SlideEditor({ slides: initial, timerSeconds, onChangeTimer, onSave, saveStatus, errorMsg }: SlideEditorProps) {
  const [slides, setSlides] = useState<Slide[]>(initial);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => { setSlides(initial); }, [initial]);

  function addSlide() {
    const s: Slide = {
      id: crypto.randomUUID(),
      title: "New Slide",
      body: "Slide content goes here.",
      image_url: "",
      image_alt: "",
      bg_color: "",
      order: slides.length,
    };
    setSlides((ss) => [...ss, s]);
    setEditing(s.id);
  }

  function deleteSlide(id: string) {
    setSlides((ss) => ss.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i })));
    if (editing === id) setEditing(null);
  }

  function moveSlide(id: string, dir: -1 | 1) {
    setSlides((ss) => {
      const idx = ss.findIndex((s) => s.id === id);
      const next = idx + dir;
      if (next < 0 || next >= ss.length) return ss;
      const arr = [...ss];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr.map((s, i) => ({ ...s, order: i }));
    });
  }

  function updateField(id: string, field: keyof Slide, value: string) {
    setSlides((ss) => ss.map((s) => s.id === id ? { ...s, [field]: value } : s));
  }

  const fieldBase = "w-full bg-[#111] border border-[rgba(255,255,255,0.08)] rounded-md text-[#F0F0EC] text-sm px-3 py-2 focus:outline-none focus:border-[#C8FF00] transition-colors";

  return (
    <div className="flex flex-col gap-6">
      {/* Timer */}
      <div className="flex items-center gap-4 p-4 bg-[#111] rounded-xl border border-[rgba(255,255,255,0.06)]">
        <span className="text-xs text-[#6E6E68] uppercase tracking-widest shrink-0" style={{ fontFamily: FONT_MONO }}>
          Auto-advance every
        </span>
        <input
          type="number" min={1} max={60} value={timerSeconds}
          onChange={(e) => onChangeTimer(Number(e.target.value))}
          className="w-20 bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] rounded-md text-[#F0F0EC] text-sm px-3 py-1.5 focus:outline-none focus:border-[#C8FF00] text-center"
          style={{ fontFamily: FONT_MONO }}
        />
        <span className="text-xs text-[#6E6E68]" style={{ fontFamily: FONT_MONO }}>seconds · pauses on hover</span>
      </div>

      {/* Slide list */}
      <div className="flex flex-col gap-2">
        {slides.map((slide, i) => (
          <div key={slide.id} className="flex flex-col gap-0 border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden">
            {/* Slide header row */}
            <div
              className="flex items-center gap-3 px-4 py-3 bg-[#111] cursor-pointer hover:bg-[#181818] transition-colors"
              onClick={() => setEditing(editing === slide.id ? null : slide.id)}
            >
              <span className="text-xs text-[#C8FF00] w-5 shrink-0" style={{ fontFamily: FONT_MONO }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 text-sm text-[#F0F0EC] truncate" style={{ fontFamily: FONT_SANS }}>
                {slide.title || "Untitled"}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); moveSlide(slide.id, -1); }}
                  disabled={i === 0}
                  className="p-1 text-[#6E6E68] hover:text-[#F0F0EC] disabled:opacity-30 transition-colors"
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); moveSlide(slide.id, 1); }}
                  disabled={i === slides.length - 1}
                  className="p-1 text-[#6E6E68] hover:text-[#F0F0EC] disabled:opacity-30 transition-colors"
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSlide(slide.id); }}
                  className="p-1 text-[#6E6E68] hover:text-[#FF4444] transition-colors ml-1"
                  aria-label="Delete slide"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Edit form */}
            {editing === slide.id && (
              <div className="flex flex-col gap-3 p-4 bg-[#0D0D0D] border-t border-[rgba(255,255,255,0.06)]">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Title</label>
                  <input className={fieldBase} value={slide.title} onChange={(e) => updateField(slide.id, "title", e.target.value)} style={{ fontFamily: FONT_SANS }} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Body text</label>
                  <textarea className={`${fieldBase} resize-y min-h-[72px]`} value={slide.body} onChange={(e) => updateField(slide.id, "body", e.target.value)} style={{ fontFamily: FONT_SANS }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Image URL</label>
                    <input className={fieldBase} value={slide.image_url} onChange={(e) => updateField(slide.id, "image_url", e.target.value)} placeholder="https://…" style={{ fontFamily: FONT_MONO, fontSize: "11px" }} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Image alt text</label>
                    <input className={fieldBase} value={slide.image_alt} onChange={(e) => updateField(slide.id, "image_alt", e.target.value)} style={{ fontFamily: FONT_SANS }} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[#6E6E68] uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>Background colour (optional hex)</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={slide.bg_color || "#131313"} onChange={(e) => updateField(slide.id, "bg_color", e.target.value)} className="w-8 h-8 rounded-md border border-[rgba(255,255,255,0.1)] cursor-pointer bg-transparent" />
                    <input className={`${fieldBase} flex-1`} value={slide.bg_color} onChange={(e) => updateField(slide.id, "bg_color", e.target.value)} placeholder="#131313 or empty" style={{ fontFamily: FONT_MONO, fontSize: "11px" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addSlide}
        className="w-full py-2.5 border border-dashed border-[rgba(255,255,255,0.12)] rounded-xl text-xs text-[#6E6E68] hover:text-[#F0F0EC] hover:border-[rgba(255,255,255,0.25)] transition-colors"
        style={{ fontFamily: FONT_MONO }}
      >
        + Add slide
      </button>

      <div className="flex items-center gap-4 sticky bottom-0 bg-[#0A0A0A] py-4 border-t border-[rgba(255,255,255,0.06)]">
        <button
          onClick={() => onSave(slides, timerSeconds)}
          disabled={saveStatus === "saving"}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#C8FF00] text-[#0A0A0A] text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
          style={{ fontFamily: FONT_MONO }}
        >
          Save slides
        </button>
        {saveStatus === "saving" && <span className="text-xs text-[#6E6E68]" style={{ fontFamily: FONT_MONO }}>Saving…</span>}
        {saveStatus === "saved"  && <span className="text-xs text-[#C8FF00]" style={{ fontFamily: FONT_MONO }}>✓ Saved</span>}
        {saveStatus === "error"  && (
          <span className="text-xs text-[#FF4444] max-w-xs" style={{ fontFamily: FONT_MONO }} title={errorMsg}>
            ✕ {errorMsg ?? "Save failed"}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Public slideshow component (rendered on the live site) ────────────────────

export default function Slideshow() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [timer, setTimer] = useState(5);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [fading, setFading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: slideData }, { data: settingsData }] = await Promise.all([
        supabase.from("slides").select("*").order("order"),
        supabase.from("site_content").select("data").eq("id", "slideshow_settings").maybeSingle(),
      ]);
      if (slideData?.length) setSlides(slideData as Slide[]);
      if (settingsData?.data) {
        const t = (settingsData.data as Record<string, number>).timer_seconds;
        if (t) setTimer(t);
      }
    })();
  }, []);

  const goTo = useCallback((idx: number) => {
    setFading(true);
    setTimeout(() => {
      setCurrent(idx);
      setFading(false);
    }, 250);
  }, []);

  const next = useCallback(() => {
    goTo((current + 1) % slides.length);
  }, [current, slides.length, goTo]);

  const prev = useCallback(() => {
    goTo((current - 1 + slides.length) % slides.length);
  }, [current, slides.length, goTo]);

  // Auto-advance
  useEffect(() => {
    if (slides.length < 2 || paused) return;
    intervalRef.current = setInterval(next, timer * 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [slides.length, paused, timer, next]);

  // Keyboard navigation
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [next, prev]);

  if (!slides.length) return null;

  const slide = slides[current];

  return (
    <section className="max-w-6xl mx-auto px-6 py-20 relative z-10">
      <div className="flex items-center gap-3 mb-10">
        <span className="text-xs text-primary uppercase tracking-widest" style={{ fontFamily: FONT_MONO }}>
          Slides
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div
        className="relative rounded-2xl overflow-hidden border border-border"
        style={{ background: slide.bg_color || "var(--card)", minHeight: "280px" }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        role="region"
        aria-label="Slideshow"
        aria-live="polite"
      >
        <div
          className="flex flex-col lg:flex-row gap-0 transition-opacity duration-250"
          style={{ opacity: fading ? 0 : 1 }}
        >
          {/* Image */}
          {slide.image_url && (
            <div className="w-full lg:w-1/2 aspect-video lg:aspect-auto lg:min-h-[280px] overflow-hidden shrink-0">
              <img
                src={slide.image_url}
                alt={slide.image_alt}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )}

          {/* Text */}
          <div className="flex flex-col justify-center gap-4 p-8 lg:p-10 flex-1">
            {slide.title && (
              <h3
                className="text-foreground leading-tight"
                style={{ fontFamily: FONT_SERIF, fontStyle: "italic", fontSize: "clamp(1.5rem, 3vw, 2.25rem)" }}
              >
                {slide.title}
              </h3>
            )}
            {slide.body && (
              <p className="text-muted-foreground leading-relaxed" style={{ fontFamily: FONT_SANS, maxWidth: "55ch" }}>
                {slide.body}
              </p>
            )}
          </div>
        </div>

        {/* Controls */}
        {slides.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/70 backdrop-blur-sm border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Previous slide"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/70 backdrop-blur-sm border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Next slide"
            >
              <ChevronRight size={16} />
            </button>

            {/* Dots */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-200 focus-visible:outline-none ${i === current ? "bg-primary w-4" : "bg-muted-foreground/40 hover:bg-muted-foreground/70"}`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>

            {/* Pause indicator */}
            {paused && (
              <span className="absolute top-3 right-3 text-[10px] text-muted-foreground/60 px-2 py-0.5 bg-background/50 rounded-md" style={{ fontFamily: FONT_MONO }}>
                ⏸ paused
              </span>
            )}
          </>
        )}
      </div>
    </section>
  );
}
