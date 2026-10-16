| role | arm | runs | valid | passed | role usd total | role usd mean | relay usd |
|---|---|---|---|---|---|---|---|
| reader | sonnet | 24 | 24 | 23 | 0.2926 | 0.0122 | 0.1031 |

| role | arm | tier | runs | valid | passed | wrong | fabricated | unrestored | extra | format | unclassified |
|---|---|---|---|---|---|---|---|---|---|---|---|
| reader | sonnet | easy | 8 | 8 | 7 | 1 | 0 | 0 | 0 | 0 | 0 |
| reader | sonnet | mid | 8 | 8 | 8 | 0 | 0 | 0 | 0 | 0 | 0 |
| reader | sonnet | trap | 8 | 8 | 8 | 0 | 0 | 0 | 0 | 0 | 0 |

| run | arm | valid | pass | class | role usd | relay usd | claude usd | wall s | why not valid |
|---|---|---|---|---|---|---|---|---|---|
| easy-retry-limit-r2-sonnet | sonnet | true | true |  | 0.0096 | 0.0043 | 0.0127 | 12 |  |
| easy-retry-limit-r1-sonnet | sonnet | true | true |  | 0.0096 | 0.0043 | 0.0127 | 14 |  |
| easy-who-requires-r2-sonnet | sonnet | true | true |  | 0.0100 | 0.0043 | 0.0131 | 13 |  |
| easy-who-requires-r1-sonnet | sonnet | true | false | wrong | 0.0099 | 0.0043 | 0.0130 | 15 |  |
| easy-default-port-r1-sonnet | sonnet | true | true |  | 0.0130 | 0.0043 | 0.0154 | 19 |  |
| easy-throws-closed-r2-sonnet | sonnet | true | true |  | 0.0095 | 0.0043 | 0.0126 | 17 |  |
| easy-throws-closed-r1-sonnet | sonnet | true | true |  | 0.0095 | 0.0043 | 0.0126 | 19 |  |
| easy-default-port-r2-sonnet | sonnet | true | true |  | 0.0130 | 0.0043 | 0.0153 | 21 |  |
| mid-config-chain-r1-sonnet | sonnet | true | true |  | 0.0148 | 0.0042 | 0.0170 | 16 |  |
| mid-env-default-r2-sonnet | sonnet | true | true |  | 0.0132 | 0.0042 | 0.0154 | 16 |  |
| mid-env-default-r1-sonnet | sonnet | true | true |  | 0.0131 | 0.0043 | 0.0154 | 19 |  |
| mid-route-handler-r1-sonnet | sonnet | true | true |  | 0.0130 | 0.0042 | 0.0152 | 18 |  |
| mid-config-chain-r2-sonnet | sonnet | true | true |  | 0.0147 | 0.0043 | 0.0170 | 22 |  |
| mid-route-handler-r2-sonnet | sonnet | true | true |  | 0.0130 | 0.0043 | 0.0153 | 19 |  |
| mid-three-facts-r2-sonnet | sonnet | true | true |  | 0.0158 | 0.0044 | 0.0182 | 18 |  |
| mid-three-facts-r1-sonnet | sonnet | true | true |  | 0.0165 | 0.0044 | 0.0189 | 20 |  |
| trap-commented-out-r1-sonnet | sonnet | true | true |  | 0.0097 | 0.0043 | 0.0128 | 14 |  |
| trap-commented-out-r2-sonnet | sonnet | true | true |  | 0.0097 | 0.0042 | 0.0127 | 17 |  |
| trap-shadowed-r2-sonnet | sonnet | true | true |  | 0.0095 | 0.0043 | 0.0126 | 14 |  |
| trap-shadowed-r1-sonnet | sonnet | true | true |  | 0.0095 | 0.0043 | 0.0126 | 16 |  |
| trap-none-exists-r2-sonnet | sonnet | true | true |  | 0.0124 | 0.0044 | 0.0148 | 18 |  |
| trap-none-exists-r1-sonnet | sonnet | true | true |  | 0.0156 | 0.0043 | 0.0171 | 19 |  |
| trap-stale-copy-r1-sonnet | sonnet | true | true |  | 0.0139 | 0.0043 | 0.0162 | 16 |  |
| trap-stale-copy-r2-sonnet | sonnet | true | true |  | 0.0140 | 0.0042 | 0.0162 | 16 |  |

role usd and relay usd are recomputed from the transcripts (lib/usage.js, deduplicated by requestId, priced by lib/prices.js); claude usd is the total_cost_usd Claude Code reported for the whole run.

verdict, haiku only where its arm was valid and passed n/n:
