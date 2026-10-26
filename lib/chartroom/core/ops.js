// 一批操作：依序套在工作副本上，整批成功或整批不動。
// 只拒絕「這批新造成的」問題；反操作就是 diff(after, before)，連帶的變更自然都在裡面。
import { FIELDS, GEOMETRY_FIELDS, checkValue } from './fields.js';
import { fromLine, toLine, rootOf } from './format.js';
import { validateDoc } from './validate.js';
import { put, isObject } from './util.js';
import { diff, summarize } from './diff.js';

export class BatchError extends Error {
  constructor(errors) {
    super(errors.map((e) => `#${e.i} ${e.code} ${e.message}`).join('\n'));
    this.name = 'BatchError';
    this.errors = errors;
  }
}

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const problemKey = (p) => `${p.id}\u0000${p.code}`;
const fail = (code, message) => ({ code, message });
// 淺複製一筆紀錄；用屬性描述子複製，名為 __proto__ 的未知 key 照樣是自有屬性。
const clone = (rec) => Object.defineProperties({}, Object.getOwnPropertyDescriptors(rec));
// set 不能改種類與 id：kind、id 與紀錄自己的種類 key（節點上的 node）一律拒絕；以別種紀錄命名的 key 只是未知 key。
const locked = (rec, key) => key === 'kind' || key === 'id' || key === rec.kind;

function lookup(work, id) {
  return typeof id === 'string' ? work.recs[id] : undefined;
}

// 換成新紀錄；內容沒變就沿用原物件。被碰到的 id 記下操作索引，驗證階段報錯時用。
function store(work, cur, next, i) {
  const rec = fromLine(toLine(next));
  if (JSON.stringify(toLine(rec)) !== JSON.stringify(toLine(cur))) work.recs[cur.id] = rec;
  work.touched.set(cur.id, i);
}

function addRec(work, op, i) {
  const rec = fromLine(op.rec);
  if (rec === null) return fail('bad-field', 'rec 不是合法的紀錄行');
  if (work.recs[rec.id] !== undefined) return fail('dup-id', `id 已存在：${rec.id}`);
  work.recs[rec.id] = rec;
  work.touched.set(rec.id, i);
  return null;
}

function setRec(work, op, i) {
  const cur = lookup(work, op.id);
  if (cur === undefined) return fail('no-id', `找不到 id：${op.id}`);
  if (!isObject(op.f)) return fail('bad-field', 'f 必須是物件');
  const fields = FIELDS[cur.kind];
  const next = clone(cur);
  for (const key of Object.keys(op.f)) {
    if (locked(cur, key)) return fail('bad-field', `set 不能改種類或 id：${key}`);
    const value = op.f[key];
    if (value === null) {
      delete next[key];
    } else if (Object.hasOwn(fields, key) && !checkValue(fields[key], value)) {
      return fail('bad-field', `欄位 ${key} 的值不合法：${JSON.stringify(value)}`);
    } else {
      // 已知欄位（值已通過 checkValue）或未知 key（原樣存），store 重排後未知 key 排在已知欄位之後。
      put(next, key, value);
    }
  }
  store(work, cur, next, i);
  return null;
}

// 刪 frame：子節點座標加上 frame 的座標（frame 未擺放就不改），改掛到 frame 自己的 frame。
function reparent(work, childId, frame, i) {
  const cur = work.recs[childId];
  if (cur === undefined) return;
  const next = clone(cur);
  if (isNumber(frame.x) && isNumber(frame.y)) {
    if (isNumber(cur.x)) next.x = cur.x + frame.x;
    if (isNumber(cur.y)) next.y = cur.y + frame.y;
  }
  if (frame.frame !== undefined) next.frame = frame.frame;
  else delete next.frame;
  store(work, cur, next, i);
}

// 刪 node 連帶刪碰到它的 edge、把它的子節點改掛上一層；刪 view 連帶刪它的紀錄、清掉指向它的 detail。
function remove(work, id, i) {
  const rec = work.recs[id];
  if (rec === undefined) return;
  delete work.recs[id];
  work.touched.set(id, i);
  const rest = Object.values(work.recs);
  if (rec.kind === 'node') {
    for (const other of rest) {
      if (other.kind === 'edge' && (other.from === id || other.to === id)) remove(work, other.id, i);
      else if (other.kind === 'node' && other.frame === id) reparent(work, other.id, rec, i);
    }
  } else if (rec.kind === 'view') {
    for (const other of rest) {
      if (other.kind !== 'view' && other.in === id) remove(work, other.id, i);
    }
    for (const other of Object.values(work.recs)) {
      if (other.kind === 'node' && other.detail === id) {
        const next = clone(other);
        delete next.detail;
        store(work, other, next, i);
      }
    }
  }
}

function delRec(work, op, i) {
  const cur = lookup(work, op.id);
  if (cur === undefined) return fail('no-id', `找不到 id：${op.id}`);
  if (cur.kind === 'view' && cur.id === work.root) return fail('bad-ref', `不能刪除 root view：${cur.id}`);
  remove(work, cur.id, i);
  return null;
}

function applyOp(work, op, i) {
  if (!isObject(op)) return fail('bad-field', '操作必須是物件');
  if (op.op === 'add') return addRec(work, op, i);
  if (op.op === 'set') return setRec(work, op, i);
  if (op.op === 'del') return delRec(work, op, i);
  return fail('bad-field', `未知的操作：${op.op}`);
}

export function apply(doc, batch) {
  if (!isObject(batch) || !Array.isArray(batch.ops)) {
    throw new BatchError([{ i: -1, code: 'bad-field', message: 'batch 必須是帶 ops 陣列的物件' }]);
  }
  const work = { recs: Object.assign(Object.create(null), doc.recs), touched: new Map(), root: rootOf(doc) };
  const errors = [];
  batch.ops.forEach((op, i) => {
    const problem = applyOp(work, op, i);
    if (problem !== null) errors.push({ i, code: problem.code, message: problem.message });
  });
  const after = { header: doc.header, recs: work.recs, unknown: doc.unknown };
  const known = new Set(validateDoc(doc).map(problemKey));
  // 失敗的操作不會改動 work，所以這裡只會看到成功的操作造成的問題；操作階段的錯誤排在前面，一起丟。
  for (const p of validateDoc(after)) {
    if (known.has(problemKey(p))) continue;
    errors.push({
      i: work.touched.has(p.id) ? work.touched.get(p.id) : -1,
      code: p.code,
      message: `${p.id}：${p.message}`,
    });
  }
  if (errors.length > 0) throw new BatchError(errors);
  const summary = summarize(doc, after);
  return {
    doc: after,
    inverse: { ops: diff(after, doc), by: 'human', note: '復原：' + (batch.note ?? summary.text) },
    summary,
  };
}

const COORD_KEYS = new Set([...GEOMETRY_FIELDS, 'points']);
const omitCoords = (obj) => Object.fromEntries(Object.entries(obj).filter(([key]) => !COORD_KEYS.has(key)));

// 「座標以外全部套用」：add 的紀錄與 set 的欄位拿掉 x、y、w、h、points；set 因此空了就整個丟掉。不改輸入
export function withoutCoords(ops) {
  const out = [];
  for (const op of ops) {
    if (isObject(op) && op.op === 'add' && isObject(op.rec)) {
      out.push({ ...op, rec: omitCoords(op.rec) });
    } else if (isObject(op) && op.op === 'set' && isObject(op.f)) {
      const f = omitCoords(op.f);
      if (Object.keys(f).length > 0) out.push({ ...op, f });
    } else {
      out.push(op);
    }
  }
  return out;
}
