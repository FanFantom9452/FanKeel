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
