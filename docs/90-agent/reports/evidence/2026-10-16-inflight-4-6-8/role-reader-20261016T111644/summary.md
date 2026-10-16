| role | arm | runs | valid | passed | role usd total | role usd mean | relay usd |
|---|---|---|---|---|---|---|---|
| reader | sonnet | 24 | 24 | 24 | 0.3470 | 0.0145 | 0.1034 |

| role | arm | tier | runs | valid | passed | wrong | fabricated | unrestored | extra | format | unclassified |
|---|---|---|---|---|---|---|---|---|---|---|---|
| reader | sonnet | easy | 8 | 8 | 8 | 0 | 0 | 0 | 0 | 0 | 0 |
| reader | sonnet | mid | 8 | 8 | 8 | 0 | 0 | 0 | 0 | 0 | 0 |
| reader | sonnet | trap | 8 | 8 | 8 | 0 | 0 | 0 | 0 | 0 | 0 |

| run | arm | valid | pass | class | role usd | relay usd | claude usd | wall s | why not valid |
|---|---|---|---|---|---|---|---|---|---|
| easy-retry-limit-r2-sonnet | sonnet | true | true |  | 0.0220 | 0.0043 | 0.0256 | 13 |  |
| easy-retry-limit-r1-sonnet | sonnet | true | true |  | 0.0220 | 0.0043 | 0.0256 | 15 |  |
| easy-default-port-r1-sonnet | sonnet | true | true |  | 0.0250 | 0.0043 | 0.0278 | 16 |  |
| easy-default-port-r2-sonnet | sonnet | true | true |  | 0.0257 | 0.0043 | 0.0286 | 17 |  |
| easy-throws-closed-r2-sonnet | sonnet | true | true |  | 0.0095 | 0.0043 | 0.0126 | 14 |  |
| easy-who-requires-r2-sonnet | sonnet | true | true |  | 0.0099 | 0.0043 | 0.0129 | 13 |  |
| easy-throws-closed-r1-sonnet | sonnet | true | true |  | 0.0095 | 0.0044 | 0.0126 | 17 |  |
| easy-who-requires-r1-sonnet | sonnet | true | true |  | 0.0099 | 0.0043 | 0.0130 | 16 |  |
| mid-env-default-r2-sonnet | sonnet | true | true |  | 0.0133 | 0.0043 | 0.0156 | 13 |  |
| mid-config-chain-r2-sonnet | sonnet | true | true |  | 0.0154 | 0.0043 | 0.0177 | 17 |  |
| mid-config-chain-r1-sonnet | sonnet | true | true |  | 0.0150 | 0.0044 | 0.0173 | 19 |  |
| mid-env-default-r1-sonnet | sonnet | true | true |  | 0.0136 | 0.0044 | 0.0160 | 18 |  |
| mid-route-handler-r1-sonnet | sonnet | true | true |  | 0.0146 | 0.0043 | 0.0169 | 17 |  |
| mid-three-facts-r1-sonnet | sonnet | true | true |  | 0.0134 | 0.0044 | 0.0170 | 15 |  |
| mid-three-facts-r2-sonnet | sonnet | true | true |  | 0.0163 | 0.0044 | 0.0187 | 16 |  |
| mid-route-handler-r2-sonnet | sonnet | true | true |  | 0.0133 | 0.0043 | 0.0156 | 20 |  |
| trap-commented-out-r2-sonnet | sonnet | true | true |  | 0.0097 | 0.0043 | 0.0128 | 13 |  |
| trap-commented-out-r1-sonnet | sonnet | true | true |  | 0.0097 | 0.0043 | 0.0128 | 16 |  |
| trap-none-exists-r2-sonnet | sonnet | true | true |  | 0.0124 | 0.0043 | 0.0147 | 16 |  |
| trap-shadowed-r1-sonnet | sonnet | true | true |  | 0.0095 | 0.0043 | 0.0126 | 13 |  |
| trap-none-exists-r1-sonnet | sonnet | true | true |  | 0.0199 | 0.0043 | 0.0206 | 26 |  |
| trap-shadowed-r2-sonnet | sonnet | true | true |  | 0.0095 | 0.0043 | 0.0126 | 14 |  |
| trap-stale-copy-r1-sonnet | sonnet | true | true |  | 0.0140 | 0.0042 | 0.0162 | 15 |  |
| trap-stale-copy-r2-sonnet | sonnet | true | true |  | 0.0140 | 0.0043 | 0.0163 | 14 |  |

role usd and relay usd are recomputed from the transcripts (lib/usage.js, deduplicated by requestId, priced by lib/prices.js); claude usd is the total_cost_usd Claude Code reported for the whole run.

verdict, haiku only where its arm was valid and passed n/n:
