---
label: station remote
title: stage 與 end 補機器層測試
description: Add the project-profile-ignored test to the stage and end senders.
state: done
done:
  at: 2026-10-21
  sha: 1b548297
  disposition: done
  session: 97a16e9b-0704-4aa6-95f7-1130e3314314
---

The security fix that makes notify.* machine-only changed three callers (hooks/gate.js, scripts/task.js cmdStage, hooks/leave.js) in the same way, but only hooks/gate.js got a test that a project profile neither turns a publish on nor off (tests/gate-notify.test.js). A mutation putting the merged profileFor values back into task.js or leave.js stays green. It should become one such test each in tests/notify-stage.test.js and tests/notify-end.test.js. Done when each goes red with the merged values restored.
