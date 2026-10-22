---
label: station
title: station 文件長句與過時測試名
description: 收掉 2026-10-22 盤點 verify 找到、沒擋 land 的兩個小尾巴，並查 station-serve 那次偶發失敗。
state: ready
---

來源：2026-10-22 TODO 全表盤點的 verify（.fankeel/build/task-20261022T000239/verify.md），三點都標為不阻擋、留到事後收。要做成：一、docs/01-guide/station.md 第 46 行那句寫到 208 欄寬，超過 160 欄上限，拆成兩句；二、tests/pane.test.js 第 1416 行左右的測試名還寫「list draws from that many」，Pane 的 TODO 列表拿掉後已過時，改成描述計數鈕的名字；三、那次整套唯一一敗是 tests/station-serve.test.js 的「a joining serve() writes its own leads into roots.json」，被單檔重跑蓋過，單檔連跑三次都過，查它是偶發還是和 Task 7、8 改過的 serve() 有關。完成條件：docs-check 不再報該句過長、測試名與行為一致、station-serve 的那個測試查出原因並修掉或記成 flaky Watch 條目。
