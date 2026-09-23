ROLE AND WORKING RULES
You are editing an existing portfolio site. Make ONLY the changes listed
below. Do not restructure files, rename components, swap libraries, or
"improve" anything I did not ask about. If a change requires touching
shared code, state what you touched and why in one line.

Work in this order: (1) fix the font bug, (2) global cleanups, (3) visual
features, (4) editor parity. After each numbered task, state in one
sentence what you changed and which file. Do not summarize the whole
project. Do not produce a design rationale essay.

For every task there is an ACCEPTANCE TEST. Verify each one before moving
on. If you cannot verify it, say so explicitly rather than claiming done.

Never use em dashes or en dashes anywhere in output: not in code
comments, not in UI copy, not in your replies to me.

================================================================
TASK 1 — FIX THE BROKEN FONT STYLE SELECTOR (highest priority)

Symptom: changing the font option in the editor produces no error and no
visible change on the site.

Do not guess. Check all four causes in order and report which one it was:
  a) Is the selected value reaching state and persisting to storage?
     Log the value at the moment of change and after a reload.
  b) Does the value write to a single source of truth, e.g.
     document.documentElement.style.setProperty('--font-display', value)
     or a theme context, and do components actually READ that token?
     Search the codebase for hardcoded font-family declarations and for
     Tailwind font-* utility classes that override it. These are the most
     common culprit.
  c) Are any class names built by string interpolation, like
     `font-${selected}`? Those are never generated at build time.
     Replace with an explicit lookup map of full class names, or with
     inline CSS variables.
  d) Is the chosen webfont actually loaded? If the family is applied but
     the font was never imported, it silently falls back and looks
     unchanged. Confirm the font loads in the network panel.

Requirements after the fix:
  - Three separate, independently settable tokens:
    --font-display (headings), --font-body (paragraphs), --font-data
    (numbers, metadata, tags).
  - Every component reads ONLY these tokens. Zero hardcoded font families
    anywhere. Remove any that exist.
  - Each choice loads its webfont on demand and declares a fallback stack.
  - The setting persists across reload and applies to the live site, not
    only the editor preview.

ACCEPTANCE TEST: change the display font, confirm the hero heading
visibly changes, reload the page, confirm it is still changed, and
confirm body and data fonts did not change.

================================================================
TASK 2 — REMOVE ALL LONG DASHES

Replace every em dash and en dash used as punctuation or as a separator,
site-wide, in copy, headings, labels, editor UI, and placeholder text.

Replacements:
  - Section labels: "01 — HERO PROJECT" becomes "01 Hero project" with
    the number in the data font, then a spacing gap, then the label.
    Use a thin rule or whitespace for separation, never a dash character.
  - Metadata lines: use a middot separator or a comma.
    "NSF REU · BYU · summer 2026" or "NSF REU, BYU, summer 2026".
  - In sentences: rewrite using a comma, a colon, or two sentences.
Also remove dash characters used as decorative dividers.

ACCEPTANCE TEST: searching the rendered page and all source files for the
em dash and en dash characters returns zero results in user-facing text.

================================================================
TASK 3 — LARGER SUBHEADINGS

Current subheadings read as small next to the display type. Raise them and
keep the scale rhythmic.

  h1 hero:    unchanged
  h2 section: clamp(40px, 5vw, 72px)
  h3 project: clamp(28px, 3.4vw, 44px)     <-- main increase
  h4 sub:     clamp(20px, 2.2vw, 28px)     <-- main increase
  eyebrow/metadata: 13px, data font, letter-spacing .08em

All of these must derive from the shared type scale, not from per-component
values, so one change updates everywhere. Expose the base scale as an
editor setting.

ACCEPTANCE TEST: every h3 and h4 on the page is visibly larger than
before, and changing the scale setting moves all of them together.

================================================================
TASK 4 — SHARD GEOMETRY STARS WITH REFRACTED RAYS

Replace the round glowing dots in the background with faceted shards.

Geometry:
  - Each star is an irregular polygon of 4 to 7 vertices, generated from a
    seeded random so it is identical on every visit.
  - Vertices sit at radius r * (0.55 to 1.0) around the center, at uneven
    angular spacing. No regular polygons, no symmetric sparkles.
  - Sizes vary widely: most stars 1 to 3px across, a few 8 to 14px.
  - Each shard has a random rotation and a slight scale on one axis, so it
    reads as a flake catching light, not as a dot.

