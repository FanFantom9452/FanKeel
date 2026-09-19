{
  "questions": [
    {
      "question": "survey 的答案在上面。要收下、升路線，還是再查一輪？",
      "header": "survey",
      "options": [
        {
          "label": "收下，任務就到這 (Recommended)",
          "description": "接受這份清單就是答案：兩處寫入都在 scripts/task.js，五個模組直接讀（guard 的搶檔先後、dirty 的 mtime 界線、handoff 的目錄名、station 與 detail 的顯示），瀏覽器端九處，hooks 一律經 lib/ 間接讀，lib/registry.js 自己完全不碰。同時接受 class 是 spike、路線維持單站 survey，這一站結束後任務就站下，不進 build。"
        },
        {
          "label": "升 spike，把讀者寫成一頁",
          "description": "唯一還開著的決定：docs/registry.md:31 的欄位表沒有 started 這一列，沒有任何一頁說它是 ISO 8601，格式只能從 scripts/task.js:271 反推。要的話跑 task.js route \"survey,build\" 升到 spike，build 這站把讀者清單與格式補進 docs/registry.md。棘輪只准往上，選了就不能再降回單站。"
        },
        {
          "label": "再查一輪，兩個具名目標",
          "description": "一、registry 裡還有第二筆 active 且 task 一字不差的紀錄（session 5121ea58，started 18:02:59），我沒查它是不是殘留，也沒查兩筆同時活著會不會讓 guard 的 claimedFirst 把自己判成輸家。二、docs/plans/2026-09-01-stage-timing 這組 design-intent 頁要在 started 旁邊加每站時間戳，我只確認它存在，沒讀它是否改動 started 本身的語意。"
        },
        {
          "label": "問法不對，我重問",
          "description": "如果你要的其實不是「誰讀它」而是「改掉它會壞哪裡」，或是想把 tests/ 的 37 個檔案也算成讀者、或想連 docs/archive/ 一起看，說一句，我用新的鏡頭重跑這一站。這一份報告會被改寫，不是疊加。"
        }
      ],
      "multiSelect": false
    }
  ],
  "answers": {
    "survey 的答案在上面。要收下、升路線，還是再查一輪？": "收下，任務就到這 (Recommended)"
  },
  "annotations": {}
}