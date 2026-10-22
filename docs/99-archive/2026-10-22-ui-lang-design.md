---
status: current
role: plan
last_verified: 2026-10-22
source_of_truth: lib/profile.js, assets/station/station.js, hooks/pane-lang.ts, hooks/pane.ts
---

# ui.lang：station、pane、band 一個語言

Approved by the user at the design gate, 2026-10-22. Mockup: `.fankeel/build/task-20261022T075418/mockup.html`.

## 1. Profile

- Rename key `language` → `model.lang`, with the same free-text semantics: the language stage agents write reports and gates in.
- An old `language` key in a profile file is still read as `model.lang` when `model.lang` is absent.
- `profile set language` is refused with a message naming `model.lang`.
- Migrate .fankeel/profile.json.
- Docs and skills that mention the profile key `language` and mean this key say `model.lang`.
- Add new key `ui.lang`: values zh and en, builtin null (unset is today's behaviour), a wizard key, machine scope intended.

## 2. Station

- Picking a language also POSTs ui.lang to /profile with scope=machine when served.
- The page's language precedence becomes profile ui.lang, then localStorage, then navigator.

## 3. Mods

- New hooks/pane-lang.ts: a zh/en string table plus a reader of the machine profile's ui.lang.
- Re-read on every render so a switch takes effect next tick, no restart.
- Replace hardcoded Chinese in the band, the Pane, the Desktop drawings and pane.ts with table lookups.
- Unset ui.lang draws Chinese.

## 4. Mockup

- Reuse the en translations from the approved mockup.
- Two translations are weak: 等你 and 本站 get better short English.
- English is 6-9 columns wider on the band's first row; keep the hooks' drop logic.
- The Desktop band SVG overflows its 640px with a gate waiting: its own task with a test.