Refracted rays (this is the part that must NOT look like a default sparkle):
  - Rays emit from the shard's VERTICES, not from its center, and not at
    even 90 degree spacing.
  - Ray direction = the outward normal at that vertex, so the shard's own
    geometry determines where light goes.
  - Ray length is proportional to the edge length adjacent to that vertex,
    so long facets throw long rays and short facets throw stubs.
  - Rays taper to a point and vary in brightness per vertex. Never draw
    four equal rays.
  - Add a small angular offset per ray, from the same seed, so rays bend
    slightly off-normal like refraction.
  - Only the largest 10 to 15 percent of shards get rays at all. The rest
    are bare geometry, otherwise the sky turns to noise.

Rendering and performance:
  - Draw once to an offscreen canvas at load and reuse. Do not redraw per
    frame. Twinkle, if any, is an opacity change only, on under 20 shards.
  - prefers-reduced-motion: fully static.

Editor controls: shard count, size range, ray density, ray length
multiplier, refraction offset amount, color, and opacity.

ACCEPTANCE TEST: zooming into any large star shows an irregular polygon
with unevenly spaced, unequal-length rays leaving its corners. No circles.
No four-point symmetric sparkles.

================================================================
TASK 5 — GLOBAL MEDIA SIDE SWAP SETTING

Right now the left/right swap applies only to featured projects. It must be
a global layout setting applying to EVERY record in every modular section:
projects, work experience, and project teams.

Implement as a single setting with three modes:
  "media left"       all records place media left, text right
  "media right"      all records place media right, text left
  "alternate"        odd records media left, even records media right
Plus a per-record override field that defaults to "inherit global".

Requirements:
  - One shared renderer honors this. Do not implement it separately per
    section. If three renderers currently exist, unify them first and say
    so.
  - The editor exposes the global setting once, in a place that clearly
    reads as global, plus the per-record override in each record's panel.
  - On screens under 860px the swap is ignored and everything stacks in
    source order, media first.

ACCEPTANCE TEST: switching the global setting visibly flips media sides in
projects AND work experience AND project teams simultaneously. A record
with an override stays put.

================================================================
TASK 6 — SELF INITIATED BUILDS AS A FOLDER

Replace the current card for self initiated builds with a folder object.

Visual:
  - A folder shape: a rectangular body with a raised tab in the top left,
    drawn in CSS or SVG, using existing theme tokens only.
  - The folder label reads exactly: Self initiated builds
    Set in the data font, positioned on or beside the tab.
  - Two file thumbnails sit inside or peeking out of the folder, slightly
    rotated at different angles and overlapping, so they read as loose
    papers in a folder. Each thumbnail is a real project image with its
    own caption and its own link.
  - Hover or focus: the two thumbnails fan apart slightly, 150ms. No other
    motion. Disabled under prefers-reduced-motion.

Behavior and accessibility:
  - The folder is not a single link. Each thumbnail is its own link to its
    own project. The folder itself is a labeled group, announced as
    "Self initiated builds, 2 projects".
  - Keyboard: both thumbnails are focusable in order, focus styles visible
    against both light and dark thumbnails.

Editor controls: folder label text, number of thumbnails (2 to 4),
which projects fill them, thumbnail rotation amount, and fan distance.

ACCEPTANCE TEST: the section renders as a recognizable folder with a
visible tab, the exact label text, and two independently clickable
thumbnails.

================================================================
TASK 7 — EDITOR PARITY AUDIT

Every property introduced in tasks 1 through 6 must be editable in the
editor. Audit the whole editor and close the gaps.

Must be editable:
  - three font tokens, type scale base, all five color tokens
  - star field: count, size range, ray density, ray length, refraction
    offset, opacity, color
  - global media side swap, plus per record override
  - folder: label, thumbnail count, thumbnail sources, rotation, fan
  - every record: title, context line, tags, metric value, metric label,
    body text, and every block's column, span, aspect, caption, alt text
  - section titles, section order, and section visibility toggles

Editor requirements:
  - Changes render live in the preview, no reload needed.
  - Settings persist across reload.
  - Alt text is required. Saving a media block without it is blocked with
    an inline message, not a silent failure.
  - A phone preview toggle sits next to the desktop preview.
  - An export control writes the full content as JSON I can download.

ACCEPTANCE TEST: produce a checklist of every setting above with a pass or
fail for "edits live", "persists after reload", and "visible on the public
site". Report any fail honestly instead of marking it done.

================================================================
FINAL OUTPUT

When all seven tasks are complete, give me:
  1. A numbered list, one line per task, saying what changed and where.
  2. The editor parity checklist from task 7.
  3. Any acceptance test you could not verify, stated plainly.
No screenshots described in prose, no design philosophy, no next steps
unless I ask.