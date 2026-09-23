# Plan: Constellation Background

## Context

The current `AnimatedBackground` draws two spring-physics bezier curves that follow the cursor — functional but generic. The user wants a richer, more characterful treatment that fits the dark-concrete palette (#34332F / #F2C230 / #F2F0EB) and the shard/crystal geometry aesthetic of the existing Voronoi header. A constellation abstraction — drifting star nodes connected by glowing edges, with cursor attraction — is both distinctive and appropriate to the technical/space personality of the site.

The sketch (IMG_0161) also confirms the theme direction: fractured-shard hero cards, structural layout, hand-crafted feel.

---

## What changes

### 1. `src/styles/theme.css` — correct the palette
The file currently has `--background: #0A0A0A` and `--primary: #C8FF00`. Update to match the spec:
- `--background: #34332F`
- `--primary: #F2C230`
- `--foreground: #F2F0EB`
- Keep all other token names intact (the `@theme inline` contract must not change).

### 2. New file: `src/app/ConstellationBackground.tsx`
Replace the bezier-spring `AnimatedBackground` with a canvas-based constellation layer. Props: `accentColor: string` (receives `#F2C230`).

**Star nodes (~180 total)**
- Spawn at random positions on mount, with tiny random velocity (≤0.15 px/frame).
- Wrap at canvas edges (toroidal).
- Two size tiers: background stars (r 0.5–1.2px, opacity 0.15–0.45) and foreground stars (r 1.5–2.8px, opacity 0.5–0.9).
- Tint: interpolate between `#F2F0EB` (white-warm) and `#F2C230` (gold) — each star gets a fixed hue bias on spawn.

**Edges**
- Draw lines between any two stars within 130px. Edge opacity = `(1 - dist/130) * 0.18` — subtle, not noisy.
- Color: `#F2C230` at computed opacity.

**Cursor attractor**
- Track mouse position. Stars within 200px apply a soft spring pull (stiffness ~0.012, damping 0.88) toward cursor.
- Cursor node itself connects to nearby stars with brighter edges (opacity up to 0.55) creating a local "constellation" that forms and dissolves as the user moves.
- Radial gradient glow at cursor: `#F2C230` 0→transparent, radius 80px, very low opacity (~0.08).

**Mobile fallback**
- On `pointer: coarse`, skip cursor tracking; stars drift with a gentle sinusoidal tide instead (same pattern as existing `AnimatedBackground`).

**Canvas sizing / cleanup**
- Same `resize` listener and `cancelAnimationFrame` cleanup as the existing component.

### 3. `src/app/App.tsx` — swap component
- Remove `import AnimatedBackground` and the `SHOW_ANIMATED_BACKGROUND` flag.
- Import and render `ConstellationBackground` unconditionally (it's always on).
- Pass `accentColor` from the active theme's primary color (or hardcode `"#F2C230"` since the palette is now fixed).

---

## Files modified
| File | Change |
|---|---|
| `src/styles/theme.css` | Update `--background`, `--primary`, `--foreground` values |
| `src/app/ConstellationBackground.tsx` | New file — constellation canvas layer |
| `src/app/App.tsx` | Swap `AnimatedBackground` → `ConstellationBackground` |
| `src/app/AnimatedBackground.tsx` | No change (keep in place for now; it becomes dead code) |

---

## Verification
1. Dev server starts without TypeScript errors.
2. Constellation renders over the dark concrete background (#34332F).
3. Moving the mouse forms and dissolves local star clusters with golden edges.
4. No stray italic font usage introduced.
5. Existing sections (Nav, Hero, About, etc.) remain readable — constellation sits behind all content at z-index 0.
