# build 與 verify 交不交站 agent：對照

兩臂只差 `stage.agents`：`main` 是 `false`，`agents` 是 `build,verify`。同一個 TASK、同一個 BASE、同一份 survey、controller 同一個 MODEL（預設 opus）、同一條 route `design,plan,build,verify`。每臂一次（RUNS=1），每次上限 CAP 美元（預設 30）。

## 判定規則（跑之前寫死）

build 與 verify 加回 `stage.agents`，當且僅當兩條都成立：

1. `agents` 臂主控的峰值 context（`<tag>-ctx.txt`，`node scripts/ctx.js <session> --by-stage` 的最大值，由人從每臂的 `<tag>-ctx.txt` 讀出，沒有腳本算這個 30%）比 `main` 臂**低 30% 以上**；
2. `agents` 臂的花費（`<tag>-verify.json` 的 `total_cost_usd`；--resume 下是累計值，最後一站的檔就是該臂總額）**不超過 `main` 臂的 1.1 倍**。

否則 `stage.agents` 維持 `survey`，另開任務評估移除站 agent 層。n=1，所以規則偏向「不證明就不開」。報告 `docs/90-agent/reports/<date>-build-verify-ab.md` 的結論段用的數字必須和 `*-verify.json`、`*-ctx.txt` 算出來的一致，表改了結論段就一起改。

## 用法

```
DRY=1 BASE=HEAD TASK=t SURVEY=README.md bash ab.sh          # 不跑 claude，命令寫進 $OUT/provenance.txt（OUT 預設是本目錄），stdout 無輸出
BASE=<sha> TASK="…" SURVEY=<survey.md> CAP=30 bash ab.sh     # 實跑，使用者核准花費後
```

`OUT` 可改輸出目錄；不改就寫在這個目錄。

`bash ab.sh pin-check <worktree> <value>` 只跑每臂開跑前的那道檢查（worktree 的 `stage.agents` 剛好是 `<value>`）；`tests/ab-build-verify.test.js` 用它證明 `build,verify` 通過、`build,verify,land` 與 `build` 不通過。
