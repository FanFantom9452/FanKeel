// 拋棄式：把 claude 的請求原樣轉給 api.anthropic.com，並把每個 /v1/messages 的請求本文寫進 bodies/。
const http = require('http'), https = require('https'), fs = require('fs'), path = require('path')
const dir = path.join(__dirname, 'bodies'); fs.mkdirSync(dir, { recursive: true })
let n = 0
http.createServer((req, res) => {
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    const body = Buffer.concat(chunks)
    if (req.url.includes('/v1/messages')) fs.writeFileSync(path.join(dir, `${Date.now()}-${++n}.json`), body)
    const headers = { ...req.headers, host: 'api.anthropic.com' }
    const up = https.request({ host: 'api.anthropic.com', path: req.url, method: req.method, headers }, (r) => {
      res.writeHead(r.statusCode, r.headers); r.pipe(res)
    })
    up.on('error', (e) => { res.writeHead(502); res.end(String(e)) })
    up.end(body)
  })
}).listen(8899, '127.0.0.1')
