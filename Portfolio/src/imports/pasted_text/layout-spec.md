Your sketch is clear, and the one thing worth flagging before commands: "arbitrary % size and position" is the request, but pure free positioning breaks the moment someone opens it on a phone. The version that gives you the same freedom without that failure is a **12-column grid with free spans**, where you set size as a span and the grid handles reflow.

```
  FREE POSITIONING              GRID SPANS (what I'd build)
  x:37.2%  y:14.8%  w:41%   →   col 5-9, rows 2-4, aspect 4:3
  ─────────────────────         ─────────────────────
  looks arbitrary ✓             looks arbitrary ✓
  pixel-perfect on your         reflows to 1 column on mobile
    monitor only ✗                automatically ✓
  every block needs a           one rule handles all ✓
    separate mobile value ✗
  drifts out of alignment ✗     stays aligned by construction ✓
```

12 columns gives 8.33% steps, and holding Shift can drop to half-steps for 4.17% if you want finer control. That's effectively arbitrary while staying responsive.

## Page map from your sketch

```
 00 NAV        [WD]                          WHO'S THERE? | About
 ─────────────────────────────────────────────────────────────────
 01 HERO       ╱1╲ ╱4╲ ╱5╲        7 shards, numbered
               ╲2╱ ╲3╱ ╲6╱ ╲7╱    1-7 = project photos
                   (you, center)   torn hole = your portrait
 ─────────────────────────────────────────────────────────────────
 02 ABOUT ME   ┌────────┐  paragraph lines
               │ torn   │  personal, not a résumé restatement
               │ photo  │
               └────────┘
 ─────────────────────────────────────────────────────────────────
 03 PROJECTS   "Featured"
               ┌─────────────────────────────────┐
               │ [media]  │ title + body         │  ← modular zone
               │ text     │ [media] [media]      │     you compose
               │          │ [ + add block ]      │
               └─────────────────────────────────┘
 ─────────────────────────────────────────────────────────────────
 04 WORK EXPERIENCE   same modular format ──┐
 05 PROJECT TEAMS     same modular format ──┴─ ONE renderer, 3 uses
 ─────────────────────────────────────────────────────────────────
 06 CONTACT
```

The red "same format" arrows in your sketch are the most important thing on the page. Sections 03, 04, and 05 should be the same component fed different data, so a layout improvement you make once improves all three.

## Layout commands

```
LAYOUT SYSTEM
- Grid: 12 columns, gutter 24px, max content width 1180px.
- Sections stack vertically, each with an id: hero, about, projects,
  experience, teams, contact.
- Section numbering is sequential with NO gaps (fix the 01,02,03,06 bug).
- Below 860px: every block collapses to full width, in source order.
- Below 1180px: spans scale proportionally, never below 4 columns for
  a media block (anything narrower is unreadable).

SECTION 00 - NAV
  Left: monogram WD. Right: Work, About, Contact, Résumé.
  "WHO'S THERE?" stays as the hero's own headline or a hover easter egg,
  NOT as a nav label. A recruiter scanning nav needs literal words.

SECTION 01 - HERO (shatter)
  Pinned 230vh. Intact pane on landing, 7 numbered shards + center
  portrait shard. Scroll scatters. Shards link to project anchors.
  Full spec as written in the scatter prompt.

SECTION 02 - ABOUT ME
  Torn-edge photo block, cols 1-4. Text block, cols 6-12, max 60ch.
  Content rule: things NOT on the résumé. NYC, QuestBridge, what you
  build when nobody assigns it.

SECTION 03/04/05 - MODULAR RECORD SECTIONS
  One renderer, three data files: projects.json, experience.json,
  teams.json. Each record = header fields + an array of blocks.
  Renderer never hardcodes a layout; it reads spans from the data.

SECTION 06 - CONTACT
  Email, LinkedIn, GitHub, résumé. One line each. No form.
```

## The block schema

This is what your editor writes and your renderer reads:

