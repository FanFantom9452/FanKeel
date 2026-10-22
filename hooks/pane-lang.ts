// The words the band and the Pane draw, in the two languages the station
// offers, and which one this machine picked: lib/profile.js KEYS['ui.lang'],
// which the station's globe menu writes to the machine profile. No engine call
// here, so tests/pane-lang.test.js runs it under plain node; hooks/pane.ts
// hands langAt the file reads, as it hands hooks/compact.ts thresholdWith.

export type Lang = 'zh' | 'en'

const ZH = {
  // hooks/pane-band.ts, the band's first row as text
  'band.here': '本站',
  'band.min': '分',
  'band.gate': ' gate 在等 ',
  'band.left': '還 {n} 秒',
  'band.you': '等你',
  'band.youFor': '等你 {n} 分',
  'band.remote': '遠端',
  // hooks/pane-svg.ts, the Desktop band and the Pane's route
  'svg.gate': 'gate 在等',
  'svg.secs': '{n} 秒',
  'route.min': '{n}分',
  'route.wait': '等{n}',
  // hooks/pane-status.ts, the Pane
  'status.min': '{n} 分',
  'status.out': ' · 出去 {n} 分',
  'status.yours': ' · 你的',
  'status.done': ' 完成 {n}',
  'status.rest': ' 還有 {n} 個',
  'status.restYours': '，{n} 個是你的',
  'status.noStation': 'station 未啟動',
  'status.open': '開啟 station',
  'status.agents': '  {r} 在跑 · {d} 完成',
  'status.kidsMore': ' └ 還有 {n} 個',
  'status.rootsMore': '還有 {n} 個',
  'status.shells': '  {r} 在跑 · {d} 結束',
  'status.ended': '結束',
  'status.empty': '這個 session 沒有進行中的任務',
  'status.start': '/fankeel 開一個',
  'status.close': '{id} · /fankeel-panel 關閉',
  'status.noRoom': ' · 列數不夠',
  // hooks/pane.ts, its toast, its command and the command's replies
  'pane.toast': 'station：開不了瀏覽器，也複製不了網址 {url}',
  'pane.command': 'fankeel 面板：任務、撞檔、tasks、用量額度與 notes',
  'pane.closed': 'fankeel 面板已關閉。',
  'pane.opened': 'fankeel 面板已開啟。',
  'pane.noSurface': 'fankeel 面板開不了：這裡畫不了面板，請在終端或 Claude Desktop 開。',
  'pane.reason': 'fankeel 面板開不了：{reason}',
  'pane.narrow': 'fankeel 面板開不了：終端太窄。',
}

export type Word = keyof typeof ZH

export const STRINGS: Record<Lang, Record<Word, string>> = {
  zh: ZH,
  en: {
    'band.here': 'stage',
    'band.min': 'min',
    'band.gate': ' gate waiting ',
    'band.left': '{n}s left',
    'band.you': 'on you',
    'band.youFor': 'on you {n} min',
    'band.remote': 'remote',
    'svg.gate': 'gate waiting',
    'svg.secs': '{n}s',
    'route.min': '{n}m',
    'route.wait': 'wait {n}',
    'status.min': '{n} min',
    'status.out': ' · out {n} min',
    'status.yours': ' · yours',
    'status.done': ' {n} done',
    'status.rest': ' {n} more',
    'status.restYours': ', {n} yours',
    'status.noStation': 'station not running',
    'status.open': 'Open station',
    'status.agents': '  {r} running · {d} done',
    'status.kidsMore': ' └ {n} more',
    'status.rootsMore': '{n} more',
    'status.shells': '  {r} running · {d} ended',
    'status.ended': 'ended',
    'status.empty': 'No task in progress in this session',
    'status.start': '/fankeel to start one',
    'status.close': '{id} · /fankeel-panel to close',
    'status.noRoom': ' · out of rows',
    'pane.toast': 'station: could not open a browser or copy the url {url}',
    'pane.command': 'fankeel panel: task, shared files, tasks, quota and notes',
    'pane.closed': 'fankeel panel closed.',
    'pane.opened': 'fankeel panel opened.',
    'pane.noSurface': 'fankeel panel cannot open here: open it in a terminal or Claude Desktop.',
    'pane.reason': 'fankeel panel cannot open: {reason}',
    'pane.narrow': 'fankeel panel cannot open: the terminal is too narrow.',
  },
}

// The word in `lang` with its {vars} filled. Anything but en is Chinese, so an
// unset ui.lang draws what the mod drew before it had a second language.
export function say(lang: Lang | null | undefined, key: Word, vars: Record<string, string | number> = {}): string {
  const s = (lang === 'en' ? STRINGS.en : STRINGS.zh)[key]
  return s.replace(/\{(\w+)\}/g, (m: string, k: string) => (Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m))
}

// The file reads langAt needs, as plain functions: the engine refuses $ passed to an imported function.
export type LangIo = {
  exists(path: string): Promise<boolean>
  read(path: string): Promise<string>
  log(text: string): void
}

// The machine profile's ui.lang (lib/profile.js machineFile: <configDir>/fankeel/profile.json),
// read on every call so a pick on the station shows on the next tick. A missing
// file, any other value, or a file that does not parse is zh.
export async function langAt(io: LangIo, configDir: string): Promise<Lang> {
  if (!configDir) return 'zh'
  const file = `${configDir.replace(/[\\/]+$/, '')}/fankeel/profile.json`
  try {
    if (!(await io.exists(file))) return 'zh'
    const v = (JSON.parse(String(await io.read(file)).replace(/^\uFEFF/, '')) as Record<string, unknown>)['ui.lang']
    return typeof v === 'string' && v.trim().toLowerCase() === 'en' ? 'en' : 'zh'
  } catch (err) {
    io.log(`fankeel pane: unreadable profile ${file}: ${String(err)}`)
    return 'zh'
  }
}
