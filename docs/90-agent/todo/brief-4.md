---
label: brief
title: brief 規則散文搬出
description: Task 5 量到 additionalContext 上限是 10,000 字元，build brain brief 的固定文字就佔約 9,000：四段協定散文每次派發都重送，agent 檔已載有一半。散文搬進 agent 檔，brief 只留每次不同的路徑 — [render.js](lib/render.js).
state: done
link: lib/render.js
done:
  at: 2026-10-09
  sha: 4877bfe8
  disposition: done
---

來源：2026-10-09 工作流評審第三條的落實（Task 5，commit 91bf98e9）。量測：兩個 haiku reader，9,950 字元的 brief 內嵌、10,050 的被存成檔只給 2KB 預覽，所以上限是字串的 10,000 字元。現況：renderBrainBrief 在 build 站的固定文字約 9,000（10-09 回修把 root 下的路徑改成相對之前量到 9,300；見 lib/render.js 的 BRIEF_MAX 註解），BRIEF_MAX 只好訂 9,950，fit() 把 context fact、already-answered、touched 都裁光之後真實樣本仍只剩幾十字元的餘裕；而那四段散文（group 與 close、commit 檔的格式與回覆、worktree 與 conflict、no-Edit 與 hands）是靜態規則，tests/brief.test.js 第 497-500、759-761、777-782、796、899 行把它們的字句釘死在 brief 上，agents/fankeel-brain.md 的測試（765-766、785-789 行）又同時釘了同一批規則的另一份。要做的：開一個 bounded 任務，把靜態規則留在 agents/fankeel-brain.md 一份，brief 的四段改成三行路徑（commit 檔、group 報告檔、floor 模型），上述測試改成對 agent 檔斷言規則、對 brief 斷言路徑；這會改掉 2026-09-19 與 2026-09-28 兩份設計釘下的 brief 字句，所以要在 design 站說明。完成條件：bare build brain brief 低於 7,000 字元，BRIEF_MAX 回到設計原訂的 9,500 以下仍有 1,000 以上餘裕，tests/brief.test.js 的真實樣本三個案例與六條長答案案例都綠，brain 的行為測試（bench/roles）不變。
