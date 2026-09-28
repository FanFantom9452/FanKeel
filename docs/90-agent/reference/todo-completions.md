---
status: current
last_verified: 2026-09-29
source_of_truth: TODO.md, scripts/todo-check.js
---

# TODO completions

What happened to a `TODO.md` entry once it was closed. Whoever removes a bullet
from `TODO.md` adds one record here in the same change: the entry's original
text verbatim, its disposition, and the commit that closed it. `todo-check`
reads this page against the previous commit's `TODO.md` and refuses a deletion
it cannot find a matching record for here.

Newest first. One record per closed entry:

```
- original: <the entry's text, verbatim, as it read in TODO.md>
  disposition: done | measured-no-change | abandoned
  sha: <the commit that closed it>
```

`done` — the work described happened. `measured-no-change` — it was measured
and the answer was to leave things as they are. `abandoned` — nobody is doing
it and nobody decided to.

No entries yet.
