# 已收工任務的 ZIP 匯出 — verify 報告

結論：行為本身成立，但 `skills/fankeel-land/SKILL.md:291-292` 有一句寫錯，必須回 build 修；另有兩個沒被測試釘住的路徑。

```
$ node scripts/suite.js --session d9a52a0e-81f5-46f4-9051-1478a1346a5b --fast
suite: 6194 pass, 1 fail @ 86e7ee54
$ node scripts/docs-check.js
6 references that no longer resolve   (皆在本次範圍外，build 前就有)
$ mutation: record.js:134 把 `&& !closed` 拿掉，node --test tests/record-bundle.test.js
before: pass 12 fail 0 / mutated: pass 11 fail 1 / 還原後 git diff --stat 為空
```

- `session --closed` 讓 active=false 的任務可打包 — held（mutation 1 of 1 被殺掉；新測試 record-bundle.test.js:154 變紅）
- 單一 bundle 的 `export` 可省 `--cross`，report.md 只含該包 retro — held（record-export.test.js 新測試通過；多個 bundle 仍被拒絕）
- report.md 過 `sensitive.redact` — held（有測試；本次未對這一行做 mutation，只做了 1 個 mutation，共 3 個關鍵變更中的 1 個）
- 唯一失敗 tests/source.test.js:225 與本次無關 — held（suite.tap 只有這一筆，worktree-1.md 來自 a0049c6c）
- skill 文字描述正確 — did not hold：`skills/fankeel-land/SKILL.md:291-292` 寫「the same command with `--closed`」，但上一句的指令是 `record.js retro`，`retro` 不打包也不讀 `--closed`；正確指令是 `record.js session --closed`（pipeline.md:899 與決策頁寫對了）。
- 沒被測試釘住：`importZip` 讀取無 `--cross` 的單一 bundle ZIP 只是讀程式碼推得，沒跑過；`--closed` 用在仍 active 的任務也沒測（讀程式碼看起來無害）。
- docs: skills/fankeel-land/SKILL.md:291（skills/ 屬 build，不在此修）
- fixed here: none, docs-check 未變（仍 6 個既有項）
- adversary: 1 次派遣（reviewer，按檔案指定的 model）；擊敗 2 列 → build（skill 措辭；import 無 cross ZIP 與 --closed 用於 active 任務缺測試）。未另派 confirmer：第一列我已親自打開 SKILL.md:291 與 pipeline.md:899 確認屬實。Security、silent-failure、comment 三個 lens：none。
- 沒做到：沒有對 sensitive.redact 與 `ids.length > 1` 兩處各做 mutation；adversary 提到 record.js 曾顯示為已修改，是同時進行的 mutation，已還原，`git status scripts/` 為空。

reads:
skills/fankeel-land/SKILL.md — 291-292 行要改成 `record.js session --closed`
scripts/record.js — importZip 在無 report.md 時的行為（約 526 行），補測試用
tests/record-export.test.js — 補「無 cross 的單包 ZIP 可 import」測試

```json gate
{"questions":[{"header":"Verify→Land","question":"Verify -> Land | fankeel : 已收工任務的 ZIP 匯出，verify 發現 land skill 一句寫錯，要往哪走？","options":[{"label":"Go to Land","description":"忽略這句錯誤文字直接進 land；行為本身通過，但 skill 會誤導 land brain 去跑 `retro --closed`。"},{"label":"Back to Build (Recommended)","description":"修 skills/fankeel-land/SKILL.md:291 為 `record.js session --closed`，並補兩個測試（無 cross 單包 ZIP 可 import；--closed 用在 active 任務無害），再回 verify。"},{"label":"暫停","description":"先停在 verify，之後再決定。"}]}],"next":"回 build 修 land skill 一句措辭並補兩個測試"}
```