```json
{
  "id": "iso-robot",
  "title": "Isoperimetric soft robot modeling",
  "where": "NSF REU, BYU Compliant Mechanisms Lab",
  "tags": ["SolidWorks", "MATLAB", "FEA"],
  "kind": "characterized-prototype",
  "blocks": [
    { "type": "image", "src": "iso-rig.jpg", "col": 1, "span": 7,
      "aspect": "4:3", "fit": "cover", "caption": "The loading rig" },
    { "type": "text",  "body": "...", "col": 8, "span": 5 },
    { "type": "stat",  "value": "<8%", "label": "FEA vs measured",
      "col": 8, "span": 5 },
    { "type": "video", "src": "bend.mp4", "col": 1, "span": 4,
      "aspect": "16:9", "autoplay": "in-view", "loop": true },
    { "type": "loop",  "frames": ["v1.jpg","v2.jpg","v13.jpg"],
      "trigger": "scroll", "col": 5, "span": 8, "aspect": "16:9" }
  ]
}
```

Five block types cover everything in your sketch: `image`, `video`, `loop` (your triggered loop slides), `text`, and `stat`. The `loop` type is the interesting one, since scrubbing v1 → v13 of the lung model as the user scrolls *is* your "iterative design" phrase made visible.

## Editor design

```
 ┌─ EDIT MODE  (?edit=1, never shipped to visitors) ──────────────┐
 │                                                                 │
 │  ┌───────────┐ ┌───────────────────┐   grid overlay visible     │
 │  │  [image]  │ │      [text]       │   while dragging           │
 │  │  ┌ ─ ─ ─ ─┤ │                   │                            │
 │  │  │ cols 1-7│ └───────────────────┘   drag right edge →       │
 │  └──┴─ ─ ─ ─ ─┘                          snaps to columns       │
 │      ↑ live readout: "7 cols · 58% · 4:3"                      │
 │                                                                 │
 │  selected block panel ──────────────────┐                      │
 │   type  [image ▾]   aspect [4:3 ▾]      │  ← arrow keys nudge  │
 │   span  [━━━━━●───] 7 of 12             │     shift = half-step│
 │   fit   (cover) (contain)               │                      │
 │   alt   [required, blocks save if empty]│                      │
 │  ─────────────────────────────────────  │                      │
 │  [ desktop | tablet | phone ] preview    │                      │
 │  [ + image ] [ + video ] [ + loop ] [ + text ] [ + stat ]      │
 │  [ Copy JSON ]  [ Download projects.json ]                     │
 └─────────────────────────────────────────────────────────────────┘
```

Six ideas worth building into it:

1. **Presets before freedom.** Ship 5 named layouts (Wide media + side text, Two-up, Media strip, Text-led, Stat hero). You pick a preset, then adjust. Blank-canvas composing is how portfolios stall.
2. **Phone preview toggle, always visible.** One click shows the collapsed stack. You'll catch broken layouts while composing instead of after deploying.
3. **Blocking validation.** Save is disabled without alt text, and it warns on media over 2MB. Quality rules you can't skip beat quality rules you remember.
4. **Reorder by drag in a list, resize on the canvas.** Two separate gestures. Dragging blocks freely around a canvas *and* resizing them is where these editors get fiddly.
5. **Versioned JSON, not a database.** The editor's output is a text file you commit. Your history lives in git, rollback is `git revert`, and there's no backend to maintain or pay for.
6. **Loop-block scrubber.** For `loop` blocks, a timeline strip to reorder frames and set whether the trigger is scroll, hover, or auto.

On saving, since you're on the two-repo GitHub Pages setup:

| Approach | Effort | Tradeoff |
|---|---|---|
| Edit mode → Download JSON → commit by hand | Lowest | Two manual steps per edit |
| Edit mode → GitHub API with a personal token | Medium | Token handling; commits from the browser |
| A git-based CMS (Decap, Tina) | Highest | Real admin UI, but a whole dependency to learn |

For a portfolio you'll edit maybe monthly, the first one is almost certainly right, and you can upgrade later without changing the schema.

---

Three questions before I write the renderer and editor prompts:

1. **Where do the 7 hero shards get their numbers?** Should shard order be fixed in the JSON (so you control which project is shard 1), or derived from the projects file order automatically?

2. **What's actually in a `loop` block for you?** Onshape version screenshots, a bend-test video scrubbed frame by frame, or FEA iterations? The answer decides whether `frames` should be images or a video with a scroll-linked playhead.

3. **Does "WHO'S THERE?" stay?** It's a strong, memorable line for the hero given the torn hole, but it's a bad nav label. Do you want it as the hero headline, or is it doing something else in your head?