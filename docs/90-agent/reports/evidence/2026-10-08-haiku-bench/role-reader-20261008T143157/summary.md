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
