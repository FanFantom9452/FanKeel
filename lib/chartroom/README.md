# lib/chartroom — vendored

Copied verbatim from Chartroom (`F:/ymlab/_ext/chartroom`), commit
`47506de1108a904de3184b8dc007f2034e2af892`: `src/core/{format,fields,util}.js`
and `src/geometry/{measure,layout,route,lanes,shapes,scene,svg}.js` — the
render subset, 1768 lines. ESM under this directory's `{"type":"module"}`;
`lib/board.js` loads it with dynamic `import()`. `src/server/` is not copied.

Do not edit these files: re-copy from the source repository and update the
commit above. Design: docs/90-agent/plans/2026-10-20-chartroom-board-design.md.

## Format

A `.board` is JSON Lines. The first line is the header; every other line is one
record whose first key is its kind (`view`, `node`, `edge`, `stroke`) and whose
value is a unique non-empty id. Required: `node` needs `in` (a view id); `edge`
needs `in`, `from`, `to` (node ids); `view` needs nothing. Optional: `label`,
`shape`, `dash`, `arrow` (`none`/`end`/`both`). Leave out `x`/`y`/`w`/`h`.

```
{"chartroom":1,"title":"Flow","root":"main"}
{"view":"main","title":"Flow","dir":"LR"}
{"node":"a","in":"main","label":"Input"}
{"node":"b","in":"main","label":"Output"}
{"edge":"e1","in":"main","from":"a","to":"b","label":"data","arrow":"end"}
```
