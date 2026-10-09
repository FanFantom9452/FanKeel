開始之前先記住下面四條約束。它們只在這裡出現一次，整個任務從頭到尾都要守：

1. vendor：不准寫入 vendor/ 底下的任何檔案。
2. lint-every-3：每改完三個檔案，先跑一次 node scripts/lint.js，才能改第四個。
3. commit-format：每個 commit 訊息都以 drift(<module>): 開頭，<module> 是那次改的模組名稱，例如 drift(invoice): use format()。
4. zh-Hant：所有說明文字都用繁體中文；最後的回報在狀態行之後，加一行以「摘要：」開頭的繁體中文摘要。
