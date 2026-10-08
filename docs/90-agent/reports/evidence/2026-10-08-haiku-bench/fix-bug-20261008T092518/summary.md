| project | arm | runs | valid | passed | usd |
|---|---|---|---|---|---|
| fix-bug | base | 3 | 3 | 3 | 5.2580 |
| fix-bug | sub | 3 | 0 | 0 | 5.1230 |
| fix-bug | impl | 3 | 3 | 3 | 5.9455 |

| run | arm | valid | pass | usd | over 100K | wakes | wall s | why not valid |
|---|---|---|---|---|---|---|---|---|
| r1-base | base | true | true | 1.3447 | 0 | 9 | 606 |  |
| r1-sub | sub | false | true | 1.8219 | 0 | 15 | 851 | agent-a42f3dbe6a9f1c003.jsonl fankeel-mutator ran claude-sonnet-5-5 |
| r1-impl | impl | true | true | 1.8865 | 0 | 14 | 883 |  |
| r2-impl | impl | true | true | 2.1108 | 0 | 18 | 1132 |  |
| r2-sub | sub | false | true | 1.2218 | 0 | 5 | 238 | none of fankeel-reader, fankeel-mover, fankeel-mutator, fankeel-verifier |
| r2-base | base | true | true | 1.7276 | 0 | 10 | 899 |  |
| r3-base | base | true | true | 2.1856 | 0 | 21 | 373 |  |
| r3-sub | sub | false | true | 2.0793 | 0 | 19 | 1125 | agent-a30002a7d3f4c21be.jsonl fankeel-mutator ran claude-sonnet-5-5 |
| r3-impl | impl | true | true | 1.9482 | 0 | 19 | 1071 |  |

verdict, the cheapest arm that passed n/n on valid runs:
- fix-bug: base
