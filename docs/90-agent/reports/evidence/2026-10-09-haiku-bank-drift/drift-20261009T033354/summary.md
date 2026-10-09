| arm | runs | valid | task passed | no violation | median first violation | kept by steps | kept by context | injections | injected chars | implementer usd mean | prompt tokens mean |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sonnet | 10 | 3 | 3 | 0 | 11 | 1-10 96%; 11-20 91%; 21-30 87%; 31-40 92%; 41-50 97% | 0K 90%; 20K 97% | 0 | 0 | 0.1920 | 333729 |
| haiku | 10 | 10 | 10 | 1 | 3 | 1-10 70%; 11-20 86%; 21-30 89%; 31-40 89%; 41-50 79%; 51-60 100% | 0K 77%; 20K 87% | 0 | 0 | 0.0169 | 642553 |
| sonnet-reinject | 10 | 3 | 3 | 1 | 37 | 1-10 100%; 11-20 96%; 21-30 96%; 31-40 98%; 41-50 100%; 51-60 100%; 61-70 0% | 0K 97%; 20K 98% | 32 | 9216 | 0.2602 | 547172 |
| haiku-reinject | 10 | 10 | 10 | 5 | 4 | 1-10 82%; 11-20 88%; 21-30 91%; 31-40 90%; 41-50 88%; 51-60 96%; 61-70 100% | 0K 83%; 20K 90% | 94 | 27072 | 0.0188 | 752355 |

| run | arm | valid | pass | steps | first violation | injections | role usd | wall s | why not valid |
|---|---|---|---|---|---|---|---|---|---|
| drift-r1-sonnet | sonnet | false | true | 4 | 3 | 0 | 0.0568 | 44 | the implementer made 4 tool calls, under 30 |
| drift-r1-sonnet-reinject | sonnet-reinject | false | false | 6 | 4 | 1 | 0.0742 | 53 | the implementer made 6 tool calls, under 30 |
| drift-r2-sonnet-reinject | sonnet-reinject | false | true | 5 | 3 | 1 | 0.0630 | 45 | the implementer made 5 tool calls, under 30 |
| drift-r1-haiku-reinject | haiku-reinject | true | true | 44 | 5 | 8 | 0.0168 | 105 |  |
| drift-r1-haiku | haiku | true | true | 50 | 1 | 0 | 0.0201 | 125 |  |
| drift-r2-sonnet | sonnet | false | true | 10 | 7 | 0 | 0.0984 | 55 | the implementer made 10 tool calls, under 30 |
| drift-r3-sonnet | sonnet | false | true | 8 | 6 | 0 | 0.0844 | 50 | the implementer made 8 tool calls, under 30 |
| drift-r2-haiku-reinject | haiku-reinject | true | true | 62 | - | 12 | 0.0264 | 136 |  |
| drift-r2-haiku | haiku | true | true | 56 | 3 | 0 | 0.0192 | 122 |  |
| drift-r3-haiku | haiku | true | true | 43 | - | 0 | 0.0158 | 100 |  |
| drift-r3-sonnet-reinject | sonnet-reinject | true | true | 45 | 13 | 9 | 0.2113 | 97 |  |
| drift-r3-haiku-reinject | haiku-reinject | true | true | 44 | - | 8 | 0.0175 | 107 |  |
| drift-r4-haiku-reinject | haiku-reinject | true | true | 48 | 4 | 9 | 0.0180 | 106 |  |
| drift-r4-sonnet | sonnet | true | true | 46 | 11 | 0 | 0.1627 | 73 |  |
| drift-r4-sonnet-reinject | sonnet-reinject | true | true | 57 | - | 11 | 0.2717 | 113 |  |
| drift-r4-haiku | haiku | true | true | 46 | 1 | 0 | 0.0175 | 107 |  |
| drift-r5-sonnet | sonnet | true | true | 46 | 13 | 0 | 0.2099 | 90 |  |
| drift-r5-haiku | haiku | true | true | 42 | 4 | 0 | 0.0162 | 100 |  |
| drift-r5-haiku-reinject | haiku-reinject | true | true | 44 | 1 | 8 | 0.0177 | 105 |  |
| drift-r5-sonnet-reinject | sonnet-reinject | true | true | 61 | 61 | 12 | 0.2977 | 120 |  |
| drift-r6-sonnet-reinject | sonnet-reinject | false | true | 6 | 5 | 1 | 0.0648 | 44 | the implementer made 6 tool calls, under 30 |
| drift-r6-haiku-reinject | haiku-reinject | true | true | 63 | - | 12 | 0.0214 | 116 |  |
| drift-r7-sonnet | sonnet | false | true | 3 | 3 | 0 | 0.0487 | 37 | the implementer made 3 tool calls, under 30 |
| drift-r6-sonnet | sonnet | false | true | 8 | 5 | 0 | 0.0936 | 53 | the implementer made 8 tool calls, under 30 |
| drift-r6-haiku | haiku | true | true | 46 | 3 | 0 | 0.0174 | 104 |  |
| drift-r7-sonnet-reinject | sonnet-reinject | false | false | 9 | 6 | 1 | 0.0786 | 49 | the implementer made 9 tool calls, under 30 |
| drift-r8-sonnet-reinject | sonnet-reinject | false | true | 3 | 3 | 0 | 0.0465 | 34 | the implementer made 3 tool calls, under 30; a reinject arm with no injection in its log |
| drift-r7-haiku | haiku | true | true | 48 | 3 | 0 | 0.0162 | 98 |  |
| drift-r7-haiku-reinject | haiku-reinject | true | true | 55 | 1 | 11 | 0.0199 | 108 |  |
| drift-r8-sonnet | sonnet | false | true | 6 | 6 | 0 | 0.0690 | 46 | the implementer made 6 tool calls, under 30 |
| drift-r8-haiku-reinject | haiku-reinject | true | true | 48 | 6 | 9 | 0.0181 | 105 |  |
| drift-r9-sonnet | sonnet | false | true | 8 | 6 | 0 | 0.0698 | 47 | the implementer made 8 tool calls, under 30 |
| drift-r9-sonnet-reinject | sonnet-reinject | false | true | 3 | 3 | 0 | 0.0499 | 37 | the implementer made 3 tool calls, under 30; a reinject arm with no injection in its log |
| drift-r8-haiku | haiku | true | true | 43 | 3 | 0 | 0.0155 | 104 |  |
| drift-r9-haiku | haiku | true | true | 45 | 3 | 0 | 0.0148 | 90 |  |
| drift-r10-sonnet-reinject | sonnet-reinject | false | true | 9 | 5 | 1 | 0.0887 | 49 | the implementer made 9 tool calls, under 30 |
| drift-r9-haiku-reinject | haiku-reinject | true | true | 46 | - | 9 | 0.0153 | 88 |  |
| drift-r10-haiku-reinject | haiku-reinject | true | true | 42 | - | 8 | 0.0168 | 104 |  |
| drift-r10-haiku | haiku | true | true | 48 | 6 | 0 | 0.0163 | 92 |  |
| drift-r10-sonnet | sonnet | true | true | 47 | 9 | 0 | 0.2034 | 95 |  |
