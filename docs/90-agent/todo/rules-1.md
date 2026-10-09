---
label: rules
title: 六處頁面仍把 4 說成上限
description: dispatch-1 改成「預設四個」後，survey、init（有測試釘住）、audit、verify 四張 skill 頁與 pipeline.md 三處仍寫 ceiling 或 at most — [skills/fankeel/SKILL.md](skills/fankeel/SKILL.md).
state: done
link: skills/fankeel/SKILL.md
done:
  at: 2026-10-09
  sha: c4540f4a
  disposition: done
  session: 981cc30f-610d-4e46-b149-aa02968ef5bc
---

來源：2026-10-09 TODO 全表盤點 Task 8 的 reviewer。Task 8 只改了 lib/stages.js、skills/fankeel、skills/fankeel-build 三處（FILE_CAP 3），reviewer 另外找到六處仍把四個派工說成上限：skills/fankeel-survey/SKILL.md:235-237、skills/fankeel-init/SKILL.md:148（tests/init-skill.test.js:39-43 用 /at most four at once/ 釘住，頁與測試要一起改）、skills/fankeel-audit/SKILL.md:214 與 226、skills/fankeel-verify/SKILL.md:147-148 與 178、docs/02-architecture/pipeline.md:580（at most）與 660、714 兩個圖節點。要做成：每一處改成「預設四個」，語意同 lib/render.js 的 four by default in one response；init 的測試同步改；docs-check 綠。完成條件：grep -rn 'ceiling' skills/ docs/02-architecture/ 不再把四個派工稱為上限。

## 完成紀錄

survey、audit、verify、init 四張 skill 頁的七句話，和 pipeline.md 的三個圖節點，都從「四個是上限」改成「預設四個」，跟 dispatch-1 定下的意思一致。另外加了兩個測試，任何一頁再寫回上限就會失敗。init 頁原本釘住舊句子的測試也一起改了。

- commit 097576f2
- commit c4540f4a
