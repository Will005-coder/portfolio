import { useState, useMemo, useEffect } from "react";
import { PORTFOLIO } from "./content";

const FONT_MONO    = "var(--font-data)";
const FONT_HEADING = "var(--font-display)";

// ─── Voronoi utilities ─────────────────────────────────────────────────────────

function clipPolygon(
  poly: [number, number][],
  ax: number, ay: number,
  bx: number, by: number,
): [number, number][] {
  if (poly.length === 0) return [];
  const out: [number, number][] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % n];
    const d1 = (bx - ax) * (y1 - ay) - (by - ay) * (x1 - ax);
    const d2 = (bx - ax) * (y2 - ay) - (by - ay) * (x2 - ax);
    if (d1 >= 0) out.push([x1, y1]);
    if ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) {
      const t = d1 / (d1 - d2);
      out.push([x1 + t * (x2 - x1), y1 + t * (y2 - y1)]);
    }
  }
  return out;
}

function voronoiCell(seeds: [number, number][], i: number, W: number, H: number): [number, number][] {
  let poly: [number, number][] = [[0, 0], [W, 0], [W, H], [0, H]];
  for (let j = 0; j < seeds.length; j++) {
    if (j === i || poly.length === 0) continue;
    const mx = (seeds[i][0] + seeds[j][0]) / 2;
    const my = (seeds[i][1] + seeds[j][1]) / 2;
    const dx = seeds[j][0] - seeds[i][0];
    const dy = seeds[j][1] - seeds[i][1];
    poly = clipPolygon(poly, mx, my, mx - dy, my + dx);
  }
  return poly;
}

function polygonCentroid(poly: [number, number][]): [number, number] {
  let area = 0, cx = 0, cy = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % n];
    const a = x0 * y1 - x1 * y0;
    area += a;
    cx += (x0 + x1) * a;
    cy += (y0 + y1) * a;
  }
  area /= 2;
  if (Math.abs(area) < 1e-6) return [poly[0]?.[0] ?? 0, poly[0]?.[1] ?? 0];
  return [cx / (6 * area), cy / (6 * area)];
}

function polygonArea(poly: [number, number][]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    a += x0 * y1 - x1 * y0;
  }
  return Math.abs(a) / 2;
}

// ─── Deterministic seed generation ────────────────────────────────────────────
// Seed 0 is the impact point at center (portrait cell).
// Seeds 1..N spiral outward; k ensures outer seeds escape the pane boundary.

function buildSeeds(W: number, H: number, count: number): [number, number][] {
  const Ix = W / 2, Iy = H / 2;
  const k = Math.min(W, H) * 0.32;
  const seeds: [number, number][] = [[Ix, Iy]];
  for (let n = 1; n < count; n++) {
    const r = k * Math.sqrt(n + 1.5);
    const theta = n * 2.399963; // golden angle in radians
    seeds.push([Ix + r * Math.cos(theta) * 1.12, Iy + r * Math.sin(theta) * 0.9]);
  }
  return seeds;
}

// ─── Breakpoints ──────────────────────────────────────────────────────────────

type BP = "desktop" | "tablet" | "mobile";

function getBP(w = typeof window !== "undefined" ? window.innerWidth : 1200): BP {
  if (w >= 1100) return "desktop";
  if (w >= 768) return "tablet";
  return "mobile";
}

// Base coordinate space per breakpoint, aspect ratio must match.
const BP_CONF: Record<BP, { BW: number; BH: number; seeds: number; ratio: string }> = {
  desktop: { BW: 2100, BH: 900,  seeds: 18, ratio: "21 / 9" },
  tablet:  { BW: 1600, BH: 900,  seeds: 12, ratio: "16 / 9" },
  mobile:  { BW: 400,  BH: 300,  seeds: 6,  ratio: "4 / 3"  },
};

// ─── Project definitions ───────────────────────────────────────────────────────

const PROJECTS = PORTFOLIO.projects.map((p, i) => ({
  slug:     p.slug,
  num:      String(i + 1).padStart(2, "0"),
  caption:  `${String(i + 1).padStart(2, "0")} · ${p.title}`,
  imageUrl: p.hero_image,
  // Hero project gets ~2.5× the angular width; featured ~1.5×; more ~1×
  weight: p.tier === "hero" ? 2.5 : p.tier === "featured" ? 1.5 : 1,
}));

// ─── Cell data ────────────────────────────────────────────────────────────────

interface Cell {
  seedIdx:    number;
  poly:       [number, number][];
  centroid:   [number, number];
  area:       number;
  angle:      number;
  projectIdx: number; // -1 = portrait, ≥0 = PROJECTS index
  isLargest:  boolean;
}

