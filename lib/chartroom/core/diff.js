// 兩份文件之間的一批操作，以及變更卡上的摘要。只比 recs，不比 header 與 unknown。
import { KINDS } from './fields.js';
import { toLine, compareIds } from './format.js';
import { put } from './util.js';

// 新增依 view → node → edge → stroke；刪除反過來，筆畫與連線都得在它們所在的 view、端點之前刪，
// 否則先刪 view 會連帶刪掉它們，再刪就是 no-id
const ADD_ORDER = { view: 0, node: 1, edge: 2, stroke: 3 };
const DEL_ORDER = { stroke: 0, edge: 1, node: 2, view: 3 };
const UNITS = { view: '子板', node: '節點', edge: '連線', stroke: '筆畫' };

const get = (recs, id) => (Object.hasOwn(recs, id) ? recs[id] : undefined);

// 只列變動的 key；被移除的給 null。沒有任何變動時回傳 null。
function changedFields(a, b) {
  const la = toLine(a);
  const lb = toLine(b);
  const keys = Array.from(new Set(Object.keys(lb).concat(Object.keys(la)))).filter((key) => key !== a.kind);
  const f = {};
  let changed = false;
  for (const key of keys) {
    if (!Object.hasOwn(lb, key)) {
      put(f, key, null);
      changed = true;
    } else if (!Object.hasOwn(la, key) || JSON.stringify(la[key]) !== JSON.stringify(lb[key])) {
      put(f, key, lb[key]);
      changed = true;
    }
  }
  return changed ? f : null;
}

// 同種類兩筆紀錄之間的 set 內容；同一個物件或沒有變動時是 null。
// diff 與 summarize 都只看它，未知 key 只換順序時兩邊都說沒變。
const setFields = (ra, rb) => (ra === rb ? null : changedFields(ra, rb));

export function diff(a, b) {
  const adds = [];
  const sets = [];
  const dels = [];
  for (const id of Object.keys(b.recs)) {
    const rb = b.recs[id];
    const ra = get(a.recs, id);
    if (ra === undefined) {
      adds.push(rb);
    } else if (ra.kind !== rb.kind) {
      dels.push(ra);
      adds.push(rb);
    } else {
      const f = setFields(ra, rb);
      if (f !== null) sets.push({ op: 'set', id, f });
    }
  }
  for (const id of Object.keys(a.recs)) {
    if (get(b.recs, id) === undefined) dels.push(a.recs[id]);
  }
  const by = (order) => (x, y) => order[x.kind] - order[y.kind] || compareIds(x.id, y.id);
  adds.sort(by(ADD_ORDER));
  sets.sort((x, y) => compareIds(x.id, y.id));
  dels.sort(by(DEL_ORDER));
  // set → del → add：先改掛子節點再刪 frame，座標只加一次；先刪舊的再加新的，同一個 id 換種類不撞 dup-id。
  return sets
    .concat(dels.map((rec) => ({ op: 'del', id: rec.id })))
    .concat(adds.map((rec) => ({ op: 'add', rec: toLine(rec) })));
}

export function summarize(before, after) {
  const zero = () => ({ view: 0, node: 0, edge: 0, stroke: 0 });
  const added = zero();
  const removed = zero();
  const changed = zero();
  const ids = [];
  for (const id of Object.keys(after.recs)) {
    const rb = after.recs[id];
    const ra = get(before.recs, id);
    if (ra === undefined) {
      added[rb.kind] += 1;
    } else if (ra.kind !== rb.kind) {
      removed[ra.kind] += 1;
      added[rb.kind] += 1;
    } else if (setFields(ra, rb) === null) {
      continue;
    } else {
      changed[rb.kind] += 1;
    }
    ids.push(id);
  }
  for (const id of Object.keys(before.recs)) {
    if (get(after.recs, id) === undefined) {
      removed[before.recs[id].kind] += 1;
      ids.push(id);
    }
  }
  const parts = [];
  for (const [verb, counts] of [['新增', added], ['刪除', removed], ['修改', changed]]) {
    const items = KINDS.filter((kind) => counts[kind] > 0).map((kind) => `${counts[kind]} ${UNITS[kind]}`);
    if (items.length > 0) parts.push(`${verb} ${items.join('、')}`);
  }
  return {
    added,
    removed,
    changed,
    ids: ids.sort(compareIds),
    text: parts.length > 0 ? parts.join('；') : '沒有變更',
  };
}
