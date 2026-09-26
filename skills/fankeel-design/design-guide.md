---
status: current
last_verified: 2026-09-26
source_of_truth: distilled on 2026-09-26 from taste-skill 1.0.0 (taste-skill, soft-skill, minimalist-skill), frontend-design 1.1.0, ui-ux-pro-max 2.13.0 and impeccable 4.4.0, as installed; no file in this repository is its upstream
---

# fankeel design guide

Read by every mockup `fankeel-mockup` draws, before any design skill the
prompt names; a named skill is more specific and wins where it disagrees,
and the mockup says so in one line. Each rule ends with where it came from:
[taste], [frontend-design], [ui-ux-pro-max], [impeccable], or [all] where
every one of them says it.

A mockup is one HTML page on the project's own stylesheets. Where a skill
prescribes a stack (React, Tailwind, a component package, an image
generator), that advice stays with the skill; the rules below are the ones
that survive into plain HTML and CSS.

## Direction

- The brief wins: a font, palette, era or look the prompt or the project pins is followed, even where a rule below warns against it. [all]
- Pick the mode from the surface, not the product: operate (app, dashboard, tool), persuade (landing), read (docs), experience (gallery); a station is operate, where scanning outranks expression. [impeccable]
- Refinement keeps the incumbent: its tokens, type, radii, copy and behaviour stay, and only the blocks the approach changes move; redesign is a decision the design states, never a drift. [impeccable] [taste]
- State the read in one line before drawing: the surface, who looks at it, and the language it leans toward. [taste] [frontend-design]
- Check the plan against the generic default: if a similar prompt would produce the same page, revise that part and say what changed. [frontend-design] [taste]
- Spend boldness in one place: one signature element, everything around it quiet and disciplined. [frontend-design]
- Structure encodes something true: numbering, eyebrows, dividers and labels appear only where the content is a sequence or a category. [frontend-design] [taste]
- Match execution to the direction: a minimal page needs precision in spacing, type and detail, not fewer decisions. [frontend-design] [taste]
- Verify in bounded passes: render wide and narrow once, fix everything it shows in one batch, confirm once more, stop. [impeccable]

## Type

- Use the project's own font stack; fetch no font from a CDN, and a new face is self-hosted or not used. [taste]
- Set a clear scale with deliberate weights; carry hierarchy with weight and colour before raw size. [frontend-design] [taste]
- Body line-height near 1.5, and no body text under 12px. [ui-ux-pro-max] [taste]
- Numbers that line up in columns use tabular figures or the mono face. [taste]
- Prose runs no wider than about 65ch. [taste]
- Emphasis inside a heading is the same family's weight or italic, never a second family dropped in. [taste]
- Inter, Roboto and Arial are not a reflex default; they are fine when the project already uses them or asks for neutral. [taste]
- Words are design material: name things by what the user controls, in plain active verbs and sentence case. [frontend-design]
- A control says what it does ("Save changes", not "Submit"), and an action keeps its name through the whole flow. [frontend-design]
- An error says what happened and how to fix it, without apology; an empty state says how to fill it. [frontend-design] [taste]
- Every visible string is re-read before the page is returned; a cute line that does not parse becomes a plain one. [taste]

## Colour

