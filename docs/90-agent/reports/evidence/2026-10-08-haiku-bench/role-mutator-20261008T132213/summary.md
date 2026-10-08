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
