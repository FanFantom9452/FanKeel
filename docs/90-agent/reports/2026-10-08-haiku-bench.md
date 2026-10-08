---
status: current
last_verified: 2026-10-08
source_of_truth: scripts/bench.js, docs/90-agent/reports/evidence/
---

# Haiku 5.5 bench, one role at a time

## 讀這份報告前

結論先講：每個角色都有一批可用的結果，下面五點說明哪些批次作廢、哪些才算數，以及兩個沒有全過的 run 各自是什麼原因。

**各角色該看的批次。** reader 看 role-reader-20261008T143157；mutator 看 role-mutator-20261008T132213；mover 看 role-mover-20261008T141648；照抄計畫的 implementer 看 role-implementer-20261008T141917；fix-bug 看整次 run 的批次 fix-bug-20261008T092518。

**(a) role-reader-20261008T141426 是 bench 本身的缺陷，整批作廢。** `roleFigures` 沒有剝掉 task-notification 的外殼，所以 `result.txt` 的第一行是 `<result>1. …`，`check.sh` 的 `^[[:space:]]*1\. ` 找不到答案行；十個 run 全被判成 `question 1: no answer line`，但兩個臂的答案其實都是對的。已由 commit 967fa8ae 修正，有效的批次是 role-reader-20261008T143157。

**(b) role-mutator-20261008T130828 跑在 cb7c1506 之前。** 所以它的 r4-haiku 實際上跑的是 sonnet，表裡已標為無效。有效的批次是 role-mutator-20261008T132213。

**(c) reader 重跑那批，每個臂各有一個沒通過的 run，原因不同。** sonnet 的 r1 在第 3 題答了 DEFAULT_PORT，而不是 8417，是真的答錯。haiku 的 r2 每個答案都對，但路徑寫成 Windows 反斜線，`check.sh` 的 `[A-Za-z0-9_./-]+:[0-9]+` 認不出來，這是 bench 太嚴，不是 haiku 錯。

**(d) reader、mover、implementer 三批和 reader 重跑，是在另一台機器 DESKTOP-DE33TOH 上跑的。** 那台機器載入了帳號的 claude.ai connector（Claude Docs）。有一個 haiku run 裡，agent 回報在 Grep 結果裡看到一段要它建立文件的指示，它沒有照做。另外，implementer 那批的 r5-sonnet 無效（relay 被派了兩次），表裡已標明。


## fix-bug-20261008T092518

| project | arm | runs | valid | passed | usd |
|---|---|---|---|---|---|
| fix-bug | base | 3 | 3 | 3 | 5.2580 |
| fix-bug | sub | 3 | 0 | 0 | 5.1230 |
| fix-bug | impl | 3 | 3 | 3 | 5.9455 |

| run | arm | valid | pass | usd | over 100K | wakes | wall s | why not valid |
|---|---|---|---|---|---|---|---|---|
| r1-base | base | true | true | 1.3447 | 0 | 9 | 606 |  |
| r1-sub | sub | false | true | 1.8219 | 0 | 15 | 851 | agent-a42f3dbe6a9f1c003.jsonl fankeel-mutator ran claude-sonnet-5-5 |
| r1-impl | impl | true | true | 1.8865 | 0 | 14 | 883 |  |
| r2-impl | impl | true | true | 2.1108 | 0 | 18 | 1132 |  |
| r2-sub | sub | false | true | 1.2218 | 0 | 5 | 238 | none of fankeel-reader, fankeel-mover, fankeel-mutator, fankeel-verifier |
| r2-base | base | true | true | 1.7276 | 0 | 10 | 899 |  |
| r3-base | base | true | true | 2.1856 | 0 | 21 | 373 |  |
| r3-sub | sub | false | true | 2.0793 | 0 | 19 | 1125 | agent-a30002a7d3f4c21be.jsonl fankeel-mutator ran claude-sonnet-5-5 |
| r3-impl | impl | true | true | 1.9482 | 0 | 19 | 1071 |  |

