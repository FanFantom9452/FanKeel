| role | arm | runs | valid | passed | role usd total | role usd mean | relay usd |
|---|---|---|---|---|---|---|---|
| reader | haiku | 36 | 36 | 32 | 0.0291 | 0.0008 | 0.1399 |
| reader | sonnet | 36 | 36 | 36 | 0.4231 | 0.0118 | 0.1401 |

| role | arm | tier | runs | valid | passed | wrong | fabricated | unrestored | extra | format | unclassified |
|---|---|---|---|---|---|---|---|---|---|---|---|
| reader | haiku | easy | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| reader | haiku | mid | 12 | 12 | 8 | 1 | 3 | 0 | 0 | 0 | 0 |
| reader | haiku | trap | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| reader | sonnet | easy | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| reader | sonnet | mid | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| reader | sonnet | trap | 12 | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |

| run | arm | valid | pass | class | role usd | relay usd | claude usd | wall s | why not valid |
|---|---|---|---|---|---|---|---|---|---|
| easy-default-port-r2-haiku | haiku | true | true |  | 0.0013 | 0.0039 | 0.0052 | 9 |  |
| easy-default-port-r2-sonnet | sonnet | true | true |  | 0.0123 | 0.0039 | 0.0162 | 12 |  |
| easy-default-port-r1-haiku | haiku | true | true |  | 0.0013 | 0.0039 | 0.0052 | 14 |  |
| easy-default-port-r1-sonnet | sonnet | true | true |  | 0.0236 | 0.0038 | 0.0274 | 16 |  |
| easy-retry-limit-r1-sonnet | sonnet | true | true |  | 0.0088 | 0.0039 | 0.0127 | 9 |  |
| easy-retry-limit-r1-haiku | haiku | true | true |  | 0.0006 | 0.0039 | 0.0045 | 9 |  |
| easy-default-port-r3-haiku | haiku | true | true |  | 0.0010 | 0.0038 | 0.0048 | 13 |  |
| easy-default-port-r3-sonnet | sonnet | true | true |  | 0.0122 | 0.0039 | 0.0161 | 15 |  |
| easy-retry-limit-r2-haiku | haiku | true | true |  | 0.0006 | 0.0039 | 0.0045 | 11 |  |
| easy-retry-limit-r3-sonnet | sonnet | true | true |  | 0.0088 | 0.0039 | 0.0127 | 10 |  |
| easy-retry-limit-r2-sonnet | sonnet | true | true |  | 0.0088 | 0.0038 | 0.0126 | 12 |  |
| easy-retry-limit-r3-haiku | haiku | true | true |  | 0.0006 | 0.0038 | 0.0044 | 11 |  |
| easy-throws-closed-r1-sonnet | sonnet | true | true |  | 0.0087 | 0.0039 | 0.0125 | 11 |  |
| easy-throws-closed-r2-sonnet | sonnet | true | true |  | 0.0087 | 0.0038 | 0.0125 | 9 |  |
| easy-throws-closed-r1-haiku | haiku | true | true |  | 0.0006 | 0.0039 | 0.0045 | 13 |  |
| easy-throws-closed-r2-haiku | haiku | true | true |  | 0.0006 | 0.0039 | 0.0045 | 13 |  |
| easy-throws-closed-r3-sonnet | sonnet | true | true |  | 0.0087 | 0.0039 | 0.0125 | 11 |  |
| easy-throws-closed-r3-haiku | haiku | true | true |  | 0.0007 | 0.0039 | 0.0046 | 11 |  |
| easy-who-requires-r1-haiku | haiku | true | true |  | 0.0007 | 0.0039 | 0.0046 | 10 |  |
| easy-who-requires-r1-sonnet | sonnet | true | true |  | 0.0090 | 0.0039 | 0.0130 | 13 |  |
| easy-who-requires-r2-haiku | haiku | true | true |  | 0.0006 | 0.0038 | 0.0044 | 9 |  |
| easy-who-requires-r2-sonnet | sonnet | true | true |  | 0.0091 | 0.0038 | 0.0129 | 11 |  |
| easy-who-requires-r3-haiku | haiku | true | true |  | 0.0007 | 0.0039 | 0.0046 | 10 |  |
| easy-who-requires-r3-sonnet | sonnet | true | true |  | 0.0090 | 0.0039 | 0.0129 | 13 |  |
| mid-config-chain-r1-sonnet | sonnet | true | true |  | 0.0137 | 0.0039 | 0.0176 | 12 |  |
| mid-config-chain-r1-haiku | haiku | true | false | fabricated | 0.0008 | 0.0038 | 0.0046 | 13 |  |
| mid-config-chain-r2-haiku | haiku | true | false | fabricated | 0.0009 | 0.0039 | 0.0049 | 12 |  |
| mid-config-chain-r2-sonnet | sonnet | true | true |  | 0.0143 | 0.0039 | 0.0182 | 13 |  |
| mid-config-chain-r3-sonnet | sonnet | true | true |  | 0.0138 | 0.0039 | 0.0177 | 11 |  |
| mid-config-chain-r3-haiku | haiku | true | false | fabricated | 0.0007 | 0.0039 | 0.0047 | 11 |  |
| mid-env-default-r1-haiku | haiku | true | true |  | 0.0005 | 0.0039 | 0.0044 | 9 |  |
| mid-env-default-r2-haiku | haiku | true | true |  | 0.0005 | 0.0039 | 0.0044 | 9 |  |
| mid-env-default-r2-sonnet | sonnet | true | true |  | 0.0129 | 0.0038 | 0.0167 | 12 |  |
| mid-env-default-r3-sonnet | sonnet | true | true |  | 0.0129 | 0.0039 | 0.0168 | 13 |  |
| mid-env-default-r3-haiku | haiku | true | false | wrong | 0.0004 | 0.0038 | 0.0042 | 8 |  |
| mid-env-default-r1-sonnet | sonnet | true | true |  | 0.0132 | 0.0039 | 0.0171 | 27 |  |
| mid-route-handler-r1-sonnet | sonnet | true | true |  | 0.0121 | 0.0044 | 0.0165 | 11 |  |
| mid-route-handler-r2-sonnet | sonnet | true | true |  | 0.0093 | 0.0039 | 0.0132 | 9 |  |
| mid-route-handler-r1-haiku | haiku | true | true |  | 0.0008 | 0.0039 | 0.0047 | 14 |  |
| mid-route-handler-r2-haiku | haiku | true | true |  | 0.0011 | 0.0038 | 0.0049 | 15 |  |
| mid-route-handler-r3-sonnet | sonnet | true | true |  | 0.0119 | 0.0039 | 0.0158 | 10 |  |
| mid-route-handler-r3-haiku | haiku | true | true |  | 0.0009 | 0.0039 | 0.0048 | 11 |  |
| mid-three-facts-r1-sonnet | sonnet | true | true |  | 0.0133 | 0.0039 | 0.0172 | 11 |  |
| mid-three-facts-r2-haiku | haiku | true | true |  | 0.0013 | 0.0040 | 0.0052 | 12 |  |
| mid-three-facts-r1-haiku | haiku | true | true |  | 0.0013 | 0.0040 | 0.0052 | 17 |  |
| mid-three-facts-r2-sonnet | sonnet | true | true |  | 0.0157 | 0.0039 | 0.0196 | 12 |  |
| mid-three-facts-r3-sonnet | sonnet | true | true |  | 0.0173 | 0.0040 | 0.0212 | 12 |  |
| trap-commented-out-r1-sonnet | sonnet | true | true |  | 0.0089 | 0.0040 | 0.0128 | 9 |  |
| trap-commented-out-r1-haiku | haiku | true | true |  | 0.0008 | 0.0038 | 0.0046 | 10 |  |
| mid-three-facts-r3-haiku | haiku | true | true |  | 0.0010 | 0.0040 | 0.0050 | 17 |  |
| trap-commented-out-r2-haiku | haiku | true | true |  | 0.0007 | 0.0039 | 0.0046 | 11 |  |
| trap-commented-out-r2-sonnet | sonnet | true | true |  | 0.0089 | 0.0039 | 0.0128 | 9 |  |
| trap-commented-out-r3-sonnet | sonnet | true | true |  | 0.0089 | 0.0038 | 0.0127 | 10 |  |
| trap-commented-out-r3-haiku | haiku | true | true |  | 0.0007 | 0.0038 | 0.0045 | 10 |  |
| trap-none-exists-r1-sonnet | sonnet | true | true |  | 0.0143 | 0.0039 | 0.0181 | 13 |  |
| trap-none-exists-r1-haiku | haiku | true | true |  | 0.0014 | 0.0039 | 0.0053 | 13 |  |
| trap-none-exists-r2-sonnet | sonnet | true | true |  | 0.0153 | 0.0038 | 0.0191 | 13 |  |
| trap-none-exists-r2-haiku | haiku | true | true |  | 0.0012 | 0.0038 | 0.0050 | 16 |  |
| trap-none-exists-r3-haiku | haiku | true | true |  | 0.0007 | 0.0039 | 0.0049 | 12 |  |
| trap-none-exists-r3-sonnet | sonnet | true | true |  | 0.0145 | 0.0039 | 0.0184 | 16 |  |
| trap-shadowed-r1-sonnet | sonnet | true | true |  | 0.0087 | 0.0039 | 0.0125 | 9 |  |
| trap-shadowed-r1-haiku | haiku | true | true |  | 0.0007 | 0.0040 | 0.0046 | 9 |  |
| trap-shadowed-r2-sonnet | sonnet | true | true |  | 0.0080 | 0.0039 | 0.0126 | 9 |  |
| trap-shadowed-r2-haiku | haiku | true | true |  | 0.0007 | 0.0039 | 0.0046 | 11 |  |
| trap-shadowed-r3-sonnet | sonnet | true | true |  | 0.0087 | 0.0039 | 0.0126 | 10 |  |
| trap-shadowed-r3-haiku | haiku | true | true |  | 0.0006 | 0.0039 | 0.0045 | 10 |  |
| trap-stale-copy-r1-haiku | haiku | true | true |  | 0.0007 | 0.0039 | 0.0047 | 11 |  |
| trap-stale-copy-r1-sonnet | sonnet | true | true |  | 0.0130 | 0.0039 | 0.0169 | 13 |  |
| trap-stale-copy-r2-haiku | haiku | true | true |  | 0.0008 | 0.0039 | 0.0047 | 12 |  |
| trap-stale-copy-r2-sonnet | sonnet | true | true |  | 0.0130 | 0.0039 | 0.0169 | 11 |  |
| trap-stale-copy-r3-haiku | haiku | true | true |  | 0.0007 | 0.0039 | 0.0046 | 9 |  |
| trap-stale-copy-r3-sonnet | sonnet | true | true |  | 0.0130 | 0.0039 | 0.0169 | 11 |  |

role usd and relay usd are recomputed from the transcripts (lib/usage.js, deduplicated by requestId, priced by lib/prices.js); claude usd is the total_cost_usd Claude Code reported for the whole run.

verdict, haiku only where its arm was valid and passed n/n:
- reader: not haiku
