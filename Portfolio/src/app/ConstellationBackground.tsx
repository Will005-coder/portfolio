import { useEffect, useRef } from "react";

// Editable star field parameters (Task 4 + Task 7). Fed from design tokens so
// the editor can tune the whole field live.
export interface StarConfig {
  count: number;        // number of shards
  sizeMin: number;      // smallest shard radius, px
  sizeMax: number;      // largest shard radius, px
  rayDensity: number;   // fraction (0..1) of largest shards that emit rays
  rayLength: number;    // multiplier on ray length
  refraction: number;   // max angular offset per ray, radians (bends off normal)
  color: string;        // shard fill color, hex
  opacity: number;      // global opacity multiplier (0..1)
}

export const DEFAULT_STAR_CONFIG: StarConfig = {
  count: 230,
  sizeMin: 0.6,
  sizeMax: 13,
  rayDensity: 0.13,
  rayLength: 1,
  refraction: 0.5,
  color: "#F2F0EB",
  opacity: 1,
};

interface Props {
  accentColor?: string;
  starConfig?: Partial<StarConfig>;
}

interface Star {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  baseOpacity: number;
  colorClass: number;
  dx: number; dy: number;
  dvx: number; dvy: number;
  phase: number;
  twAmp: number;
  twSpeed: number;
  twinkles: boolean;      // only a handful animate opacity
  glow: number;
  sprite: HTMLCanvasElement | null;
  spriteHalf: number;     // half-size of the sprite, for centered blitting
}

interface Nebula { x: number; y: number; r: number; rgb: [number, number, number]; opacity: number; }
interface LightSource { x: number; y: number; r: number; rgb: [number, number, number]; phase: number; }
interface DarkPatch { x: number; y: number; r: number; depth: number; }

const NEBULAE: Nebula[] = [
  { x: 0.12, y: 0.28, r: 0.38, rgb: [140, 100, 220], opacity: 0.030 },
  { x: 0.72, y: 0.65, r: 0.30, rgb: [220, 110, 60],  opacity: 0.024 },
  { x: 0.87, y: 0.12, r: 0.24, rgb: [80,  180, 255], opacity: 0.024 },
  { x: 0.38, y: 0.88, r: 0.32, rgb: [242, 194, 48],  opacity: 0.020 },
  { x: 0.52, y: 0.42, r: 0.18, rgb: [255, 255, 255], opacity: 0.018 },
  { x: 0.22, y: 0.72, r: 0.22, rgb: [60,  200, 180], opacity: 0.020 },
];

const LIGHT_SOURCES: Omit<LightSource, "phase">[] = [
  { x: 0.11, y: 0.16, r: 3.2, rgb: [255, 255, 255] },
  { x: 0.78, y: 0.20, r: 2.6, rgb: [180, 215, 255] },
  { x: 0.56, y: 0.74, r: 3.0, rgb: [242, 194, 48]  },
  { x: 0.90, y: 0.60, r: 2.4, rgb: [255, 200, 130] },
  { x: 0.24, y: 0.80, r: 2.8, rgb: [200, 230, 255] },
  { x: 0.63, y: 0.36, r: 2.0, rgb: [255, 230, 210] },
  { x: 0.44, y: 0.10, r: 2.2, rgb: [150, 200, 255] },
  { x: 0.06, y: 0.55, r: 1.8, rgb: [255, 180, 100] },
];

const DARK_COUNT   = 9;
const EDGE_DIST    = 120;
const ATTRACTOR_DIST = 190;
const SPRING_K     = 0.011;
const SPRING_DAMP  = 0.87;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) || 242,
    parseInt(h.slice(2, 4), 16) || 240,
    parseInt(h.slice(4, 6), 16) || 235,
  ];
}

