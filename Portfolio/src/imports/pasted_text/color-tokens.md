COLOR SYSTEM: DARK BROWN FIELD, SAGE ACCENT
Replace every existing colour value with these tokens. No colour literal
appears anywhere in the codebase outside this block.

TOKENS
  --field          #2A241C   dark brown. Page background, roughly 60% of
                             every screen.
  --field-raised   #352E24   very slightly lifted brown. Nav bar, footer,
                             any panel that sits on the field without
                             becoming a card.
  --surface        #E4E2D2   light sage-tinted sheet. Cards, project
                             blocks, anything containing a paragraph.
                             About 30% of a screen.
  --ink            #EDEADC   primary text ON the field.
  --ink-muted      #C4C2B2   secondary text on the field: captions,
                             metadata, status lines. 15px and above only.
  --ink-on-surface #25291F   all text inside a card. Near-black green-brown.
  --accent         #A9BCA3   LIGHT sage. Links, stat numbers and active
                             states ON the dark field.
  --accent-surface #4F5C4B   DARK sage. Links and stat numbers INSIDE a
                             light card. Never used on the field.
  --accent-fill    #8A9A86   mid sage. Button and tag backgrounds only,
                             never a text colour.
  --on-accent      #1B211A   labels sitting on --accent-fill.
  --edge           #463F33   hairlines, dividers, card borders, rules.

THE TWO ACCENT RULE
This is the part most implementations get wrong. Sage has to change value
depending on what it sits on:
  on --field   use --accent          (light sage, 6.4:1)
  on --surface use --accent-surface  (dark sage, 6.2:1)
Never use --accent inside a card, and never use --accent-surface on the
field. Build one helper that picks the right one based on the container,
so a component cannot choose wrongly.

ROLE SPLIT
  --field    60% of the visible page
  --surface  30%, wherever someone reads more than one sentence
  sage       under 8% total, across links, stats, tags and buttons
Headings use --ink on the field and --ink-on-surface in cards. Headings
are never sage. One accent signal per block: if a block has a sage stat,
its link is plain --ink with an underline.

CONTRAST GATES (verify, do not assume; report actual measured values)
  --ink on --field                 target 11:1     minimum 7:1
  --ink-muted on --field           minimum 4.5:1, only at 15px and up
  --ink-on-surface on --surface    target 12:1     minimum 7:1
  --accent on --field              minimum 4.5:1
  --accent-surface on --surface    minimum 4.5:1
  --on-accent on --accent-fill     minimum 4.5:1
If any pair fails, adjust lightness only, keep the hue, and tell me the
new value and why.

APPLIED TO COMPONENTS
  Page background        --field
  Nav                    --field-raised, 1px --edge hairline below,
                         links --ink, hover --accent
  Hero shard collage     photos unfiltered, full colour, 1px of --field
                         showing between cells as fracture lines. No
                         sage tint over photos, no duotone.
  Hero name line         --ink, data font
  Hero blurb             --ink-muted
  Project cards          --surface background, --ink-on-surface text,
                         1px --edge border, no drop shadow
  Stat numbers           --accent-surface inside cards, --accent on field
  Links                  sage per the two accent rule, 1px underline,
                         offset 4px, thickens on hover
  Primary button         --accent-fill background, --on-accent label
  Secondary button       transparent, 1px --edge border, --ink label
  Tags                   --ink-muted text, middot separated, no pills
  Folder (self initiated builds)
                         --surface body, --field-raised tab, thumbnails
                         unfiltered
  Focus ring             2px --accent, 3px offset, never removed. Verify
                         it is visible against --field, --surface AND on
                         top of photographs.
  Selection              --accent-fill at 30%
  Scrollbar / progress   --accent on --field-raised track

IMAGES ON A DARK FIELD
Photos carry more weight here than in a light theme, so:
  - No filters, no overlays, no tinting.
  - Give every photo a 1px --edge border or a 2px --field-raised inset so
    bright images do not bleed into the background.
  - Placeholder state: --field-raised block, --ink-muted mono label
    "PHOTO PENDING", 1px --edge border.

DARK MODE HANDLING
This theme is already dark. Do NOT build a second dark mode. If the
visitor's system prefers light, keep this palette and set
color-scheme: dark so form controls and scrollbars match.

WHAT NOT TO DO
  - No brown text on brown. Body text is always --ink or --ink-on-surface.
  - No pure black and no pure white anywhere.
  - No second accent hue for success, error or hover states. Use
    opacity, weight and underline changes.
  - No gradients, no glows, no texture overlays, no background canvas.
  - No sage washes over photographs.

EDITOR REQUIREMENTS
  - All eleven tokens editable with colour inputs, grouped as Field,
    Surface, Ink, Accent.
  - Live computed contrast shown beside each relevant pair, marked pass
    or fail against the gates above.
  - A one-click "reset to dark brown and sage" restoring these values.
  - Changes apply live and persist across reload.

ALTERNATIVE VARIANT (build only if I ask)
All-dark cards: --surface becomes #352E24, --ink-on-surface becomes
--ink, and --accent-surface is dropped since only the light sage is
needed. Moodier and more consistent, but long paragraphs are harder to
read. Default stays light cards.

ACCEPTANCE TESTS
  1. No colour literal exists outside the token block.
  2. Every measured contrast gate passes; report the actual numbers.
  3. A sage link on the dark field and a sage stat inside a light card
     are visibly different values, and neither appears in the wrong
     context.
  4. Focus rings are clearly visible on the field, on a card, and on top
     of a photograph.
  5. Switching the system to light mode does not change the palette.