verdict, the cheapest arm that passed n/n on valid runs:
- fix-bug: base

## role-implementer-20261008T141917

| role | arm | runs | valid | passed | role usd total | role usd mean | relay usd |
|---|---|---|---|---|---|---|---|
| implementer | sonnet | 5 | 4 | 4 | 0.2217 | 0.0443 | 0.0246 |
| implementer | haiku | 5 | 5 | 5 | 0.0183 | 0.0037 | 0.0229 |

| run | arm | valid | pass | role usd | relay usd | claude usd | wall s | why not valid |
|---|---|---|---|---|---|---|---|---|
| r1-sonnet | sonnet | true | true | 0.0640 | 0.0048 | 0.0687 | 28 |  |
| r1-haiku | haiku | true | true | 0.0033 | 0.0046 | 0.0084 | 26 |  |
| r2-haiku | haiku | true | true | 0.0033 | 0.0045 | 0.0078 | 28 |  |
| r2-sonnet | sonnet | true | true | 0.0389 | 0.0046 | 0.0434 | 25 |  |
| r3-sonnet | sonnet | true | true | 0.0422 | 0.0049 | 0.0471 | 38 |  |
| r3-haiku | haiku | true | true | 0.0039 | 0.0045 | 0.0084 | 29 |  |
| r4-haiku | haiku | true | true | 0.0040 | 0.0046 | 0.0086 | 30 |  |
| r4-sonnet | sonnet | true | true | 0.0374 | 0.0045 | 0.0419 | 24 |  |
| r5-sonnet | sonnet | false | true | 0.0393 | 0.0059 | 0.0452 | 27 | the relay dispatched 2 times, not once |
| r5-haiku | haiku | true | true | 0.0038 | 0.0047 | 0.0085 | 28 |  |

role usd and relay usd are recomputed from the transcripts (lib/usage.js, deduplicated by requestId, priced by lib/prices.js); claude usd is the total_cost_usd Claude Code reported for the whole run.

verdict, haiku only where its arm was valid and passed n/n:
- implementer: haiku

## role-mover-20261008T141648

| role | arm | runs | valid | passed | role usd total | role usd mean | relay usd |
|---|---|---|---|---|---|---|---|
| mover | sonnet | 5 | 5 | 5 | 0.0682 | 0.0136 | 0.0197 |
| mover | haiku | 5 | 5 | 5 | 0.0049 | 0.0010 | 0.0196 |

| run | arm | valid | pass | role usd | relay usd | claude usd | wall s | why not valid |
|---|---|---|---|---|---|---|---|---|
| r1-sonnet | sonnet | true | true | 0.0193 | 0.0040 | 0.0232 | 16 |  |
| r1-haiku | haiku | true | true | 0.0013 | 0.0040 | 0.0053 | 13 |  |
| r2-haiku | haiku | true | true | 0.0007 | 0.0039 | 0.0046 | 13 |  |
| r2-sonnet | sonnet | true | true | 0.0115 | 0.0039 | 0.0155 | 16 |  |
| r3-sonnet | sonnet | true | true | 0.0125 | 0.0039 | 0.0164 | 15 |  |
| r3-haiku | haiku | true | true | 0.0010 | 0.0038 | 0.0048 | 12 |  |
| r4-haiku | haiku | true | true | 0.0010 | 0.0039 | 0.0049 | 12 |  |
| r4-sonnet | sonnet | true | true | 0.0124 | 0.0038 | 0.0163 | 14 |  |
| r5-sonnet | sonnet | true | true | 0.0124 | 0.0040 | 0.0164 | 16 |  |
| r5-haiku | haiku | true | true | 0.0009 | 0.0039 | 0.0048 | 12 |  |

role usd and relay usd are recomputed from the transcripts (lib/usage.js, deduplicated by requestId, priced by lib/prices.js); claude usd is the total_cost_usd Claude Code reported for the whole run.