interface ProjectGroup {
  cells: Cell[];
  bbox:  { x1: number; y1: number; x2: number; y2: number };
}

// ─── Geometry computation ─────────────────────────────────────────────────────

function computeCells(BW: number, BH: number, seedCount: number): Cell[] {
  const seeds = buildSeeds(BW, BH, seedCount);
  const Ix = BW / 2, Iy = BH / 2;
  const MIN_AREA = (BW * BH) * 0.004; // drop cells smaller than 0.4% of total

  const raw: Cell[] = [];
  for (let i = 0; i < seedCount; i++) {
    const poly = voronoiCell(seeds, i, BW, BH);
    if (poly.length < 3) continue;
    const area = polygonArea(poly);
    if (area < MIN_AREA) continue;
    const centroid = polygonCentroid(poly);
    raw.push({
      seedIdx:    i,
      poly,
      centroid,
      area,
      angle:      i === 0 ? 0 : Math.atan2(centroid[1] - Iy, centroid[0] - Ix),
      projectIdx: -1,
      isLargest:  false,
    });
  }

  const portrait = raw.find(c => c.seedIdx === 0);
  const rest = raw.filter(c => c.seedIdx !== 0);

  // Sort non-portrait cells by angle normalised to [0, 2π)
  rest.sort((a, b) => {
    const na = a.angle < 0 ? a.angle + 2 * Math.PI : a.angle;
    const nb = b.angle < 0 ? b.angle + 2 * Math.PI : b.angle;
    return na - nb;
  });

  // Assign cells to projects proportionally by weight
  const N = rest.length;
  const totalW = PROJECTS.reduce((s, p) => s + p.weight, 0);
  let cursor = 0;
  for (let pi = 0; pi < PROJECTS.length; pi++) {
    const target = pi === PROJECTS.length - 1
      ? N - cursor
      : Math.round(N * PROJECTS[pi].weight / totalW);
    for (let ci = cursor; ci < Math.min(cursor + target, N); ci++) {
      rest[ci].projectIdx = pi;
    }
    cursor = Math.min(cursor + target, N);
  }

  // Mark the largest cell in each project (receives the project number label)
  const largestMap = new Map<number, Cell>();
  for (const c of rest) {
    const prev = largestMap.get(c.projectIdx);
    if (!prev || c.area > prev.area) largestMap.set(c.projectIdx, c);
  }
  for (const c of largestMap.values()) c.isLargest = true;

  return portrait ? [portrait, ...rest] : rest;
}

