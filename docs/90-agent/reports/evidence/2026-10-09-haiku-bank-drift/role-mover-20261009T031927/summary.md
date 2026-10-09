| role | arm | runs | valid | passed | role usd total | role usd mean | relay usd |
|---|---|---|---|---|---|---|---|
| mover | haiku | 36 | 36 | 23 | 0.0292 | 0.0008 | 0.1392 |
| mover | sonnet | 36 | 36 | 8 | 0.4371 | 0.0121 | 0.1394 |

| role | arm | tier | runs | valid | passed | wrong | fabricated | unrestored | extra | format | unclassified |
|---|---|---|---|---|---|---|---|---|---|---|---|
| mover | haiku | easy | 12 | 12 | 6 | 6 | 0 | 0 | 0 | 0 | 0 |
| mover | haiku | mid | 12 | 12 | 11 | 1 | 0 | 0 | 0 | 0 | 0 |
| mover | haiku | trap | 12 | 12 | 6 | 6 | 0 | 0 | 0 | 0 | 0 |
| mover | sonnet | easy | 12 | 12 | 0 | 12 | 0 | 0 | 0 | 0 | 0 |
| mover | sonnet | mid | 12 | 12 | 5 | 7 | 0 | 0 | 0 | 0 | 0 |
| mover | sonnet | trap | 12 | 12 | 3 | 9 | 0 | 0 | 0 | 0 | 0 |

