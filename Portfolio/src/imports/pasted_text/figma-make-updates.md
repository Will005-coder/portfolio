# Prompt for Figma Make

Paste this into Figma Make, in the same project/thread where it already has my portfolio site's code loaded, so it edits the existing project rather than starting fresh.

---

I want you to update the existing portfolio site code you're showing, adding two new things. Don't redesign anything else — only add these features on top of the current site.

## 1. Hidden content editor with real auth + MFA (Supabase-backed)

- Set up Supabase for this project: a Postgres table (e.g. `site_content`) holding all editable content (hero text, project titles/descriptions, links, image references), and Supabase Auth for login.
- Move all editable content out of hardcoded components and have the live pages fetch it from the `site_content` table at load/build time.
- Create a single admin user account. Enable TOTP (authenticator-app) MFA enrollment for that account in Supabase Auth settings.
- Add a hidden route at `/edit-[random-slug]` (pick an obscure, non-guessable slug) that is NOT linked from anywhere in the site nav or sitemap.
- That route must:
  - Show a login form (email/password) followed by a TOTP code prompt (MFA) before revealing anything else. Use Supabase's built-in auth + MFA flows rather than custom-rolled auth.
  - Once authenticated, render an editor UI: one form section per content area (hero, each project, contact/links) with fields matching the `site_content` table's columns.
  - A separate "Design" tab exposing the site's design tokens as editable controls: color swatches/pickers for the current palette, font selectors, and spacing/scale sliders if the site uses a spacing scale. Store these in a `design_tokens` table (or a row in `site_content`) the same way.
  - Live preview: changes in the form should update a preview of the actual site in real time.
  - Saves should write directly to Supabase (auto-save or an explicit "Save" button) — no file export, no manual git commit needed.
- Set up Supabase Row Level Security (RLS) so only the authenticated admin user can write to `site_content` / `design_tokens`; reads for the public site can remain open (or also gated through an API route) since it's just rendering, not sensitive data.
- Clearly comment in the code that this route is intentionally unlinked in the site nav, but note that real security now comes from the Supabase auth + MFA gate, not obscurity.

## 2. Animated dotted-line background (depth + warmth)

- Add a full-viewport background layer, behind all content (z-index below everything, non-interactive/pointer-events: none except for tracking cursor position).
- A single continuous stroke (one path, dashed/dotted style — not multiple particles), rendered in a warm accent color at low opacity (subtle, not distracting from content).
- Idle state: the line should have gentle, continuous ambient motion (slow drift/breathing), so it never looks static.
- On mouse movement: the line should respond with spring/lag physics — like it's being gently pulled toward the cursor rather than snapping to it — so it feels alive and organic, not mechanical.
- Should work smoothly on both desktop (mouse) and gracefully degrade on mobile (e.g., idle animation only, no touch-tracking required).
- Keep performance in mind: this should be lightweight (canvas or SVG + requestAnimationFrame), not a heavy particle library.

Please show me the updated code for both features, and point out exactly which existing files you modified vs. which are new.

---

# Round 2 additions (same project, building on the above)

## 3. Background line: full roam + velocity-based color

- Remove any horizontal/vertical clamping that keeps the line confined to one region — it should be able to travel genuinely edge-to-edge across the full viewport, like it's swimming across the screen, not bounded to a lane.
- Shift the stroke's color based on its current movement (e.g., direction and/or speed), rather than a single static color. Keep it subtle and warm — this is a hue/tone shift, not a rainbow effect.

## 4. Fix broken navigation

- Audit all "go to another page/section" buttons/links across the site and fix any that currently don't navigate correctly (dead links, wrong routes, or buttons that don't trigger navigation at all).

## 5. New "About" page (Supabase-backed, editable)

- Add a new About page/section to the live site.
- Its content (bio text, etc.) should live in Supabase (same pattern as the rest of the content) and be editable from the hidden admin panel.

## 6. Slide-builder feature in the admin panel

- In the admin panel, add a feature for building an embedded slideshow (Canva/PowerPoint-style) that can be placed on the live site.
- Slides auto-advance on a timer that I can set.
- Auto-advance pauses when the cursor is hovering over the slideshow, and resumes when the cursor leaves.
- I should be able to add/reorder/delete slides and edit their content from the admin panel, with the changes saved to Supabase like the rest of the content.

## 7. "Viewing As" persona bar

- Add a bar at the very top of the site — the first thing that renders, before the rest of the page content loads in — that lets a visitor toggle between a few viewer personas (e.g., "Recruiter," "Grad School," etc. — use placeholder labels I can rename later).
- Selecting a persona swaps the hero/quick-pitch text and the first blurb/intro text to a version tailored to that persona.
- Each persona's version of that content must be stored in Supabase and editable from the admin panel — not hardcoded — so I can rewrite the pitch for each audience without asking for a new prompt.

## 8. Left-side bust/headshot photo

- Add a spot on the left side of the page for a bust/headshot photo.
- In the admin panel, let me control its display size (e.g., a slider or size input), stored in Supabase alongside the other design/content settings, so it persists.

Please show me the updated code for all of the above, and point out exactly which existing files you modified vs. which are new.