verdict, haiku only where its arm was valid and passed n/n:
- mover: haiku

## role-mutator-20261008T130828

| role | arm | runs | valid | passed | role usd total | role usd mean | relay usd |
|---|---|---|---|---|---|---|---|
| mutator | sonnet | 5 | 5 | 5 | 0.1202 | 0.0240 | 0.0196 |
| mutator | haiku | 5 | 4 | 4 | 0.0300 | 0.0060 | 0.0194 |

| run | arm | valid | pass | role usd | relay usd | claude usd | wall s | why not valid |
|---|---|---|---|---|---|---|---|---|
| r1-sonnet | sonnet | true | true | 0.0308 | 0.0040 | 0.0348 | 33 |  |
| r1-haiku | haiku | true | true | 0.0021 | 0.0035 | 0.0056 | 19 |  |
| r2-haiku | haiku | true | true | 0.0019 | 0.0042 | 0.0061 | 24 |  |
| r2-sonnet | sonnet | true | true | 0.0231 | 0.0040 | 0.0271 | 27 |  |
| r3-sonnet | sonnet | true | true | 0.0238 | 0.0039 | 0.0277 | 40 |  |
| r3-haiku | haiku | true | true | 0.0021 | 0.0040 | 0.0061 | 23 |  |
| r4-haiku | haiku | false | true | 0.0217 | 0.0039 | 0.0256 | 47 | fankeel-mutator ran claude-sonnet-5-5, not the haiku arm |
| r4-sonnet | sonnet | true | true | 0.0211 | 0.0039 | 0.0250 | 25 |  |
| r5-sonnet | sonnet | true | true | 0.0214 | 0.0038 | 0.0252 | 41 |  |
| r5-haiku | haiku | true | true | 0.0022 | 0.0039 | 0.0062 | 31 |  |

role usd and relay usd are recomputed from the transcripts (lib/usage.js, deduplicated by requestId, priced by lib/prices.js); claude usd is the total_cost_usd Claude Code reported for the whole run.

verdict, haiku only where its arm was valid and passed n/n:
- mutator: not haiku

## role-mutator-20261008T132213

| role | arm | runs | valid | passed | role usd total | role usd mean | relay usd |
|---|---|---|---|---|---|---|---|
| mutator | sonnet | 5 | 5 | 5 | 0.1161 | 0.0232 | 0.0197 |
| mutator | haiku | 5 | 5 | 5 | 0.0101 | 0.0020 | 0.0195 |

| run | arm | valid | pass | role usd | relay usd | claude usd | wall s | why not valid |
|---|---|---|---|---|---|---|---|---|
| r1-sonnet | sonnet | true | true | 0.0309 | 0.0039 | 0.0349 | 24 |  |
| r1-haiku | haiku | true | true | 0.0025 | 0.0039 | 0.0063 | 27 |  |
| r2-haiku | haiku | true | true | 0.0023 | 0.0039 | 0.0062 | 28 |  |
| r2-sonnet | sonnet | true | true | 0.0201 | 0.0040 | 0.0241 | 48 |  |
| r3-sonnet | sonnet | true | true | 0.0222 | 0.0039 | 0.0261 | 25 |  |
| r3-haiku | haiku | true | true | 0.0015 | 0.0039 | 0.0054 | 22 |  |
| r4-haiku | haiku | true | true | 0.0018 | 0.0039 | 0.0057 | 24 |  |
| r4-sonnet | sonnet | true | true | 0.0213 | 0.0039 | 0.0252 | 27 |  |
| r5-sonnet | sonnet | true | true | 0.0216 | 0.0040 | 0.0256 | 25 |  |
| r5-haiku | haiku | true | true | 0.0021 | 0.0039 | 0.0060 | 27 |  |

role usd and relay usd are recomputed from the transcripts (lib/usage.js, deduplicated by requestId, priced by lib/prices.js); claude usd is the total_cost_usd Claude Code reported for the whole run.

