# Plan: William Dakare Robotics Engineering Portfolio

## Context

The user's pasted brief is a detailed design analysis + ready-to-build Figma Make prompt for a personal engineering portfolio site for William Dakare (BS MechE, Boston University '29). The core problem it identifies is **flat visual hierarchy** — every project at equal weight — and prescribes a strict three-tier dominance structure: one hero, two featured, several compact "more" items.

The goal is a full single-page portfolio with smooth-scroll sections, externalized content data layer, and a tone of "confident, restrained, minimalist" aimed at robotics recruiters and grad-school admissions.

---

## Aesthetic Stance

**Minimalist-technical, dark canvas.** Full commitment.

- **Ground**: near-black `#0A0A0A` with off-white `#F0F0EC` text — creates maximum contrast and reads as engineered-artifact rather than corporate SaaS.
- **Single accent**: acid lime `#C8FF00` — distinctive, non-default, resonates with test equipment / oscilloscope aesthetics without being garish. Used only for CTAs, active states, and metric callouts.
- **Fonts**:
  - **Display/headings**: `Instrument Serif` (Google Fonts) — elegant optical serif with italic, not in banned list, gives technical-human warmth to headings
  - **Body**: `Inter` — clear, professional, 17px / line-height 1.55
  - **Mono labels**: `JetBrains Mono` — tech-stack tags, section labels, metric chips
- **Spacing scale**: 8 / 16 / 24 / 32 / 48 / 64 / 96 / 128px via Tailwind
- **Borders**: `rgba(255,255,255,0.08)` hairlines — organizes without bullying
- **Radius**: `0.25rem` — nearly square, technical feel

---

## Token Changes (`src/styles/theme.css`)

Update `:root` and `.dark` block values (keep all token names and `@theme inline` intact):

```
--background: #0A0A0A
--foreground: #F0F0EC
--card: #131313
--card-foreground: #F0F0EC
--primary: #C8FF00          ← acid lime accent
--primary-foreground: #0A0A0A
--secondary: #1C1C1C
--secondary-foreground: #F0F0EC
--muted: #1C1C1C
--muted-foreground: #6E6E68
--accent: #1F2010           ← desaturated lime tint for hover surfaces
--accent-foreground: #C8FF00
--border: rgba(255,255,255,0.08)
--ring: #C8FF00
--radius: 0.25rem
```

The `.dark` block can mirror `:root` since the design is already dark.

---

## Font Wiring (`src/styles/fonts.css`)

```css
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500&family=JetBrains+Mono:wght@400;500&display=swap');
```

Apply in `App.tsx` via Tailwind class names and inline font-family where needed.

---

## Content Data Layer (`src/app/content.ts`)

Export a single `PORTFOLIO` const with typed sections:

```ts
projects: [
  { slug, tier: "hero"|"featured"|"more", title, subtitle, summary, body_markdown, metrics[], tags[], hero_image, gallery[], video_url }
]
hero: { name, role, institution, year, tagline, credentials[], cta_links[] }
about: { bio }
skills: { groups: [{ label, items[] }] }
```

All display text lives here. Components only read from this object — no hard-coded copy inside JSX.

---

## Component Structure (all in `src/app/App.tsx`)

Single file, multiple internal components:

1. **`<Nav />`** — sticky top bar: name left, anchor links right (Work / About / Skills / Contact). Thin 1px border-bottom. Disappears on scroll-down, reappears on scroll-up.

2. **`<Hero />`** — above-the-fold. Left: large display name `William Dakare` in Instrument Serif italic + role line + tagline + credential chips + CTA buttons (Résumé, GitHub, LinkedIn, Email). Right: a subtle engineering diagram / grid motif (CSS-drawn, no image dependency). `min-h-screen`.

3. **`<HeroProject />`** (Level 1) — full-width band with high contrast. Left half: oversized project title, case-study arc (Problem → Constraints → Approach → Iteration → Result → Future Work) rendered from markdown, metrics as large callout numbers. Right half: video embed placeholder (16:9 ratio box with play icon) + CAD render image slot. Visually dominant: title ~72px, section uses `bg-secondary` band.

4. **`<FeaturedProjects />`** (Level 2) — two cards side-by-side. Each: project title (32px), one quantified metric callout (large mono), 3-sentence summary, tech tags, image/video slot, "Read case study →" link. Clearly smaller than Level 1.

5. **`<MoreProjects />`** (Level 3) — compact table-style list: title + one-line + tech tags + arrow. No images. Maximum restraint.

6. **`<About />`** — single column, constrained to ~680px, first-person bio from content layer.

7. **`<Skills />`** — grouped by category. Tag chips in JetBrains Mono. Minimal, scannable.

8. **`<Footer />`** — email, GitHub, LinkedIn, résumé. Small, generous top padding.

---

## Navigation Behavior

- Smooth-scroll on anchor click (CSS `scroll-behavior: smooth`)
- Active section highlight in nav using `IntersectionObserver`
- No routing library needed (pure scroll-based single page)

---

## Responsive Breakpoint

At `< 1024px`:
- Nav collapses to hamburger (use `useState`)
- Hero splits to single column
- HeroProject stacks media below text
- FeaturedProjects stack to single column

---

## Verification

1. Check three-tier visual dominance: hero band height >> featured card height >> list item height
2. Verify accent (`#C8FF00`) appears only on CTAs, metric callouts, and focus rings — not decoratively
3. Confirm all display text traces back to `content.ts`, not JSX strings
4. Check contrast: off-white `#F0F0EC` on `#0A0A0A` = ~18:1 (well above AA)
5. Tab through page to verify focus rings are visible
6. Resize to 768px to confirm responsive collapse works