export default function ConstellationBackground({ accentColor = "#F2C230", starConfig }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cfg: StarConfig = { ...DEFAULT_STAR_CONFIG, ...starConfig };
    const STAR_COUNT = Math.max(10, Math.round(cfg.count));
    const shardRgb = hexToRgb(cfg.color);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = window.innerWidth;
    let H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    const isMobile = window.matchMedia("(pointer: coarse)").matches;
    const mouse = { x: W / 2, y: H / 2, active: false };

    // Seeded pseudo-random so the field is identical on every visit.
    function rng(seed: number) {
      const x = Math.sin(seed + 1) * 43758.5453;
      return x - Math.floor(x);
    }

    // Build a single faceted shard sprite once, to an offscreen canvas. The
    // polygon is irregular (uneven angles, uneven radii), given a random axis
    // scale and rotation, and, for the largest shards, refracted rays that
    // leave from each vertex along its outward normal with a per vertex length
    // and brightness. Nothing here is redrawn per frame; the loop only blits.
    function buildSprite(seed: number, r: number, withRays: boolean): { canvas: HTMLCanvasElement; half: number } {
      const q = (k: number) => rng(seed * 7.13 + k * 101.7);

      const vCount = 4 + Math.floor(q(0) * 4);        // 4..7 vertices
      const rot = q(1) * Math.PI * 2;                  // baked rotation
      const scaleX = lerp(0.6, 1.0, q(2));             // squash one axis, reads as a flake

      // Uneven angular spacing: partition the circle into random-weighted gaps.
      const weights: number[] = [];
      let wSum = 0;
      for (let i = 0; i < vCount; i++) { const w = 0.4 + q(10 + i); weights.push(w); wSum += w; }
      const pts: { x: number; y: number }[] = [];
      let acc = 0;
      for (let i = 0; i < vCount; i++) {
        acc += (weights[i] / wSum) * Math.PI * 2;
        const rad = r * lerp(0.55, 1.0, q(30 + i));
        let px = Math.cos(acc + rot) * rad;
        let py = Math.sin(acc + rot) * rad;
        px *= scaleX;
        pts.push({ x: px, y: py });
      }

      // Per vertex ray geometry: outward normal (from centroid), length from
      // adjacent edge lengths, small seeded refraction offset, own brightness.
      interface Ray { vx: number; vy: number; ang: number; len: number; bright: number; }
      const rays: Ray[] = [];
      if (withRays) {
        for (let i = 0; i < vCount; i++) {
          const p = pts[i];
          const prev = pts[(i - 1 + vCount) % vCount];
          const next = pts[(i + 1) % vCount];
          const e1 = Math.hypot(p.x - prev.x, p.y - prev.y);
          const e2 = Math.hypot(next.x - p.x, next.y - p.y);
          const edgeAvg = (e1 + e2) / 2;
          const normAng = Math.atan2(p.y, p.x) + (q(50 + i) - 0.5) * cfg.refraction;
          rays.push({
            vx: p.x, vy: p.y,
            ang: normAng,
            len: edgeAvg * lerp(1.4, 3.2, q(60 + i)) * cfg.rayLength,
            bright: lerp(0.25, 0.95, q(70 + i)),
          });
        }
      }

      const maxRay = rays.reduce((m, ry) => Math.max(m, Math.hypot(ry.vx, ry.vy) + ry.len), 0);
      const extent = Math.max(r * 1.1, maxRay) + 3;
      const half = Math.ceil(extent);
      const c = document.createElement("canvas");
      c.width = half * 2; c.height = half * 2;
      const cx = c.getContext("2d");
      if (!cx) return { canvas: c, half };
      cx.translate(half, half);

      const [cr, cg, cb] = shardRgb;

      // Rays first, tapering triangles under the shard body.
      for (const ry of rays) {
        const tipX = ry.vx + Math.cos(ry.ang) * ry.len;
        const tipY = ry.vy + Math.sin(ry.ang) * ry.len;
        const perp = ry.ang + Math.PI / 2;
        const hw = Math.max(0.4, ry.len * 0.06);
        const grad = cx.createLinearGradient(ry.vx, ry.vy, tipX, tipY);
        grad.addColorStop(0, `rgba(${cr},${cg},${cb},${0.6 * ry.bright})`);
        grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        cx.beginPath();
        cx.moveTo(ry.vx + Math.cos(perp) * hw, ry.vy + Math.sin(perp) * hw);
        cx.lineTo(ry.vx - Math.cos(perp) * hw, ry.vy - Math.sin(perp) * hw);
        cx.lineTo(tipX, tipY);
        cx.closePath();
        cx.fillStyle = grad;
        cx.fill();
      }

      // Shard body with a soft radial fill so it catches light.
      const body = cx.createRadialGradient(0, 0, 0, 0, 0, r);
      body.addColorStop(0, `rgba(${cr},${cg},${cb},0.95)`);
      body.addColorStop(1, `rgba(${cr},${cg},${cb},0.55)`);
      cx.beginPath();
      cx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) cx.lineTo(pts[i].x, pts[i].y);
      cx.closePath();
      cx.fillStyle = body;
      cx.fill();

      return { canvas: c, half };
    }

    // Build stars, then assign the largest rayDensity fraction their rays.
    const stars: Star[] = Array.from({ length: STAR_COUNT }, (_, i) => {
      const q = (k: number) => rng(i * 11 + k);
      const roll = q(0);
      const tier = roll < 0.58 ? 0 : roll < 0.92 ? 1 : 2;
      const rRoll = q(6);
      const rNorm =
        tier === 0 ? rRoll * rRoll
        : tier === 1 ? rRoll * 0.6 + 0.15
        : Math.sqrt(rRoll) * 0.5 + 0.5;
      const r = lerp(cfg.sizeMin, cfg.sizeMax, rNorm);

      const oRoll = q(1);
      const baseOpacity =
        tier === 0 ? lerp(0.05, 0.34, oRoll * oRoll)
        : tier === 1 ? lerp(0.28, 0.9, oRoll)
        : lerp(0.7, 1.0, oRoll);

      return {
        x: q(3) * W, y: q(4) * H,
        vx: (q(5) - 0.5) * 0.10, vy: (q(9) - 0.5) * 0.10,
        r,
        baseOpacity: Math.min(1, baseOpacity) * cfg.opacity,
        colorClass: 0,
        dx: 0, dy: 0, dvx: 0, dvy: 0,
        phase: q(0) * Math.PI * 2,
        twAmp: lerp(0.08, 0.6, q(7)),
        twSpeed: lerp(0.008, 0.05, q(10)),
        twinkles: false,
        glow: tier === 2 ? lerp(0.6, 1, q(1)) : tier === 1 ? lerp(0, 0.35, q(1)) : 0,
        sprite: null,
        spriteHalf: 0,
      } as Star;
    });

    // Largest 10..15 percent (rayDensity) get rays.
    const bySize = [...stars].sort((a, b) => b.r - a.r);
    const rayCount = Math.round(stars.length * cfg.rayDensity);
    const rayMembers = new Set(bySize.slice(0, rayCount));
    // A small number of shards twinkle (opacity only), capped at 20.
    const twMembers = new Set(bySize.slice(0, Math.min(20, stars.length)));

    stars.forEach((s, i) => {
      const withRays = rayMembers.has(s);
      s.twinkles = twMembers.has(s);
      const { canvas: sprite, half } = buildSprite(i * 3 + 1, s.r, withRays);
      s.sprite = sprite;
      s.spriteHalf = half;
    });

    const lights: LightSource[] = LIGHT_SOURCES.map((l, i) => ({ ...l, phase: rng(i * 13) * Math.PI * 2 }));

    const darks: DarkPatch[] = Array.from({ length: DARK_COUNT }, (_, i) => {
      const q = (k: number) => rng(i * 17 + 200 + k);
      return { x: q(0), y: q(1), r: lerp(0.16, 0.44, q(2)), depth: lerp(0.35, 0.82, q(3)) };
    });

    const ar = parseInt(accentColor.slice(1, 3), 16);
    const ag = parseInt(accentColor.slice(3, 5), 16);
    const ab = parseInt(accentColor.slice(5, 7), 16);

    let frame = 0;
    let rafId = 0;

    function drawDarkness() {
      for (const d of darks) {
        const dx = d.x * W, dy = d.y * H;
        const dr = d.r * Math.max(W, H);
        const grad = ctx.createRadialGradient(dx, dy, 0, dx, dy, dr);
        grad.addColorStop(0,   `rgba(6,6,8,${d.depth})`);
        grad.addColorStop(0.55, `rgba(6,6,8,${d.depth * 0.45})`);
        grad.addColorStop(1,   `rgba(6,6,8,0)`);
        ctx.beginPath(); ctx.arc(dx, dy, dr, 0, Math.PI * 2);
        ctx.fillStyle = grad; ctx.fill();
      }
    }

    function drawStarGlow(t: number) {
      ctx.globalCompositeOperation = "lighter";
      for (const s of stars) {
        if (s.glow <= 0.01) continue;
        const sx = s.x + s.dx, sy = s.y + s.dy;
        const flick = reduceMotion ? 1 : 1 + Math.sin(t * 0.001 + s.phase) * 0.25;
        const gr = s.r * 28 * s.glow * flick;
        const [r, g, b] = shardRgb;
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, gr);
        grad.addColorStop(0, `rgba(${r},${g},${b},${0.05 * s.glow})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.beginPath(); ctx.arc(sx, sy, gr, 0, Math.PI * 2);
        ctx.fillStyle = grad; ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    function drawNebulae() {
      for (const nb of NEBULAE) {
        const nx = nb.x * W, ny = nb.y * H;
        const nr = nb.r * Math.min(W, H);
        const grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
        const [r, g, b] = nb.rgb;
        grad.addColorStop(0,   `rgba(${r},${g},${b},${nb.opacity})`);
        grad.addColorStop(0.4, `rgba(${r},${g},${b},${nb.opacity * 0.5})`);
        grad.addColorStop(1,   `rgba(${r},${g},${b},0)`);
        ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI * 2);
        ctx.fillStyle = grad; ctx.fill();
      }
    }

    function drawLightSources(t: number) {
      for (const ls of lights) {
        const lx = ls.x * W, ly = ls.y * H;
        const pulse = reduceMotion ? 1 : 1 + Math.sin(t * 0.0006 + ls.phase) * 0.18;
        const cr = ls.r * pulse;
        const [r, g, b] = ls.rgb;
        const blooms: [number, number][] = [
          [cr * 18, 0.012], [cr * 10, 0.028], [cr * 5, 0.06], [cr * 2.2, 0.18],
        ];
        for (const [rad, alpha] of blooms) {
          const g2 = ctx.createRadialGradient(lx, ly, 0, lx, ly, rad);
          g2.addColorStop(0,   `rgba(${r},${g},${b},${alpha})`);
          g2.addColorStop(0.3, `rgba(${r},${g},${b},${alpha * 0.4})`);
          g2.addColorStop(1,   `rgba(${r},${g},${b},0)`);
          ctx.beginPath(); ctx.arc(lx, ly, rad, 0, Math.PI * 2);
          ctx.fillStyle = g2; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(lx, ly, cr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},0.92)`; ctx.fill();
      }
    }

    function updatePhysics() {
      for (const s of stars) {
        s.vx += (Math.random() - 0.5) * 0.018;
        s.vy += (Math.random() - 0.5) * 0.018;
        s.vx *= 0.994; s.vy *= 0.994;
        const sp = Math.hypot(s.vx, s.vy);
        const maxSp = 0.5;
        if (sp > maxSp) { s.vx *= maxSp / sp; s.vy *= maxSp / sp; }
        s.x += s.vx; s.y += s.vy;
        if (s.x < -10) s.x += W + 20;
        if (s.x > W + 10) s.x -= W + 20;
        if (s.y < -10) s.y += H + 20;
        if (s.y > H + 10) s.y -= H + 20;

        if (!isMobile && mouse.active) {
          const mx = mouse.x - s.x, my = mouse.y - s.y;
          const d = Math.sqrt(mx * mx + my * my);
          if (d < ATTRACTOR_DIST && d > 1) {
            const str = 1 - d / ATTRACTOR_DIST;
            s.dvx = (s.dvx + mx * SPRING_K * str) * SPRING_DAMP;
            s.dvy = (s.dvy + my * SPRING_K * str) * SPRING_DAMP;
          } else { s.dvx *= SPRING_DAMP; s.dvy *= SPRING_DAMP; }
        } else if (isMobile) {
          s.dvx = Math.sin(frame * 0.004 + s.y * 0.005) * 0.25;
          s.dvy = Math.cos(frame * 0.003 + s.x * 0.005) * 0.25;
        } else { s.dvx *= SPRING_DAMP; s.dvy *= SPRING_DAMP; }
        s.dx = (s.dx + s.dvx) * 0.94;
        s.dy = (s.dy + s.dvy) * 0.94;
      }
    }

    function drawEdges() {
      for (let i = 0; i < stars.length; i++) {
        const a = stars[i], ax = a.x + a.dx, ay = a.y + a.dy;
        for (let j = i + 1; j < stars.length; j++) {
          const b = stars[j], bx = b.x + b.dx, by = b.y + b.dy;
          const d = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
          if (d > EDGE_DIST) continue;
          const alpha = (1 - d / EDGE_DIST) * 0.14;
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
          ctx.strokeStyle = `rgba(${ar},${ag},${ab},${alpha})`;
          ctx.lineWidth = 0.55; ctx.stroke();
        }
      }
    }

    function drawCursor() {
      if (isMobile || !mouse.active) return;
      for (const s of stars) {
        const sx = s.x + s.dx, sy = s.y + s.dy;
        const d = Math.sqrt((sx - mouse.x) ** 2 + (sy - mouse.y) ** 2);
        if (d > ATTRACTOR_DIST) continue;
        ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(sx, sy);
        ctx.strokeStyle = `rgba(${ar},${ag},${ab},${(1 - d / ATTRACTOR_DIST) * 0.50})`;
        ctx.lineWidth = 0.7; ctx.stroke();
      }
      const cg = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 80);
      cg.addColorStop(0, `rgba(${ar},${ag},${ab},0.09)`);
      cg.addColorStop(1, `rgba(${ar},${ag},${ab},0)`);
      ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 80, 0, Math.PI * 2);
      ctx.fillStyle = cg; ctx.fill();
    }

    // Blit the pre-rendered shard sprites. Twinkle, when present, is an opacity
    // change only, applied to under 20 shards.
    function drawStars() {
      for (const s of stars) {
        if (!s.sprite) continue;
        const sx = s.x + s.dx, sy = s.y + s.dy;
        let opacity = s.baseOpacity;
        if (s.twinkles && !reduceMotion) {
          opacity = Math.min(1, s.baseOpacity * (1 + Math.sin(frame * s.twSpeed + s.phase) * s.twAmp));
        }
        ctx.globalAlpha = opacity;
        ctx.drawImage(s.sprite, sx - s.spriteHalf, sy - s.spriteHalf);
      }
      ctx.globalAlpha = 1;
    }

    function paint(ts: number) {
      ctx.clearRect(0, 0, W, H);
      drawDarkness();
      drawNebulae();
      drawStarGlow(ts);
      drawLightSources(ts);
      if (!reduceMotion) updatePhysics();
      drawEdges();
      drawCursor();
      drawStars();
    }

    function tick(ts: number) {
      rafId = requestAnimationFrame(tick);
      frame++;
      paint(ts);
    }

    if (reduceMotion) {
      // Fully static: one paint, no animation loop.
      paint(0);
    } else {
      rafId = requestAnimationFrame(tick);
    }

    function onMouseMove(e: MouseEvent) { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; }
    function onMouseLeave() { mouse.active = false; }
    function onResize() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W; canvas.height = H;
      for (const s of stars) { s.x = rng(s.phase) * W; s.y = rng(s.phase * 3.7) * H; }
      if (reduceMotion) paint(0);
    }

    if (!isMobile) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseleave", onMouseLeave);
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("resize", onResize);
    };
  }, [accentColor, starConfig]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
    />
  );
}
