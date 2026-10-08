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
