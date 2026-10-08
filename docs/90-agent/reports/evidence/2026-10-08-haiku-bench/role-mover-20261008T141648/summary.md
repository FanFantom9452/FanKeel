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
