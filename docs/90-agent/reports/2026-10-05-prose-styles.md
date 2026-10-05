---
status: current
last_verified: 2026-10-05
---

# 三種文字風格的對照範例（2026-10-05）

## 結論

句長最平均的是 B plain：中文標準差 9.6 欄，平均只有 13.7 欄，最長一句 35 欄，但它要 24 句才說完同一件事。長短差最多的是 A writer 的英文版，標準差 50.7 欄，最長一句剛好 160 欄，正好壓在上限。C sepia 介於兩者之間，中文標準差 26.7 欄，句數是 A writer 的 10 對 8。這代表選 `prose.style` 時，要句子短而整齊就選 `plain`，要長短交錯就選 `sepia` 或 `writer`，後者的英文版要留意不要貼近 160 欄的上限。

## 怎麼量

題目是「Express 的 middleware 是什麼？為什麼順序重要？」。A 是 `writer`，B 是 `plain`，C 是 `sepia`，各有中文與英文一版。量法是 `lib/plain.js` 的 `longSentences(text, 0)`：它照 `SPLIT` 切句，回傳每一句的欄寬，中文字一個算兩欄。清單的每一項算一句，程式碼區塊不算。

## 量測

| 版本 | 句數 | 最長（欄） | 平均（欄） | 標準差（欄） |
|---|---|---|---|---|
| A writer 中文 | 8 | 99 | 44.9 | 29.4 |
| A writer English | 8 | 160 | 75.5 | 50.7 |
| B plain 中文 | 24 | 35 | 13.7 | 9.6 |
| B plain English | 23 | 74 | 22.7 | 17.7 |
| C sepia 中文 | 10 | 99 | 39.2 | 26.7 |
| C sepia English | 11 | 109 | 54.1 | 30.9 |

量測時的 HEAD：`git rev-parse HEAD` 印出 `e9465d12760013f372beec3f46acf9e377b16d2d`。量測用的指令是把頁面的 `> ` 引用行取出、去掉程式碼區塊，再交給 `longSentences(text, 0)`，算每一版的句數、最長、平均與母體標準差。

```
node -e "const fs=require('fs');const {longSentences}=require('./lib/plain.js');const page=fs.readFileSync('docs/90-agent/reports/2026-10-05-prose-styles.md','utf8');for(const sec of page.split(/^### /m).slice(1)){const name=sec.split('\n')[0];let code=false;const text=sec.split('\n').filter(l=>l.startsWith('>')).map(l=>l.replace(/^>\s?/,'')).filter(l=>{if(l.startsWith('\`\`\`')){code=!code;return false}return !code}).join('\n');const w=longSentences(text,0).map(s=>s.width);const mean=w.reduce((a,b)=>a+b,0)/w.length;const sd=Math.sqrt(w.reduce((a,b)=>a+(b-mean)**2,0)/w.length);console.log('| '+name+' | '+w.length+' | '+Math.max(...w)+' | '+mean.toFixed(1)+' | '+sd.toFixed(1)+' |')}"
```

## 六版

### A writer 中文

> middleware 是在路由處理之前先拿到請求的函式：它可以讀或改 `req`、直接回應，或呼叫 `next()` 交給下一個。Express 依 `app.use` 的註冊順序一個接一個執行，所以順序本身就是行為——驗證掛在路由後面，那條路由就沒有被保護。
>
> 常見的四種，也是它們該排的順序：
>
> - 記錄請求（logging）
> - 解析 body，後面的 handler 才讀得到 `req.body`
> - 驗證身分，不通過就直接回 401
> - 錯誤處理：參數是 `(err, req, res, next)` 四個，放在最後
>
> 可以照抄的順序：
>
> ```js
> app.use(logger);
> app.use(express.json());
> app.use(requireAuth);
> app.get('/orders', listOrders);
> app.use(handleError);
> ```

### A writer English

> Middleware is a function that sees the request before your route handler does: it can read or change `req`, send a response itself, or call `next()` to pass the request on. Express runs middleware in the order you register it with `app.use`, so the order is the behaviour — register authentication after a route and that route is unprotected.
>
> The four common kinds, in the order they belong:
>
> - request logging
> - body parsing, so later handlers can read `req.body`
> - authentication, which answers 401 and stops when it fails
> - error handling: a function with four parameters, `(err, req, res, next)`, registered last
>
> An order you can copy: (same code block as above)

### B plain 中文

> middleware 是一個函式。它在路由處理之前拿到請求。它可以讀或改 `req`。它也可以直接回應。它也可以呼叫 `next()`，把請求交給下一個。
>
> Express 照註冊的順序執行 middleware。所以順序決定行為。例如你把驗證放在路由後面。那條路由就沒有被保護。
>
> 照這個順序註冊：
>
> 1. 記錄請求。
> 2. 解析 body。後面的 handler 才讀得到 `req.body`。
> 3. 驗證身分。驗證失敗時，它回 401。
> 4. 註冊路由。
> 5. 錯誤處理。它有四個參數：`(err, req, res, next)`。它放在最後。

### B plain English

> Middleware is a function. It gets the request before the route handler. It can read or change `req`. It can send a response. It can call `next()`. Then the next function gets the request.
>
> Express runs middleware in the order of registration. Thus, the order controls the behaviour. If you register authentication after a route, that route has no protection.
>
> Register in this order:
>
> 1. Log the request.
> 2. Parse the body. Then later handlers can read `req.body`.
> 3. Do authentication. If it fails, it sends 401.
> 4. Register the routes.
> 5. Register error handling last. It has four parameters: `(err, req, res, next)`.

### C sepia 中文

> 請求進了 Express，在碰到你的路由之前，會先走過一串 middleware。每一個都能看它、改它、直接把它打回去，或呼叫 `next()` 放行。
>
> 這串東西照 `app.use` 的順序跑。順序錯了不會報錯，只會悄悄地錯：`requireAuth` 掛在 `/orders` 後面，`/orders` 就誰都看得到。一般的排法是：
>
> - `logger` 最前面，連被擋下的請求也要記到
> - `express.json()`，不然後面的 `req.body` 是 `undefined`
> - `requireAuth`，再來才是路由
>
> 錯誤處理是例外。Express 只看參數個數：寫成四個參數 `(err, req, res, next)`，它就是錯誤處理，而且要放在最後，前面任何一個 `next(err)` 都會落到它手上。

### C sepia English

> A request reaches your route only after it has walked through a chain of middleware. Each one can inspect it, change it, turn it away, or call `next()` and let it through.
>
> The chain runs in `app.use` order, and getting the order wrong raises no error — it is just quietly wrong. Mount `requireAuth` after `/orders` and anyone can read `/orders`. The usual order:
>
> - `logger` first, so even rejected requests get logged
> - `express.json()`, or `req.body` is `undefined` downstream
> - `requireAuth`, then your routes
>
> Error handlers are the odd one out. Express tells them apart by arity alone: give a function four parameters, `(err, req, res, next)`, and it becomes the error handler. It goes last, because every `next(err)` upstream lands there.