function groupCells(cells: Cell[], BW: number, BH: number): ProjectGroup[] {
  const groups: ProjectGroup[] = PROJECTS.map(() => ({
    cells: [],
    bbox: { x1: BW, y1: BH, x2: 0, y2: 0 },
  }));
  for (const c of cells) {
    if (c.projectIdx < 0 || c.projectIdx >= groups.length) continue;
    const g = groups[c.projectIdx];
    g.cells.push(c);
    for (const [px, py] of c.poly) {
      g.bbox.x1 = Math.min(g.bbox.x1, px);
      g.bbox.y1 = Math.min(g.bbox.y1, py);
      g.bbox.x2 = Math.max(g.bbox.x2, px);
      g.bbox.y2 = Math.max(g.bbox.y2, py);
    }
  }
  return groups;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Scale bar with live caption
function ScaleBar({ caption }: { caption: string }) {
  return (
    <div
      style={{
        position:   "relative",
        width:      "100%",
        height:     "24px",
        borderTop:  "1px solid var(--border)",
        display:    "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow:   "visible",
      }}
    >
      <span
        style={{
          fontFamily:     FONT_MONO,
          fontSize:       "11px",
          letterSpacing:  "0.08em",
          color:          "var(--primary)",
          textTransform:  "uppercase",
          background:     "var(--background)",
          padding:        "0 12px",
          opacity:        caption ? 1 : 0,
          transition:     "opacity 100ms ease",
          whiteSpace:     "nowrap",
          pointerEvents:  "none",
        }}
      >
        {caption || " "}
      </span>
    </div>
  );
}

// Identity block below the collage
function IdentityBlock({
  displayName,
  displayRole,
  tagline,
  ctaLinks,
  onPitch,
}: {
  displayName: string;
  displayRole: string;
  tagline:     string;
  ctaLinks:    Array<{ label: string; href: string; type: "primary" | "secondary" }>;
  onPitch:     () => void;
}) {
  return (
    <div
      style={{
        padding:   "20px 24px 28px",
        maxWidth:  "860px",
        margin:    "0 auto",
      }}
    >
      {/* Semantic h1, visually small, carries SEO weight */}
      <h1
        style={{
          fontFamily:    "var(--font-display)",
          fontSize:      "clamp(22px, 3vw, 34px)",
          fontWeight:    600,
          letterSpacing: "0.01em",
          color:         "var(--accent)",
          marginBottom:  "14px",
          lineHeight:    1.4,
        }}
      >
        <span>{displayName}</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: "11px", fontWeight: 500, letterSpacing: "0.08em", color: "var(--foreground)", textTransform: "uppercase" }}> · {displayRole} · {PORTFOLIO.hero.institution}</span>
      </h1>

      <p
        style={{
          fontFamily:   "var(--font-body)",
          fontSize:     "18px",
          lineHeight:   1.65,
          color:        "var(--muted-foreground)",
          marginBottom: "10px",
          maxWidth:     "60ch",
        }}
      >
        {tagline}
      </p>

      <p
        style={{
          fontFamily:    FONT_MONO,
          fontSize:      "12px",
          letterSpacing: "0.04em",
          color:         "var(--muted-foreground)",
          marginBottom:  "20px",
        }}
      >
        Seeking summer 2027 internships in robotics and mechatronics.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "center" }}>
        {ctaLinks.map((link) => {
          const isExternal = link.href.startsWith("http") || link.href.startsWith("mailto:");
          return (
            <a
              key={link.label}
              href={link.href}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noopener noreferrer" : undefined}
              style={{
                fontFamily:    FONT_MONO,
                fontSize:      "12px",
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                color:         link.type === "primary" ? "var(--primary)" : "var(--muted-foreground)",
                textDecoration: "none",
                borderBottom:  link.type === "primary"
                  ? "1px solid var(--primary)"
                  : "1px solid transparent",
                paddingBottom: "2px",
                transition:    "color 120ms ease, border-color 120ms ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.color = "var(--foreground)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.color =
                  link.type === "primary" ? "var(--primary)" : "var(--muted-foreground)";
              }}
            >
              {link.label}
            </a>
          );
        })}
        <button
          onClick={onPitch}
          style={{
            fontFamily:    FONT_MONO,
            fontSize:      "12px",
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color:         "var(--muted-foreground)",
            background:    "none",
            border:        "none",
            cursor:        "pointer",
            padding:       0,
          }}
        >
          Quick Pitch
        </button>
      </div>
    </div>
  );
}

// ─── Main exported component ───────────────────────────────────────────────────

export interface ShardHeroProps {
  displayName: string;
  displayRole: string;
  displayYear: string;
  tagline:     string;
  ctaLinks:    Array<{ label: string; href: string; type: "primary" | "secondary" }>;
  shardImages: Record<string, string>;
  onPitch:     () => void;
}