- A neutral ground and one accent, locked across the whole page; the station's accent is its ink. [taste]
- Colour carries meaning (state, a chart's series, an error), not decoration. [taste] [ui-ux-pro-max]
- Colours are semantic tokens in CSS variables; components use the tokens, never raw hex. [ui-ux-pro-max] [taste]
- Contrast meets WCAG AA: 4.5:1 for body text, 3:1 for large text, checked on buttons, placeholders, labels and focus rings. [ui-ux-pro-max] [taste]
- Colour is never the only carrier of meaning; a label, a shape or a position says it too. [ui-ux-pro-max]
- Both themes from the start: follow `prefers-color-scheme`, allow a forced override, and keep the hierarchy in both. [taste]
- No pure `#000` or `#fff`; off-black and off-white keep depth. [taste]
- One temperature of grey per page; warm and cool neutrals are not mixed. [taste]
- Accents stay below full saturation; no neon and no outer glow. [taste]
- Panels are flat by default; a shadow, where one earns its place, is diffuse and tinted to the ground. [taste]

## Space and layout

- One corner-radius scale for the page, applied everywhere; a mixed scale is a written rule or a bug. [taste]
- Group with space and hairline rules first; a card only where elevation is real hierarchy. [taste]
- Dense operate screens separate rows with 1px rules, not boxes. [taste]
- Layout is CSS Grid or plain flex, never percentage arithmetic on widths. [taste]
- Content sits in a contained, centred width; nothing scrolls sideways at any width the page declares. [taste] [ui-ux-pro-max]
- Every multi-column block declares its narrow fallback in the same place it declares the wide one. [taste] [ui-ux-pro-max]
- Space is reserved for anything that loads late, so nothing shifts when it arrives. [ui-ux-pro-max] [taste]
- Every interactive element has a visible keyboard focus. [frontend-design] [ui-ux-pro-max]
- Touch targets are at least 44 by 44px with 8px between them wherever the page can be touched. [ui-ux-pro-max]
- Each state is drawn: loading, empty and error, not only the successful one. [taste] [ui-ux-pro-max]
- Labels sit above inputs, errors sit next to the field, and a placeholder is never the label. [taste] [ui-ux-pro-max]
- z-index is reserved for system layers (popovers, overlays, toasts), not stacked by guesswork. [taste]
- Selector specificity is planned so a section rule and an element rule do not cancel each other. [frontend-design]

## Motion

- Every animation rests under `prefers-reduced-motion: reduce`: a loop stops, a transition becomes instant, and nothing essential depends on the motion. [taste] [frontend-design] [ui-ux-pro-max]
- Motion is motivated: it gives feedback, shows a state change, draws the eye in order, or it is cut. [taste] [ui-ux-pro-max] [frontend-design]
- Animate `transform` and `opacity` only; never width, height, top or left. [taste] [ui-ux-pro-max]
- UI transitions are short and eased (around 150 to 250ms, ease-out or a custom curve), and an exit is quicker than its entrance. [ui-ux-pro-max]
- Feedback is never an instant 0ms jump, and never the same duration for every kind of change. [ui-ux-pro-max]
- One orchestrated moment beats scattered effects; extra motion is what makes a page read as generated. [frontend-design]
- A perpetual loop is reserved for real live state, such as a pulse on a live indicator. [taste]
- Scroll-linked motion uses IntersectionObserver or CSS, never a window scroll listener. [taste]

## Never

- The three generated looks as a default: cream ground with a serif display and a terracotta accent; near-black with one acid accent; broadsheet hairlines with zero radius. [frontend-design]
- Purple-to-blue gradients, glows and mesh blobs as a default accent. [taste]
- Three equal feature cards in a row, or a centred hero over a gradient. [taste]
- An eyebrow over every section, or 01 / 02 / 03 markers on content that is not a sequence. [taste] [frontend-design]
- A coloured dot before every row, link or badge; a dot is for real state only. [taste]
- Emoji as icons, or icon paths drawn by hand. [ui-ux-pro-max] [taste]
- A product preview built from styled divs pretending to be a screenshot. [taste]
- Placeholder names and filler (Acme, John Doe, lorem ipsum) or filler verbs (elevate, seamless, unleash). [taste]
- Precise-looking numbers that no data supplied. [taste]
- Grey text on grey ground, or body text under 12px. [ui-ux-pro-max]
- A removed focus ring, or an affordance that only hover reveals. [ui-ux-pro-max]
- Flat and skeuomorphic styles mixed at random, or two design systems on one page. [ui-ux-pro-max] [taste]
- Gradient text on large headings, or a custom cursor. [taste]
- `backdrop-filter` blur on scrolling content. [taste]
- Em dashes as a flourish in headings, labels and buttons. [taste]
