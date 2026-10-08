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
