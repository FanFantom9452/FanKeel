---
status: decision
last_verified: 2026-09-29
---

# 六個 skill 候選：收了兩個，四個不收

一句結論：`docs/03-decisions/2026-09-24-skill-repos.md` 列的六個候選裡，fankeel 收了兩個——只放在 `skills/fankeel-build/SKILL.md` 的 Rationalizations 表，和「user-invoked 不呼叫另一個 user-invoked」的規則——其餘四個（每個 skill 的 Verification 清單、Changesets 更新紀錄、專案級 `CONTEXT.md`、唯讀／可編輯兩種安裝）不收，因為 fankeel 已經有對應的機制。

這頁回答 09-24 那頁 `## 挑選` 一節；09-24 那頁不動。以下的來源都是這次直接讀本機 clone（`.fankeel/build/task-20260928T184117/repos/`，gitignored）得來，不是 `WebFetch` 摘要，路徑與行號相對於該目錄。

## 1. Rationalizations——收，只給 `fankeel-build`

來源：`agent-skills/README.md:335` 的固定段落圖列「Rationalizations → Excuses + rebuttals」；實際檔案 `agent-skills/skills/test-driven-development/SKILL.md:363` 的標題是 `## Common Rationalizations`，表頭是 `| Rationalization | Reality |`，第一列 `"I'll write tests after the code works"`。README:344 說「Every skill includes a table」。

與 09-24 頁的差異：頁面稱段落名為「Rationalizations／Red Flags」，clone 裡的標題是 `Common Rationalizations` 與 `Red Flags`（`SKILL.md:375`）兩個獨立段落。

決定：只有 `skills/fankeel-build/SKILL.md` 收，段落名 `## Common rationalizations`（Task 9，commit `70c75d02`），表頭 `excuse | what happened`。每一列都引一件本 repo 記過的事故（例如 2026-09-23 一個 build agent 在 295 次 Bash 呼叫裡花 261 次跑 `sleep`／`echo`），不寫泛稱的藉口。其他 skill 不收：對方的表是通用反駁，fankeel 的表只收有事故當證據的列，別的 stage 目前沒有足夠的事故可列。

## 2. 每個 skill 的 Verification 清單——不收

來源：`agent-skills/README.md:337`「Verification → Evidence requirements」；`agent-skills/skills/test-driven-development/SKILL.md:387` `## Verification`，內容是 `- [ ] Every new behavior has a corresponding test` 這類勾選項。

與 09-24 頁的差異：頁面稱「Verification Checklist」，clone 的標題只是 `Verification`，README 描述為「Evidence requirements」。

不收的理由：每個 stage 的完成條件 fankeel 已經有一份程式產生的 `stop_condition`（`skills/registry.json`，由 `scripts/stage-registry.js` 產生），驗證階段另有逐條核對需求的 `fankeel-verify`；再在每份 `SKILL.md` 放一份手寫清單，是同一個條件寫兩處，會各自漂移。

## 3. Changesets 更新紀錄——不收

來源：`mattpocock-skills/CHANGELOG.md:1` 標題 `# mattpocock-skills`，`:3` `## 1.2.3`，`:5` `### Patch Changes`，`:7` 第一筆帶 PR 號 #779、commit 短碼 `efce423`、`Thanks @mattpocock!` 署名，接「Make `diagnosing-bugs` redact secrets.」，下面接該變更的說明條列。

與 09-24 頁的差異：頁面說「依變更類型分 Major／Minor／Patch Changes、每筆帶 PR 連結與作者署名」，這次讀到的最新一版只有 Patch Changes 一節；三種分類的說法對得上 Changesets 的格式，但 Major／Minor 在本次讀的段落沒有看到（`## 1.2.3`、`## 1.2.2`、`## 1.2.0`、`## 1.1.0` 為版本標題）。

不收的理由：`scripts/version.js --changes` 已經從最後一筆 `chore: x.y.z` 之後的 commit subject 列出未發布的變更；fankeel 的 commit subject 本來就寫成一句完整的話，不需要另一個檔案再抄一次。Changesets 要每個 PR 帶一份 changeset 檔，fankeel 沒有 PR 流程，這個成本沒有對應的收益。

## 4. user-invoked 不呼叫另一個 user-invoked——收

來源：`mattpocock-skills/README.md:186`：「A user-invoked skill may invoke model-invoked skills, but never another user-invoked one.」前一句定義：「**User-invoked** skills are reachable only when you type them」。

決定（Task 8）：規則寫進 `skills/fankeel/SKILL.md`（粗體句「A skill the user invoked may use model-invoked skills, never another user-invoked one.」），`skills/fankeel-station/SKILL.md` 的 frontmatter 加 `disable-model-invocation: true`。理由與 09-24 頁一致：避免兩個疊起來的 skill 各問使用者一次。

宿主是否真的照 `disable-model-invocation` 這個 key 擋掉模型呼叫，這次沒有驗證（見最後一節）。

## 5. 專案級 `CONTEXT.md`——不收

來源：`mattpocock-skills/CONTEXT.md:1` `# Matt Pocock Skills`，`:5` `## Language`，`:21` `## Relationships`，`:27` `## Flagged ambiguities`。內容是本 repo 自己的詞彙表（`**Issue tracker**:`、`_Avoid_:` 列表），不是給使用者專案用的範本。

與 09-24 頁的差異：頁面說它是「專案級共用領域語彙」，clone 裡它確實是這個 repo 自己的詞彙表；`CONTEXT.md:3` 另說 skills 靠 `/setup-matt-pocock-skills` 產生的 per-repo 設定運作，那是另一份東西。

不收的理由：fankeel 描述專案靠 `.fankeel/docs.json`（哪些文件算什麼角色）與 `.fankeel/map.md`（專案地圖，`/fankeel` 先讀它），每個 stage 都已經從這兩處取用；再加一份詞彙檔會多一個要維護、且沒有 stage 會強制讀的檔案。

## 6. 唯讀受管或可編輯兩種安裝——不收

來源：`mattpocock-skills/README.md:27`：「**The Claude Code plugin** installs the whole set as a managed, read-only bundle that updates when I ship … **skills.sh** copies editable skill files into your project … Pick one: installing both leaves you with every skill twice.」

與 09-24 頁的差異：頁面說「三種安裝路徑」，README:27 講的是兩條（plugin 與 skills.sh），第三種「可編輯安裝」是 skills.sh 路徑內的用法；本次沒有逐行核對頁面所說的 `npx skills update`。

不收的理由：fankeel 只有一種安裝，就是從本機目錄裝（`fankeel installs from the local dir`），使用者要改就是改那個目錄，本來就可編輯；多一條唯讀路徑只會讓兩份 skill 同時存在（README:27 自己也警告「every skill twice」）。

## 沒能核對的部分

- `disable-model-invocation: true` 是否被宿主（Claude Code）照字面擋掉模型呼叫，沒有量過；規則寫在 `skills/fankeel/SKILL.md`，鍵在 `skills/fankeel-station/SKILL.md`，但行為沒有實測。
- clone 是 2026-09-28 拉下來的快照，不是 2026-09-24 那次 `WebFetch` 讀的那一版；兩者若有差異，這頁以 clone 為準，09-24 頁的摘要層沒有逐句比對。
- Changesets 的 Major／Minor 分類只讀了 `CHANGELOG.md` 最新的幾個版本段落，沒有讀完整份檔案。
- 第 1 節說「別的 stage 目前沒有足夠的事故可列」，是對本 repo 已記的事故的判斷，沒有逐個 stage 統計。
