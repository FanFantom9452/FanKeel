---
label: quota
title: quota.week 該怎麼處置
description: quota.week=$66 只校準 6.4 小時又混兩個帳號；花費頁已不讀它，設定頁與 profile 說明還在用
state: done
link: lib/profile.js
done:
  at: 2026-10-31
  sha: 5634be05
  disposition: done
  session: 6ff5bdb2-3a38-4939-8e03-c0f3ac028fe1
---

來源：spend-quota design「對照 map」。quota.week 的校準只取 10-29 的 6.4 小時，又把兩個帳號的花費除以一個帳號的額度，所以 $66 不可信。花費頁已改成只寫金額、依帳號畫額度折線，不再讀它；要決定的是：刪掉這個 key、改成每個帳號各一個，還是改用折線上的「每 1% 額度」取代。key 在 lib/profile.js 的 quota.week。完成的標準：選定一種做法，設定頁、profile 說明與花費頁對它的描述一致。
