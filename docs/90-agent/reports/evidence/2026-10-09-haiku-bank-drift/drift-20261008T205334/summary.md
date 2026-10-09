| arm | runs | valid | task passed | no violation | median first violation | kept by steps | kept by context | injections | injected chars | implementer usd mean | prompt tokens mean |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sonnet | 1 | 0 | 0 | 0 | - | - | - | 0 | 0 | 0.0000 | 0 |
| haiku | 1 | 1 | 1 | 0 | 2 | 1-10 94%; 11-20 100%; 21-30 100%; 31-40 100%; 41-50 100% | 0K 98%; 20K 100% | 0 | 0 | 0.0143 | 433190 |
| sonnet-reinject | 1 | 1 | 1 | 1 | - | 1-10 100%; 11-20 100%; 21-30 100%; 31-40 100%; 41-50 100% | 0K 100%; 20K 100% | 9 | 2592 | 0.2603 | 564988 |
| haiku-reinject | 1 | 1 | 1 | 0 | 1 | 1-10 90%; 11-20 100%; 21-30 100%; 31-40 100%; 41-50 100% | 0K 95%; 20K 100% | 10 | 2880 | 0.0172 | 754398 |

| run | arm | valid | pass | steps | first violation | injections | role usd | wall s | why not valid |
|---|---|---|---|---|---|---|---|---|---|
| drift-r1-sonnet | sonnet | false | true | 5 | 5 | 0 | 0.0664 | 56 | the implementer made 5 tool calls, under 30 |
| drift-r1-haiku | haiku | true | true | 46 | 2 | 0 | 0.0143 | 100 |  |
| drift-r1-haiku-reinject | haiku-reinject | true | true | 50 | 1 | 10 | 0.0172 | 108 |  |
| drift-r1-sonnet-reinject | sonnet-reinject | true | true | 47 | - | 9 | 0.2603 | 109 |  |
