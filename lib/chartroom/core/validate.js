// 參照與結構的檢查：只回報，不丟例外。apply 拿它比對「這批新造成的」問題。
import { FIELDS, REQUIRED, checkValue } from './fields.js';
import { compareIds } from './format.js';

export const CODES = Object.freeze(['dup-id', 'no-id', 'bad-field', 'bad-ref', 'cross-view-edge', 'frame-cycle']);

function kindOf(recs, id) {
  return typeof id === 'string' && Object.hasOwn(recs, id) ? recs[id].kind : undefined;
}

function checkFields(rec, report) {
  const fields = FIELDS[rec.kind];
  for (const key of Object.keys(fields)) {
    if (rec[key] !== undefined && !checkValue(fields[key], rec[key])) {
      report('bad-field', `欄位 ${key} 的值不合法：${JSON.stringify(rec[key])}`);
    }
  }
  for (const key of REQUIRED[rec.kind]) {
    if (rec[key] === undefined) report('bad-field', `缺少必填欄位 ${key}`);
  }
}

function checkNode(rec, recs, report) {
  if (rec.shape === 'frame' && (rec.w === undefined || rec.h === undefined)) {
    report('bad-field', 'frame 必須有 w 與 h');
  }
  if (checkValue('view', rec.detail) && kindOf(recs, rec.detail) !== 'view') {
    report('bad-ref', `detail 指向不存在的 view：${rec.detail}`);
  }
  if (!checkValue('node', rec.frame)) return;
  if (kindOf(recs, rec.frame) !== 'node') {
    report('bad-ref', `frame 指向不存在的節點：${rec.frame}`);
  } else if (recs[rec.frame].shape !== 'frame') {
    report('bad-ref', `frame 指向的節點不是 frame：${rec.frame}`);
  } else if (recs[rec.frame].in !== rec.in) {
    report('cross-view-edge', `frame ${rec.frame} 與節點不在同一個 view`);
  }
}

function checkEdge(rec, recs, report) {
  for (const end of ['from', 'to']) {
    const target = rec[end];
    if (!checkValue('node', target)) continue;
    if (kindOf(recs, target) !== 'node') {
      report('bad-ref', `${end} 指向不存在的節點：${target}`);
    } else if (recs[target].in !== rec.in) {
      report('cross-view-edge', `${end} 端點 ${target} 與連線不在同一個 view`);
    }
  }
}

// 從 id 沿著 frame 往上走：回到自己才算在環上；走進別人的環就停。
function inFrameCycle(recs, id) {
  const seen = new Set();
  let cur = recs[id].frame;
  while (kindOf(recs, cur) === 'node') {
    if (cur === id) return true;
    if (seen.has(cur)) return false;
    seen.add(cur);
    cur = recs[cur].frame;
  }
  return false;
}

export function validateDoc(doc) {
  const recs = doc.recs;
  const problems = [];
  const ids = Object.keys(recs).sort(compareIds);
  for (const id of ids) {
    const rec = recs[id];
    const report = (code, message) => {
      problems.push({ id, code, message });
    };
    checkFields(rec, report);
    if (rec.kind === 'view') continue;
    if (checkValue('view', rec.in) && kindOf(recs, rec.in) !== 'view') {
      report('bad-ref', `in 指向不存在的 view：${rec.in}`);
    }
    if (rec.kind === 'node') checkNode(rec, recs, report);
    else checkEdge(rec, recs, report);
  }
  for (const id of ids) {
    if (recs[id].kind === 'node' && inFrameCycle(recs, id)) {
      problems.push({ id, code: 'frame-cycle', message: 'frame 形成循環' });
    }
  }
  return problems;
}