verdict, haiku only where its arm was valid and passed n/n:
- mutator: haiku

## role-reader-20261008T141426

| role | arm | runs | valid | passed | role usd total | role usd mean | relay usd |
|---|---|---|---|---|---|---|---|
| reader | sonnet | 5 | 5 | 0 | 0.0864 | 0.0173 | 0.0193 |
| reader | haiku | 5 | 5 | 0 | 0.0056 | 0.0011 | 0.0196 |

| run | arm | valid | pass | role usd | relay usd | claude usd | wall s | why not valid |
|---|---|---|---|---|---|---|---|---|
| r1-sonnet | sonnet | true | false | 0.0281 | 0.0039 | 0.0320 | 15 |  |
| r1-haiku | haiku | true | false | 0.0019 | 0.0039 | 0.0058 | 13 |  |
| r2-haiku | haiku | true | false | 0.0009 | 0.0040 | 0.0049 | 11 |  |
| r2-sonnet | sonnet | true | false | 0.0128 | 0.0039 | 0.0188 | 15 |  |
| r3-sonnet | sonnet | true | false | 0.0156 | 0.0039 | 0.0196 | 14 |  |
| r3-haiku | haiku | true | false | 0.0008 | 0.0039 | 0.0047 | 9 |  |
| r4-haiku | haiku | true | false | 0.0010 | 0.0039 | 0.0050 | 11 |  |
| r4-sonnet | sonnet | true | false | 0.0143 | 0.0038 | 0.0181 | 13 |  |
| r5-sonnet | sonnet | true | false | 0.0156 | 0.0038 | 0.0194 | 23 |  |
| r5-haiku | haiku | true | false | 0.0010 | 0.0039 | 0.0049 | 10 |  |

role usd and relay usd are recomputed from the transcripts (lib/usage.js, deduplicated by requestId, priced by lib/prices.js); claude usd is the total_cost_usd Claude Code reported for the whole run.

verdict, haiku only where its arm was valid and passed n/n:
- reader: not haiku

## role-reader-20261008T143157

| role | arm | runs | valid | passed | role usd total | role usd mean | relay usd |
|---|---|---|---|---|---|---|---|
| reader | sonnet | 5 | 5 | 4 | 0.0787 | 0.0157 | 0.0195 |
| reader | haiku | 5 | 5 | 4 | 0.0065 | 0.0013 | 0.0196 |

| run | arm | valid | pass | role usd | relay usd | claude usd | wall s | why not valid |
|---|---|---|---|---|---|---|---|---|
| r1-sonnet | sonnet | true | false | 0.0227 | 0.0039 | 0.0266 | 10 |  |
| r1-haiku | haiku | true | true | 0.0021 | 0.0039 | 0.0060 | 13 |  |
| r2-haiku | haiku | true | false | 0.0009 | 0.0040 | 0.0049 | 10 |  |
| r2-sonnet | sonnet | true | true | 0.0139 | 0.0039 | 0.0178 | 11 |  |
| r3-sonnet | sonnet | true | true | 0.0144 | 0.0039 | 0.0183 | 31 |  |
| r3-haiku | haiku | true | true | 0.0014 | 0.0040 | 0.0054 | 12 |  |
| r4-haiku | haiku | true | true | 0.0010 | 0.0038 | 0.0048 | 11 |  |
| r4-sonnet | sonnet | true | true | 0.0132 | 0.0039 | 0.0171 | 13 |  |
| r5-sonnet | sonnet | true | true | 0.0145 | 0.0038 | 0.0183 | 18 |  |
| r5-haiku | haiku | true | true | 0.0011 | 0.0039 | 0.0050 | 11 |  |

role usd and relay usd are recomputed from the transcripts (lib/usage.js, deduplicated by requestId, priced by lib/prices.js); claude usd is the total_cost_usd Claude Code reported for the whole run.

verdict, haiku only where its arm was valid and passed n/n:
- reader: not haiku