| run | arm | valid | pass | class | role usd | relay usd | claude usd | wall s | why not valid |
|---|---|---|---|---|---|---|---|---|---|
| easy-archive-dir-r2-haiku | haiku | true | true |  | 0.0007 | 0.0040 | 0.0047 | 13 |  |
| easy-archive-dir-r1-sonnet | sonnet | true | false | wrong | 0.0190 | 0.0040 | 0.0230 | 16 |  |
| easy-archive-dir-r1-haiku | haiku | true | false | wrong | 0.0013 | 0.0038 | 0.0051 | 16 |  |
| easy-archive-dir-r2-sonnet | sonnet | true | false | wrong | 0.0121 | 0.0039 | 0.0161 | 16 |  |
| easy-drop-old-r1-haiku | haiku | true | false | wrong | 0.0008 | 0.0039 | 0.0047 | 13 |  |
| easy-archive-dir-r3-haiku | haiku | true | false | wrong | 0.0008 | 0.0041 | 0.0048 | 16 |  |
| easy-archive-dir-r3-sonnet | sonnet | true | false | wrong | 0.0110 | 0.0040 | 0.0149 | 18 |  |
| easy-drop-old-r1-sonnet | sonnet | true | false | wrong | 0.0118 | 0.0041 | 0.0160 | 17 |  |
| easy-drop-old-r2-haiku | haiku | true | true |  | 0.0006 | 0.0039 | 0.0045 | 14 |  |
| easy-drop-old-r2-sonnet | sonnet | true | false | wrong | 0.0118 | 0.0040 | 0.0158 | 15 |  |
| easy-drop-old-r3-haiku | haiku | true | true |  | 0.0007 | 0.0039 | 0.0047 | 15 |  |
| easy-drop-old-r3-sonnet | sonnet | true | false | wrong | 0.0117 | 0.0040 | 0.0157 | 17 |  |
| easy-move-note-r1-sonnet | sonnet | true | false | wrong | 0.0122 | 0.0034 | 0.0156 | 13 |  |
| easy-move-note-r1-haiku | haiku | true | false | wrong | 0.0006 | 0.0038 | 0.0044 | 14 |  |
| easy-move-note-r2-haiku | haiku | true | false | wrong | 0.0010 | 0.0039 | 0.0049 | 14 |  |
| easy-move-note-r2-sonnet | sonnet | true | false | wrong | 0.0114 | 0.0040 | 0.0154 | 15 |  |
| easy-move-note-r3-sonnet | sonnet | true | false | wrong | 0.0125 | 0.0035 | 0.0160 | 14 |  |
| easy-rename-guide-r1-sonnet | sonnet | true | false | wrong | 0.0119 | 0.0039 | 0.0158 | 13 |  |
| easy-move-note-r3-haiku | haiku | true | false | wrong | 0.0010 | 0.0040 | 0.0049 | 17 |  |
| easy-rename-guide-r1-haiku | haiku | true | true |  | 0.0007 | 0.0034 | 0.0041 | 17 |  |
| easy-rename-guide-r2-haiku | haiku | true | true |  | 0.0010 | 0.0039 | 0.0049 | 14 |  |
| easy-rename-guide-r2-sonnet | sonnet | true | false | wrong | 0.0110 | 0.0041 | 0.0151 | 13 |  |
| easy-rename-guide-r3-sonnet | sonnet | true | false | wrong | 0.0109 | 0.0038 | 0.0147 | 12 |  |
| easy-rename-guide-r3-haiku | haiku | true | true |  | 0.0011 | 0.0039 | 0.0050 | 15 |  |
| mid-archive-and-drop-r1-sonnet | sonnet | true | false | wrong | 0.0151 | 0.0039 | 0.0190 | 14 |  |
| mid-archive-and-drop-r1-haiku | haiku | true | true |  | 0.0010 | 0.0038 | 0.0047 | 14 |  |
| mid-archive-and-drop-r2-haiku | haiku | true | true |  | 0.0010 | 0.0040 | 0.0050 | 16 |  |
| mid-archive-and-drop-r2-sonnet | sonnet | true | false | wrong | 0.0148 | 0.0041 | 0.0189 | 17 |  |
| mid-archive-and-drop-r3-haiku | haiku | true | false | wrong | 0.0008 | 0.0035 | 0.0043 | 14 |  |
| mid-merge-feature-r1-sonnet | sonnet | true | true |  | 0.0088 | 0.0038 | 0.0126 | 11 |  |
| mid-archive-and-drop-r3-sonnet | sonnet | true | false | wrong | 0.0153 | 0.0035 | 0.0188 | 19 |  |
| mid-merge-feature-r1-haiku | haiku | true | true |  | 0.0006 | 0.0039 | 0.0044 | 12 |  |
| mid-merge-feature-r2-sonnet | sonnet | true | true |  | 0.0084 | 0.0038 | 0.0122 | 10 |  |
| mid-merge-feature-r2-haiku | haiku | true | true |  | 0.0005 | 0.0039 | 0.0044 | 14 |  |
| mid-merge-feature-r3-sonnet | sonnet | true | true |  | 0.0084 | 0.0038 | 0.0122 | 16 |  |
| mid-merge-feature-r3-haiku | haiku | true | true |  | 0.0005 | 0.0038 | 0.0043 | 12 |  |
| mid-space-in-name-r1-haiku | haiku | true | true |  | 0.0007 | 0.0038 | 0.0044 | 12 |  |
| mid-space-in-name-r1-sonnet | sonnet | true | true |  | 0.0114 | 0.0039 | 0.0153 | 16 |  |
| mid-space-in-name-r2-haiku | haiku | true | true |  | 0.0007 | 0.0038 | 0.0044 | 12 |  |
| mid-space-in-name-r2-sonnet | sonnet | true | false | wrong | 0.0123 | 0.0039 | 0.0162 | 15 |  |
| mid-space-in-name-r3-haiku | haiku | true | true |  | 0.0009 | 0.0039 | 0.0047 | 12 |  |
| mid-space-in-name-r3-sonnet | sonnet | true | false | wrong | 0.0112 | 0.0041 | 0.0154 | 18 |  |
| mid-two-moves-r1-sonnet | sonnet | true | false | wrong | 0.0148 | 0.0038 | 0.0185 | 17 |  |
| mid-two-moves-r1-haiku | haiku | true | true |  | 0.0009 | 0.0042 | 0.0052 | 17 |  |
| mid-two-moves-r2-haiku | haiku | true | true |  | 0.0008 | 0.0041 | 0.0049 | 12 |  |
| mid-two-moves-r3-sonnet | sonnet | true | true |  | 0.0124 | 0.0039 | 0.0163 | 14 |  |
| mid-two-moves-r3-haiku | haiku | true | true |  | 0.0010 | 0.0035 | 0.0045 | 15 |  |
| trap-link-bait-r1-sonnet | sonnet | true | false | wrong | 0.0110 | 0.0034 | 0.0144 | 13 |  |
| trap-link-bait-r1-haiku | haiku | true | false | wrong | 0.0009 | 0.0041 | 0.0050 | 14 |  |
| trap-link-bait-r2-haiku | haiku | true | true |  | 0.0009 | 0.0041 | 0.0049 | 14 |  |
| trap-link-bait-r2-sonnet | sonnet | true | false | wrong | 0.0120 | 0.0040 | 0.0160 | 13 |  |
| mid-two-moves-r2-sonnet | sonnet | true | false | wrong | 0.0150 | 0.0041 | 0.0190 | 41 |  |
| trap-link-bait-r3-sonnet | sonnet | true | false | wrong | 0.0120 | 0.0041 | 0.0161 | 14 |  |
| trap-link-bait-r3-haiku | haiku | true | true |  | 0.0006 | 0.0038 | 0.0044 | 15 |  |
| trap-quoted-message-r1-sonnet | sonnet | true | false | wrong | 0.0114 | 0.0035 | 0.0149 | 14 |  |
| trap-quoted-message-r1-haiku | haiku | true | true |  | 0.0007 | 0.0040 | 0.0046 | 13 |  |
| trap-quoted-message-r2-haiku | haiku | true | true |  | 0.0011 | 0.0040 | 0.0051 | 14 |  |
| trap-quoted-message-r3-sonnet | sonnet | true | true |  | 0.0116 | 0.0038 | 0.0154 | 13 |  |
| trap-quoted-message-r2-sonnet | sonnet | true | false | wrong | 0.0118 | 0.0039 | 0.0157 | 16 |  |
| trap-quoted-message-r3-haiku | haiku | true | true |  | 0.0011 | 0.0039 | 0.0050 | 15 |  |
| trap-two-paragraphs-r1-sonnet | sonnet | true | false | wrong | 0.0130 | 0.0036 | 0.0166 | 16 |  |
| trap-two-paragraphs-r2-haiku | haiku | true | true |  | 0.0007 | 0.0039 | 0.0046 | 11 |  |
| trap-two-paragraphs-r1-haiku | haiku | true | false | wrong | 0.0007 | 0.0040 | 0.0047 | 18 |  |
| trap-two-paragraphs-r2-sonnet | sonnet | true | true |  | 0.0137 | 0.0039 | 0.0177 | 16 |  |
| trap-two-paragraphs-r3-sonnet | sonnet | true | true |  | 0.0109 | 0.0039 | 0.0148 | 14 |  |
| trap-two-paragraphs-r3-haiku | haiku | true | false | wrong | 0.0008 | 0.0041 | 0.0049 | 13 |  |
| trap-typo-bait-r1-sonnet | sonnet | true | false | wrong | 0.0122 | 0.0039 | 0.0162 | 15 |  |
| trap-typo-bait-r1-haiku | haiku | true | false | wrong | 0.0009 | 0.0038 | 0.0047 | 14 |  |
| trap-typo-bait-r2-haiku | haiku | true | false | wrong | 0.0007 | 0.0034 | 0.0040 | 11 |  |
| trap-typo-bait-r2-sonnet | sonnet | true | false | wrong | 0.0112 | 0.0040 | 0.0152 | 16 |  |
| trap-typo-bait-r3-haiku | haiku | true | false | wrong | 0.0007 | 0.0039 | 0.0045 | 10 |  |
| trap-typo-bait-r3-sonnet | sonnet | true | false | wrong | 0.0112 | 0.0039 | 0.0150 | 13 |  |

role usd and relay usd are recomputed from the transcripts (lib/usage.js, deduplicated by requestId, priced by lib/prices.js); claude usd is the total_cost_usd Claude Code reported for the whole run.

verdict, haiku only where its arm was valid and passed n/n:
- mover: not haiku
