// .board 的讀寫：一行一個 JSON 物件。parse 接受 \r\n 與開頭的 BOM；serialize 產生唯一的正規形式。
// Doc 與 Rec 建立後不再被修改，後續一律產生新物件。
import { KINDS, FIELDS, fieldOrder } from './fields.js';
import { put, isObject } from './util.js';

const HEADER_ORDER = ['chartroom', 'title', 'root'];

export class ParseError extends Error {
  constructor(message, line) {
    super(message);
    this.name = 'ParseError';
    this.line = line;
  }
}

// UTF-16 code unit 順序；刻意不用 localeCompare，排序才不會隨語系改變。
export function compareIds(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function fromLine(obj) {
  if (!isObject(obj)) return null;
  const keys = Object.keys(obj);
  const kind = keys[0];
  if (!KINDS.includes(kind)) return null;
  const id = obj[kind];
  if (typeof id !== 'string' || id === '') return null;
  const known = FIELDS[kind];
  const rec = { kind, id };
  for (const key of fieldOrder(kind)) {
    if (Object.hasOwn(obj, key) && obj[key] !== undefined) rec[key] = obj[key];
  }
  for (const key of keys.slice(1)) {
    // Rec 把種類與 id 存在 kind、id 兩個 key；行裡另有同名 key 時無法無損表示。
    if (key === 'kind' || key === 'id') return null;
    if (!Object.hasOwn(known, key) && obj[key] !== undefined) put(rec, key, obj[key]);
  }
  return rec;
}

export function toLine(rec) {
  const out = {};
  put(out, rec.kind, rec.id);
  const known = FIELDS[rec.kind];
  for (const key of fieldOrder(rec.kind)) {
    if (rec[key] !== undefined) out[key] = rec[key];
  }
  for (const key of Object.keys(rec)) {
    if (key === 'kind' || key === 'id' || Object.hasOwn(known, key)) continue;
    put(out, key, rec[key]);
  }
  return out;
}

function headerLine(header) {
  const out = {};
  for (const key of HEADER_ORDER) {
    if (header[key] !== undefined) out[key] = header[key];
  }
  for (const key of Object.keys(header)) {
    if (!HEADER_ORDER.includes(key)) put(out, key, header[key]);
  }
  return out;
}

export function parse(text) {
  const source = String(text);
  const lines = (source.charCodeAt(0) === 0xfeff ? source.slice(1) : source).split(/\r?\n/);
  const recs = Object.create(null);
  const unknown = [];
  let header = null;
  let firstView;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trim() === '') continue;
    const line = i + 1;
    let obj;
    try {
      obj = JSON.parse(raw);
    } catch (err) {
      throw new ParseError(`不是合法的 JSON：${err.message}`, line);
    }
    if (!isObject(obj)) throw new ParseError('每一行必須是一個 JSON 物件', line);
    const isRecord = KINDS.includes(Object.keys(obj)[0]);
    if (header === null) {
      if (isRecord || !Object.hasOwn(obj, 'chartroom')) {
        throw new ParseError('第一行必須是含 chartroom 的檔頭', line);
      }
      header = obj;
      continue;
    }
    if (isRecord) {
      const rec = fromLine(obj);
      if (rec === null) throw new ParseError('紀錄的 id 必須是非空字串，也不能有名為 kind 或 id 的 key', line);
      if (recs[rec.id] !== undefined) throw new ParseError(`重複的 id：${rec.id}`, line);
      recs[rec.id] = rec;
      if (rec.kind === 'view' && firstView === undefined) firstView = rec.id;
      continue;
    }
    if (Object.hasOwn(obj, 'chartroom')) throw new ParseError('檔頭只能出現在第一行', line);
    unknown.push(raw);
  }
  if (header === null) throw new ParseError('缺少檔頭', 1);
  if (header.root === undefined && firstView !== undefined) header.root = firstView;
  return { header, recs, unknown };
}

export function serialize(doc) {
  const out = [JSON.stringify(headerLine(doc.header))];
  const write = (rec) => out.push(JSON.stringify(toLine(rec)));
  const byId = (a, b) => compareIds(a.id, b.id);
  const all = Object.values(doc.recs);
  const views = all.filter((rec) => rec.kind === 'view').sort(byId);
  const root = doc.header.root;
  const ordered = views.filter((v) => v.id === root).concat(views.filter((v) => v.id !== root));
  const groups = new Map(ordered.map((v) => [v.id, { node: [], edge: [], stroke: [] }]));
  const orphans = [];
  for (const rec of all) {
    if (rec.kind === 'view') continue;
    const group = typeof rec.in === 'string' ? groups.get(rec.in) : undefined;
    if (group) group[rec.kind].push(rec);
    else orphans.push(rec);
  }
  ordered.forEach(write);
  for (const view of ordered) {
    const group = groups.get(view.id);
    group.node.sort(byId).forEach(write);
    group.edge.sort(byId).forEach(write);
    group.stroke.sort(byId).forEach(write);
  }
  orphans.sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || byId(a, b)).forEach(write);
  for (const raw of doc.unknown) out.push(raw);
  return out.join('\n') + '\n';
}

export function emptyDoc(title = '未命名') {
  const recs = Object.create(null);
  recs.root = { kind: 'view', id: 'root', title };
  return { header: { chartroom: 1, title, root: 'root' }, recs, unknown: [] };
}

export function rootOf(doc) {
  return doc.header.root;
}

export function recsIn(doc, viewId, kind) {
  const out = [];
  for (const rec of Object.values(doc.recs)) {
    if (rec.kind === 'view' || rec.in !== viewId) continue;
    if (kind !== undefined && rec.kind !== kind) continue;
    out.push(rec);
  }
  return out.sort((a, b) => compareIds(a.id, b.id));
}
