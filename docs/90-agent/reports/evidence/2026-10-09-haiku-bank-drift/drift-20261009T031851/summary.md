| arm | runs | valid | task passed | no violation | median first violation | kept by steps | kept by context | injections | injected chars | implementer usd mean | prompt tokens mean |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sonnet | 1 | 0 | 0 | 0 | - | - | - | 0 | 0 | 0.0000 | 0 |
| haiku | 1 | 1 | 1 | 0 | 3 | 1-10 75%; 11-20 83%; 21-30 85%; 31-40 94%; 41-50 83%; 51-60 82% | 0K 82%; 20K 85% | 0 | 0 | 0.0193 | 772893 |
| sonnet-reinject | 1 | 1 | 1 | 0 | 14 | 1-10 100%; 11-20 95%; 21-30 90%; 31-40 100% | 0K 94%; 20K 100% | 7 | 2016 | 0.2078 | 338890 |
| haiku-reinject | 1 | 1 | 1 | 0 | 3 | 1-10 90%; 11-20 100%; 21-30 100%; 31-40 100%; 41-50 100% | 0K 94%; 20K 100% | 8 | 2304 | 0.0182 | 671350 |

| run | arm | valid | pass | steps | first violation | injections | role usd | wall s | why not valid |
|---|---|---|---|---|---|---|---|---|---|
| drift-r1-sonnet | sonnet | false | true | 7 | 6 | 0 | 0.0706 | 39 | the implementer made 7 tool calls, under 30 |
| drift-r1-sonnet-reinject | sonnet-reinject | true | true | 39 | 14 | 7 | 0.2078 | 93 |  |
| drift-r1-haiku-reinject | haiku-reinject | true | true | 44 | 3 | 8 | 0.0182 | 104 |  |
| drift-r1-haiku | haiku | true | true | 58 | 3 | 0 | 0.0193 | 115 |  |