export function ShardHero({
  displayName, displayRole, displayYear,
  tagline, ctaLinks, shardImages, onPitch,
}: ShardHeroProps) {
  const [bp, setBP] = useState<BP>(() => getBP());
  const [hoveredProject, setHoveredProject] = useState<number | null>(null);
  const [activeCaption, setActiveCaption] = useState<string>("");

  // Debounced resize listener, regenerates geometry per breakpoint
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const fn = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setBP(getBP()), 160);
    };
    window.addEventListener("resize", fn);
    return () => { window.removeEventListener("resize", fn); clearTimeout(timer); };
  }, []);

  const { BW, BH, seeds: seedCount, ratio } = BP_CONF[bp];

  const cells = useMemo(() => computeCells(BW, BH, seedCount), [BW, BH, seedCount]);
  const groups = useMemo(() => groupCells(cells, BW, BH), [cells, BW, BH]);
  const portraitCell = useMemo(() => cells.find(c => c.projectIdx === -1), [cells]);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function pctX(x: number) { return `${(x / BW * 100).toFixed(2)}%`; }
  function pctY(y: number) { return `${(y / BH * 100).toFixed(2)}%`; }
  function toClipPath(poly: [number, number][]) {
    return `polygon(${poly.map(([px, py]) => `${pctX(px)} ${pctY(py)}`).join(", ")})`;
  }

  function handleHover(pi: number | null) {
    setHoveredProject(pi);
    setActiveCaption(pi !== null ? (PROJECTS[pi]?.caption ?? "") : "");
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <section id="home" style={{ borderBottom: "1px solid var(--border)" }}>
      {/* ── Shard collage ── */}
      <nav aria-label="Featured projects">
        <div
          style={{
            position:   "relative",
            width:      "100%",
            aspectRatio: ratio,
            overflow:   "hidden",
            background: "var(--background)",
          }}
        >
          {/* Project cells, rendered before portrait for keyboard order */}
          {PROJECTS.map((proj, pi) => {
            const grp = groups[pi];
            if (!grp || grp.cells.length === 0) return null;
            const { bbox } = grp;
            if (bbox.x2 <= bbox.x1 || bbox.y2 <= bbox.y1) return null;

            const imgUrl = shardImages[proj.slug] || proj.imageUrl;
            const bLeft   = bbox.x1 / BW * 100;
            const bTop    = bbox.y1 / BH * 100;
            const bWidth  = (bbox.x2 - bbox.x1) / BW * 100;
            const bHeight = (bbox.y2 - bbox.y1) / BH * 100;
            const isHovered = hoveredProject === pi;

            return grp.cells.map((cell, ci) => {
              const [cx, cy] = cell.centroid;
              const lifted = isHovered && !prefersReducedMotion;
              return (
                <a
                  key={`${pi}-${ci}`}
                  href={`#${proj.slug}`}
                  aria-label={ci === 0 ? `${proj.caption}` : ""}
                  tabIndex={ci === 0 ? 0 : -1}
                  style={{
                    position:        "absolute",
                    inset:           0,
                    clipPath:        toClipPath(cell.poly),
                    transformOrigin: `${pctX(cx)} ${pctY(cy)}`,
                    transform:       lifted ? "translateY(-3px) scale(0.994)" : "scale(0.994)",
                    transition:      "transform 120ms ease",
                    outline:         "none",
                    display:         "block",
                  }}
                  onMouseEnter={() => handleHover(pi)}
                  onMouseLeave={() => handleHover(null)}
                  onFocus={() => handleHover(pi)}
                  onBlur={() => handleHover(null)}
                  onClick={(e) => { e.preventDefault(); scrollTo(proj.slug); }}
                >
                  {/* Photo spanning the project group's bounding box */}
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt={ci === 0 ? proj.caption : ""}
                      loading="lazy"
                      style={{
                        position:   "absolute",
                        left:       `${bLeft}%`,
                        top:        `${bTop}%`,
                        width:      `${bWidth}%`,
                        height:     `${bHeight}%`,
                        objectFit:  "cover",
                        pointerEvents: "none",
                        display:    "block",
                      }}
                    />
                  ) : (
                    // Tinted placeholder when no photo available
                    <div
                      style={{
                        position:   "absolute",
                        inset:      0,
                        background: `hsl(${pi * 41 + 20}, 18%, ${18 + pi * 3}%)`,
                        pointerEvents: "none",
                      }}
                    />
                  )}

                  {/* Project number label, only on the largest cell */}
                  {cell.isLargest && (
                    <span
                      style={{
                        position:     "absolute",
                        left:         `calc(${pctX(bbox.x1)} + 10px)`,
                        top:          `calc(${pctY(bbox.y1)} + 10px)`,
                        fontFamily:   FONT_MONO,
                        fontSize:     "13px",
                        fontWeight:   500,
                        color:        "var(--background)",
                        pointerEvents: "none",
                        userSelect:   "none",
                        lineHeight:   1,
                        mixBlendMode: "difference",
                      }}
                    >
                      {proj.num}
                    </span>
                  )}

                  {/* Hover tint overlay */}
                  {isHovered && (
                    <div
                      style={{
                        position:  "absolute",
                        inset:     0,
                        background: "rgba(242,194,48,0.10)",
                        pointerEvents: "none",
                      }}
                    />
                  )}
                </a>
              );
            });
          })}

          {/* Portrait cell, last in DOM = last in keyboard order */}
          {portraitCell && (() => {
            const [cx, cy] = portraitCell.centroid;
            const portraitUrl = shardImages["portrait"] || "";
            return (
              <a
                href="#about"
                aria-label={`About ${displayName}`}
                style={{
                  position:        "absolute",
                  inset:           0,
                  clipPath:        toClipPath(portraitCell.poly),
                  transformOrigin: `${pctX(cx)} ${pctY(cy)}`,
                  transform:       "scale(0.994)",
                  outline:         "none",
                  display:         "block",
                }}
                onClick={(e) => { e.preventDefault(); scrollTo("about"); }}
              >
                {portraitUrl ? (
                  <img
                    src={portraitUrl}
                    alt={displayName}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      position:   "absolute",
                      inset:      0,
                      background: "var(--secondary)",
                    }}
                  />
                )}
              </a>
            );
          })()}
        </div>
      </nav>

      {/* ── Scale bar with live caption ── */}
      <ScaleBar caption={activeCaption} />

      {/* ── Identity block ── */}
      <IdentityBlock
        displayName={displayName}
        displayRole={displayRole}
        tagline={tagline}
        ctaLinks={ctaLinks}
        onPitch={onPitch}
      />
    </section>
  );
}
