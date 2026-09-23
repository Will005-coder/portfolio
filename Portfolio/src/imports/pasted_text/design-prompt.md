Since you're short on time, I made the open design calls for you and listed them at the bottom so you can override any of them. First, a quick picture of the math, so you can explain it in an interview:

## The math: "grow, then break"

```
  GROW  (golden-angle spiral)          BREAK  (Voronoi fracture)
  how sunflowers place seeds           every point belongs to its nearest seed

        · 3                            ┌────┬──────┬────┐
    5 ·    · 1                         │ 5  │  1   │ 3  │   cells "grow" from seeds
      · ★ ·        ──────────►         ├───┬┴──────┴┬───┤   at equal speed; the lines
    2 ·    · 4                         │ 2 │   ★    │ 4 │   where they collide = cracks
        · 6                            └───┴────────┴───┘
  r = c·√n,  θ = n × 137.5°            (same geometry as dried mud,
  deterministic, never repeats         basalt columns, metal grains)

  SCATTER  (impact fracture)
  each shard flies AWAY from the break point, farther if it started farther out
```

It's non-uniform, but not random: the same seeds give the same shards every time the page loads. Placing the hero project's seed apart from the others gives it the biggest cell automatically.

## Your Figma Make prompt

```text
PROJECT: Redesign the hero header of my engineering portfolio (William Dakare, Mechanical Engineering, Boston University '29). Keep the existing site structure and routing. Replace the generic cream/serif template look with a distinct visual signature: a "shattered collage" header in an archive + workspace aesthetic.

CONCEPT (put this in DESIGN_NOTES.md)
The shards are a collage of who I am. On landing, the header shows one calm, organized pane: the polished front a recruiter expects. Scrolling breaks it open into irregular shards, each one a photo of something I built. Individually, a shard shows one skill. Scattered together, they show the person. The cracks are intentional because they represent iteration.

LAYOUT (desktop)
- Left column (~35%): name "WILLIAM DAKARE" in Archivo (bold, tight tracking). Beneath it: "Mechanical Engineering · Boston University '29". Then three stamped mono labels: ITERATIVE DESIGN / EDGE CASE VALIDATION / CHARACTERIZED PROTOTYPE. Then: "Seeking Summer 2027 internships in robotics R&D, mechatronics, and hardware." Then buttons: Résumé (primary), GitHub, LinkedIn, Email. Text always sits above the shards (z-index), and shards never cover the buttons.
- Right area (~65%): a rectangular pane, roughly 3:2, made of 6 Voronoi shards.
- Move the headshot to the About section.

SHARD GEOMETRY (deterministic Voronoi, no Math.random anywhere)
- Use d3-delaunay: Delaunay.from(seeds).voronoi([0,0,w,h]), then cellPolygon(i) for each shard. Render each shard as an SVG polygon clipPath over an <image>.
- Seed placement uses a golden-angle spiral: seed n at radius r = c·sqrt(n+0.5), angle n·137.508°, centered at 55% width / 50% height of the pane.
- Then override the hero seed (index 0) so it is isolated from the others, which makes its cell the largest. Apply exactly 1 iteration of Lloyd relaxation, so the cells stay irregular but balanced. Clamp every cell to at least 8% of the pane area.
- Add 3–4 thin decorative slivers along the crack lines (tiny secondary Voronoi cells inside the two largest shards, image-less, aria-hidden) for realism.
- Draw a 1.5px off-white stroke along every crack, like the edge of a photo print.

SHARD DATA (src/data/shards.ts; editable, so I can swap photos)
Each entry: { id, title, slug, image, tag (one of the 3 words), seedIndex }
0 Isoperimetric Soft Robot, BYU NSF REU (hero, tag: characterized prototype)
1 4 mm Bronchoscopy Soft Robot, BU Material Robotics Lab (iterative design)
2 Transparent Lung Path Simulator, Onshape (iterative design)
3 VLA-Assisted Prosthetic Gripper (edge case validation)
4 BU Mars Rover Drivetrain Controls (edge case validation)
5 Terrier Motorsport AMS/BMS (characterized prototype)
Use the image placeholders I upload; label each FIG. 01–06.

SCROLL BEHAVIOR (framer-motion useScroll)
- The header wrapper is 200vh with a sticky 100vh inner. progress = scroll through the wrapper, 0→1, eased with smoothstep.
- progress 0: shards sit flush. The whole pane shows ONE unified image (the hero robot photo) cropped across all shards, with the cracks barely visible.
- progress 0.15→0.5: each shard crossfades from its crop of the unified image to its own project photo.
- progress 0→1: each shard translates along the vector from the pane's break point (the hero seed) to the shard's centroid. Distance = 0.6 × that vector length × progress. Rotation = ±(8°–24°), with sign and size derived from the vector's angle (deterministic). Scale 1→0.85.
- At progress 1, the shards rest on the "floor" like scattered prints. Small tape "✕" markers sit where each one lands. Then the page continues to the case studies.

INTERACTION
- Hover: the photo shifts from faded/desaturated to full color, lifts 4px, a hand-drawn grease-pencil circle animates around it (SVG stroke-dashoffset), and a caption appears: "FIG. 03 · Lung Path Simulator · ITERATIVE DESIGN".
- Click: smooth-scroll to that project's case study anchor (#slug) on the same page.
- Keyboard: shards are focusable buttons in reading order, with visible focus rings and descriptive aria-labels.

AESTHETIC: ARCHIVE + WORKSPACE
- Background: dark concrete #34332F with a subtle SVG feTurbulence grain overlay (~6% opacity) and one thin safety-yellow line (#F2C230) as a section divider.
- Text: #F2F0EB primary, #B9B6AE secondary (must pass WCAG AA on the background).
- Accent: safety yellow #F2C230 for highlights and the active label. Robot blue #2F8FE0 for links only.
- Fonts: Archivo (headings), IBM Plex Mono (labels, FIG numbers, tags). No italic serif anywhere.
- No pink gradient blobs, no pill-heavy UI. Tags look like stamped labels with square corners.

RESPONSIVE + ACCESSIBILITY
- Under 768px: stack the name above the pane, reduce the scatter distance to 35%, and make the header wrapper 150vh. Tap = open the case study.
- prefers-reduced-motion: skip the scroll animation and show the shards slightly separated (static progress 0.3), with a simple fade on hover.
- All images need alt text describing the actual hardware.

ALSO FIX ELSEWHERE ON THE SITE
- Remove the "★ Recommended for Companies" badge; use "Featured" instead.
- Remove the "0% max strain" and "2:1 mechanical advantage" stat blocks. Keep only measured outcomes (<8% FEA vs. experiment deviation, 350% bend angle increase).
- Replace "Demo video coming soon" with a real project photo.
- Split "Self-Initiated Builds" into separate cards so each metric belongs to exactly one project.
- Renumber sections sequentially (no jump from 03 to 06).
- Open the "Iteration & Failure" accordion by default.
- Remove the duplicate "Mechanical Engineering … BS MechE" wording.
```

## Decisions I made for you

```
 DECISION                              WHY
 ─────────────────────────────────────────────────────────────────────
 Landing = ONE robot photo that        more "whoa" than 6 separate photos,
 splits into 6 project photos          and it's your most unique image
 Headshot → About section              a shattering face reads morbid
 All 6 shards = work                   you asked for that; the personal
                                       collage lives in About
 Click → same-page case study          a recruiter never loses their place
 Dark concrete, not cream              workspace floor + fixes "generic"
```

Before you run it, attach your 6 photos to Figma Make and name the files after the shard titles. If the first output is messy, run the prompt in two passes: first everything up to **SCROLL BEHAVIOR** (static layout), then the rest (motion). Figma Make tends to handle one focused job better than everything at once.