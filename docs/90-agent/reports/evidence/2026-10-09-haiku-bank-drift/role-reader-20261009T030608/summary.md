| role | arm | runs | valid | passed | role usd total | role usd mean | relay usd |
|---|---|---|---|---|---|---|---|
| reader | haiku | 36 | 36 | 31 | 0.0299 | 0.0008 | 0.1407 |
| reader | sonnet | 36 | 36 | 34 | 0.4373 | 0.0121 | 0.1393 |

| role | arm | tier | runs | valid | passed | wrong | fabricated | unrestored | extra | format | unclassified |
|---|---|---|---|---|---|---|---|---|---|---|---|
| reader | haiku | easy | 12 | 12 | 9 | 3 | 0 | 0 | 0 | 0 | 0 |
| reader | haiku | mid | 12 | 12 | 10 | 1 | 1 | 0 | 0 | 0 | 0 |
| reader | haiku | trap | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| reader | sonnet | easy | 12 | 12 | 10 | 2 | 0 | 0 | 0 | 0 | 0 |
| reader | sonnet | mid | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| reader | sonnet | trap | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |

| run | arm | valid | pass | class | role usd | relay usd | claude usd | wall s | why not valid |
|---|---|---|---|---|---|---|---|---|---|
| easy-default-port-r1-haiku | haiku | true | true |  | 0.0013 | 0.0039 | 0.0052 | 9 |  |
| easy-default-port-r2-haiku | haiku | true | true |  | 0.0015 | 0.0039 | 0.0054 | 11 |  |
| easy-default-port-r2-sonnet | sonnet | true | true |  | 0.0240 | 0.0039 | 0.0279 | 12 |  |
| easy-default-port-r1-sonnet | sonnet | true | true |  | 0.0248 | 0.0039 | 0.0286 | 14 |  |
| easy-retry-limit-r1-sonnet | sonnet | true | true |  | 0.0088 | 0.0038 | 0.0126 | 9 |  |
| easy-default-port-r3-haiku | haiku | true | true |  | 0.0010 | 0.0039 | 0.0049 | 13 |  |
| easy-default-port-r3-sonnet | sonnet | true | true |  | 0.0116 | 0.0039 | 0.0156 | 14 |  |
| easy-retry-limit-r1-haiku | haiku | true | true |  | 0.0006 | 0.0039 | 0.0045 | 12 |  |
| easy-retry-limit-r3-sonnet | sonnet | true | true |  | 0.0088 | 0.0038 | 0.0126 | 9 |  |
| easy-retry-limit-r3-haiku | haiku | true | true |  | 0.0006 | 0.0039 | 0.0046 | 9 |  |
| easy-retry-limit-r2-haiku | haiku | true | true |  | 0.0006 | 0.0039 | 0.0044 | 13 |  |
| easy-retry-limit-r2-sonnet | sonnet | true | true |  | 0.0088 | 0.0039 | 0.0127 | 13 |  |
| easy-throws-closed-r1-sonnet | sonnet | true | true |  | 0.0087 | 0.0039 | 0.0125 | 10 |  |
| easy-throws-closed-r2-haiku | haiku | true | true |  | 0.0006 | 0.0039 | 0.0046 | 10 |  |
| easy-throws-closed-r1-haiku | haiku | true | true |  | 0.0009 | 0.0039 | 0.0048 | 12 |  |
| easy-throws-closed-r2-sonnet | sonnet | true | true |  | 0.0087 | 0.0038 | 0.0124 | 11 |  |
| easy-throws-closed-r3-sonnet | sonnet | true | true |  | 0.0087 | 0.0039 | 0.0125 | 9 |  |
| easy-who-requires-r1-haiku | haiku | true | false | wrong | 0.0006 | 0.0039 | 0.0045 | 9 |  |
| easy-throws-closed-r3-haiku | haiku | true | true |  | 0.0007 | 0.0039 | 0.0046 | 12 |  |
| easy-who-requires-r1-sonnet | sonnet | true | false | wrong | 0.0090 | 0.0039 | 0.0129 | 12 |  |
| easy-who-requires-r2-haiku | haiku | true | false | wrong | 0.0007 | 0.0039 | 0.0046 | 11 |  |
| easy-who-requires-r3-sonnet | sonnet | true | true |  | 0.0090 | 0.0038 | 0.0128 | 9 |  |
| easy-who-requires-r3-haiku | haiku | true | false | wrong | 0.0006 | 0.0039 | 0.0045 | 9 |  |
| easy-who-requires-r2-sonnet | sonnet | true | false | wrong | 0.0090 | 0.0040 | 0.0130 | 12 |  |
| mid-config-chain-r1-sonnet | sonnet | true | true |  | 0.0102 | 0.0038 | 0.0140 | 10 |  |
| mid-config-chain-r2-haiku | haiku | true | true |  | 0.0008 | 0.0039 | 0.0047 | 10 |  |
| mid-config-chain-r2-sonnet | sonnet | true | true |  | 0.0129 | 0.0039 | 0.0168 | 10 |  |
| mid-config-chain-r1-haiku | haiku | true | false | fabricated | 0.0008 | 0.0039 | 0.0047 | 18 |  |
| mid-config-chain-r3-sonnet | sonnet | true | true |  | 0.0136 | 0.0038 | 0.0174 | 11 |  |
| mid-env-default-r1-sonnet | sonnet | true | true |  | 0.0123 | 0.0038 | 0.0161 | 10 |  |
| mid-config-chain-r3-haiku | haiku | true | true |  | 0.0010 | 0.0039 | 0.0049 | 12 |  |
| mid-env-default-r1-haiku | haiku | true | true |  | 0.0005 | 0.0039 | 0.0045 | 9 |  |
| mid-env-default-r2-haiku | haiku | true | true |  | 0.0004 | 0.0045 | 0.0049 | 9 |  |
| mid-env-default-r2-sonnet | sonnet | true | true |  | 0.0121 | 0.0039 | 0.0160 | 10 |  |
| mid-env-default-r3-sonnet | sonnet | true | true |  | 0.0123 | 0.0038 | 0.0161 | 11 |  |
| mid-env-default-r3-haiku | haiku | true | false | wrong | 0.0004 | 0.0040 | 0.0044 | 8 |  |
| mid-route-handler-r1-sonnet | sonnet | true | true |  | 0.0094 | 0.0039 | 0.0133 | 10 |  |
| mid-route-handler-r2-sonnet | sonnet | true | true |  | 0.0097 | 0.0039 | 0.0135 | 10 |  |
| mid-route-handler-r1-haiku | haiku | true | true |  | 0.0010 | 0.0039 | 0.0049 | 13 |  |
| mid-route-handler-r2-haiku | haiku | true | true |  | 0.0011 | 0.0039 | 0.0050 | 13 |  |
| mid-route-handler-r3-haiku | haiku | true | true |  | 0.0008 | 0.0039 | 0.0047 | 9 |  |
| mid-route-handler-r3-sonnet | sonnet | true | true |  | 0.0123 | 0.0039 | 0.0162 | 16 |  |
| mid-three-facts-r1-sonnet | sonnet | true | true |  | 0.0165 | 0.0040 | 0.0205 | 12 |  |
| mid-three-facts-r1-haiku | haiku | true | true |  | 0.0015 | 0.0040 | 0.0054 | 14 |  |
| mid-three-facts-r2-sonnet | sonnet | true | true |  | 0.0146 | 0.0039 | 0.0186 | 11 |  |
| mid-three-facts-r3-sonnet | sonnet | true | true |  | 0.0133 | 0.0039 | 0.0173 | 16 |  |
| mid-three-facts-r2-haiku | haiku | true | true |  | 0.0009 | 0.0038 | 0.0048 | 28 |  |
| mid-three-facts-r3-haiku | haiku | true | true |  | 0.0015 | 0.0039 | 0.0055 | 27 |  |
| trap-commented-out-r1-sonnet | sonnet | true | true |  | 0.0089 | 0.0038 | 0.0126 | 23 |  |
| trap-commented-out-r1-haiku | haiku | true | true |  | 0.0006 | 0.0039 | 0.0045 | 19 |  |
| trap-commented-out-r2-sonnet | sonnet | true | true |  | 0.0089 | 0.0039 | 0.0128 | 9 |  |
| trap-commented-out-r2-haiku | haiku | true | true |  | 0.0006 | 0.0038 | 0.0044 | 16 |  |
| trap-commented-out-r3-sonnet | sonnet | true | true |  | 0.0089 | 0.0038 | 0.0127 | 11 |  |
| trap-commented-out-r3-haiku | haiku | true | true |  | 0.0006 | 0.0039 | 0.0045 | 11 |  |
| trap-none-exists-r1-sonnet | sonnet | true | true |  | 0.0191 | 0.0039 | 0.0230 | 16 |  |
| trap-none-exists-r1-haiku | haiku | true | true |  | 0.0014 | 0.0038 | 0.0052 | 17 |  |
| trap-none-exists-r2-haiku | haiku | true | true |  | 0.0009 | 0.0038 | 0.0047 | 12 |  |
| trap-shadowed-r1-sonnet | sonnet | true | true |  | 0.0087 | 0.0039 | 0.0126 | 8 |  |
| trap-none-exists-r2-sonnet | sonnet | true | true |  | 0.0188 | 0.0039 | 0.0227 | 19 |  |
| trap-none-exists-r3-haiku | haiku | true | true |  | 0.0009 | 0.0039 | 0.0048 | 12 |  |
| trap-none-exists-r3-sonnet | sonnet | true | true |  | 0.0187 | 0.0039 | 0.0226 | 16 |  |
| trap-shadowed-r1-haiku | haiku | true | true |  | 0.0006 | 0.0039 | 0.0045 | 9 |  |
| trap-shadowed-r2-haiku | haiku | true | true |  | 0.0007 | 0.0039 | 0.0046 | 9 |  |
| trap-shadowed-r2-sonnet | sonnet | true | true |  | 0.0087 | 0.0038 | 0.0125 | 9 |  |
| trap-shadowed-r3-sonnet | sonnet | true | true |  | 0.0087 | 0.0039 | 0.0125 | 9 |  |
| trap-shadowed-r3-haiku | haiku | true | true |  | 0.0008 | 0.0039 | 0.0047 | 12 |  |
| trap-stale-copy-r1-sonnet | sonnet | true | true |  | 0.0131 | 0.0039 | 0.0170 | 12 |  |
| trap-stale-copy-r2-haiku | haiku | true | true |  | 0.0007 | 0.0039 | 0.0046 | 10 |  |
| trap-stale-copy-r1-haiku | haiku | true | true |  | 0.0009 | 0.0038 | 0.0046 | 12 |  |
| trap-stale-copy-r2-sonnet | sonnet | true | true |  | 0.0128 | 0.0039 | 0.0166 | 11 |  |
| trap-stale-copy-r3-sonnet | sonnet | true | true |  | 0.0130 | 0.0039 | 0.0168 | 11 |  |
| trap-stale-copy-r3-haiku | haiku | true | true |  | 0.0008 | 0.0039 | 0.0047 | 21 |  |

role usd and relay usd are recomputed from the transcripts (lib/usage.js, deduplicated by requestId, priced by lib/prices.js); claude usd is the total_cost_usd Claude Code reported for the whole run.

verdict, haiku only where its arm was valid and passed n/n:
- reader: not haiku
