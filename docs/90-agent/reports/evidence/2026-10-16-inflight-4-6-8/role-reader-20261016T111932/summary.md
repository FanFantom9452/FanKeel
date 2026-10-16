| role | arm | runs | valid | passed | role usd total | role usd mean | relay usd |
|---|---|---|---|---|---|---|---|
| reader | sonnet | 24 | 24 | 23 | 0.3224 | 0.0134 | 0.1025 |

| role | arm | tier | runs | valid | passed | wrong | fabricated | unrestored | extra | format | unclassified |
|---|---|---|---|---|---|---|---|---|---|---|---|
| reader | sonnet | easy | 8 | 8 | 7 | 1 | 0 | 0 | 0 | 0 | 0 |
| reader | sonnet | mid | 8 | 8 | 8 | 0 | 0 | 0 | 0 | 0 | 0 |
| reader | sonnet | trap | 8 | 8 | 8 | 0 | 0 | 0 | 0 | 0 | 0 |

| run | arm | valid | pass | class | role usd | relay usd | claude usd | wall s | why not valid |
|---|---|---|---|---|---|---|---|---|---|
| easy-default-port-r1-sonnet | sonnet | true | true |  | 0.0124 | 0.0043 | 0.0147 | 15 |  |
| easy-throws-closed-r1-sonnet | sonnet | true | true |  | 0.0218 | 0.0042 | 0.0253 | 14 |  |
| easy-retry-limit-r1-sonnet | sonnet | true | true |  | 0.0220 | 0.0043 | 0.0256 | 16 |  |
| easy-retry-limit-r2-sonnet | sonnet | true | true |  | 0.0220 | 0.0042 | 0.0256 | 17 |  |
| easy-throws-closed-r2-sonnet | sonnet | true | true |  | 0.0095 | 0.0037 | 0.0120 | 17 |  |
| easy-default-port-r2-sonnet | sonnet | true | true |  | 0.0133 | 0.0043 | 0.0156 | 20 |  |
| easy-who-requires-r2-sonnet | sonnet | true | true |  | 0.0099 | 0.0043 | 0.0130 | 12 |  |
| mid-config-chain-r2-sonnet | sonnet | true | true |  | 0.0115 | 0.0043 | 0.0146 | 14 |  |
| mid-env-default-r2-sonnet | sonnet | true | true |  | 0.0094 | 0.0043 | 0.0125 | 13 |  |
| easy-who-requires-r1-sonnet | sonnet | true | false | wrong | 0.0098 | 0.0043 | 0.0130 | 20 |  |
| mid-env-default-r1-sonnet | sonnet | true | true |  | 0.0132 | 0.0043 | 0.0155 | 18 |  |
| mid-config-chain-r1-sonnet | sonnet | true | true |  | 0.0159 | 0.0043 | 0.0182 | 20 |  |
| mid-route-handler-r1-sonnet | sonnet | true | true |  | 0.0118 | 0.0043 | 0.0150 | 17 |  |
| trap-commented-out-r1-sonnet | sonnet | true | true |  | 0.0097 | 0.0043 | 0.0128 | 14 |  |
| mid-route-handler-r2-sonnet | sonnet | true | true |  | 0.0130 | 0.0043 | 0.0153 | 20 |  |
| trap-commented-out-r2-sonnet | sonnet | true | true |  | 0.0097 | 0.0042 | 0.0127 | 15 |  |
| mid-three-facts-r2-sonnet | sonnet | true | true |  | 0.0143 | 0.0044 | 0.0167 | 18 |  |
| mid-three-facts-r1-sonnet | sonnet | true | true |  | 0.0141 | 0.0044 | 0.0165 | 22 |  |
| trap-none-exists-r1-sonnet | sonnet | true | true |  | 0.0159 | 0.0043 | 0.0174 | 17 |  |
| trap-shadowed-r1-sonnet | sonnet | true | true |  | 0.0095 | 0.0043 | 0.0126 | 15 |  |
| trap-shadowed-r2-sonnet | sonnet | true | true |  | 0.0095 | 0.0042 | 0.0125 | 15 |  |
| trap-stale-copy-r2-sonnet | sonnet | true | true |  | 0.0140 | 0.0044 | 0.0163 | 13 |  |
| trap-none-exists-r2-sonnet | sonnet | true | true |  | 0.0162 | 0.0043 | 0.0178 | 19 |  |
| trap-stale-copy-r1-sonnet | sonnet | true | true |  | 0.0139 | 0.0043 | 0.0163 | 22 |  |

role usd and relay usd are recomputed from the transcripts (lib/usage.js, deduplicated by requestId, priced by lib/prices.js); claude usd is the total_cost_usd Claude Code reported for the whole run.

verdict, haiku only where its arm was valid and passed n/n:
