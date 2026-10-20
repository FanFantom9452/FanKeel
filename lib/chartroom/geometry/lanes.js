// 同一走道的線分軌：不同邊的中段落在同一條直線上、範圍重疊或相接時，垂直於線錯開。
// 純函式：不 import React、不碰 DOM；不改輸入。
import { compareIds } from '../core/format.js';

const GAP = 6; // 相鄰兩軌最多隔這麼遠

// routes：edge id → 直角折線（已去掉共線點）；skip：不參與的 edge id（有折點的線、自環）；
// blocks：分軌時不能新穿進的框 {x, y, w, h}。
// 只動中段（第 1 段到倒數第 2 段）：中段平移時兩端點一起移，相鄰兩段只變長變短，頭尾的連接點不變。
// 同方向、同座標、範圍重疊或相接的中段來自 n ≥ 2 條邊就是一組，以原線為中心排開，
// 間距 min(GAP, margin / (n - 1))，偏移不超過 margin / 2
export function separateLanes(routes, skip, margin = 12, blocks = []) {
  const half = margin / 2;
  const out = new Map();
  for (const [id, pts] of routes) out.set(id, pts.map((p) => [p[0], p[1]]));
  const all = []; // 每條線的每一段：分軌時不能撞上別條線
  const lines = new Map(); // 「方向|座標」→ 這條直線上的中段
  for (const [id, pts] of routes) {
    for (let k = 0; k + 1 < pts.length; k++) {
      const [p, q] = [pts[k], pts[k + 1]];
      const o = p[0] === q[0] ? 0 : p[1] === q[1] ? 1 : -1; // 0：垂直段，固定 x；1：水平段，固定 y
      if (o < 0) continue;
      const s = { id, k, o, at: p[o], lo: Math.min(p[1 - o], q[1 - o]), hi: Math.max(p[1 - o], q[1 - o]) };
      all.push(s);
      if (skip.has(id) || k === 0 || k + 2 === pts.length) continue;
      const key = `${o}|${s.at}`;
      if (!lines.has(key)) lines.set(key, []);
      lines.get(key).push(s);
    }
  }
  const ctx = { routes, out, half, margin, blocks, all };
  for (const segs of lines.values()) {
    segs.sort((u, v) => u.lo - v.lo);
    let group = [];
    let end = -Infinity;
    for (const s of segs) {
      if (s.lo > end) {
        spread(group, ctx);
        group = [];
      }
      group.push(s);
      end = Math.max(end, s.hi);
    }
    spread(group, ctx);
  }
  return out;
}

// 一組重疊或相接的中段：以邊為單位排軌，同一條邊在組內的每一段平移一樣多。
// 先依進走道的一側排（從左或上進的在左或上軌），同一側依 edge id；
// 再交換相鄰兩軌，直到換了不會減少「接出去的線端落在對方範圍內」的次數（交叉、T 字相接都算）
function spread(group, { routes, out, half, margin, blocks, all }) {
  const byEdge = new Map();
  for (const s of group) {
    const pts = routes.get(s.id);
    const [lo, hi] = room(pts, s, half, blocks, all);
    const side = (p) => (p[s.o] < s.at ? 0 : 1);
    const stubs = [[pts[s.k][1 - s.o], side(pts[s.k - 1])], [pts[s.k + 1][1 - s.o], side(pts[s.k + 2])]];
    const m = byEdge.get(s.id);
    if (!m) {
      byEdge.set(s.id, { id: s.id, side: side(pts[s.k - 1]), lo, hi, from: s.lo, to: s.hi, stubs, segs: [s] });
      continue;
    }
    Object.assign(m, { lo: Math.max(m.lo, lo), hi: Math.min(m.hi, hi), from: Math.min(m.from, s.lo), to: Math.max(m.to, s.hi) });
    m.stubs.push(...stubs);
    m.segs.push(s);
  }
  const list = [...byEdge.values()].sort((u, v) => u.side - v.side || compareIds(u.id, v.id));
  const n = list.length;
  if (n < 2) return;
  const cost = (u, v) => u.stubs.filter(([at, sd]) => sd === 1 && at >= v.from && at <= v.to).length
    + v.stubs.filter(([at, sd]) => sd === 0 && at >= u.from && at <= u.to).length;
  let again = true;
  while (again) {
    again = false;
    for (let i = 0; i + 1 < n; i++) {
      if (cost(list[i + 1], list[i]) < cost(list[i], list[i + 1])) {
        [list[i], list[i + 1]] = [list[i + 1], list[i]];
        again = true;
      }
    }
  }
  // 間距取最大的可行值：任兩軌 i < j 差 (j - i)·gap，不能超過 j 往右（下）與 i 往左（上）能移的總和；再整組平移到每條都在可移範圍內
  const mid = (n - 1) / 2;
  let gap = Math.min(GAP, margin / (n - 1));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) gap = Math.min(gap, (list[j].hi - list[i].lo) / (j - i));
  }
  let lo = -Infinity;
  let hi = Infinity;
  list.forEach((m, i) => {
    lo = Math.max(lo, m.lo - (i - mid) * gap);
    hi = Math.min(hi, m.hi - (i - mid) * gap);
  });
  const center = Math.min(Math.max(0, lo), hi);
  list.forEach((m, i) => {
    const d = Math.min(Math.max(center + (i - mid) * gap, m.lo), m.hi);
    for (const s of m.segs) {
      const pts = out.get(s.id);
      pts[s.k][s.o] += d;
      pts[s.k + 1][s.o] += d;
    }
  });
}

// 中段 s 平移 d 的可行範圍 [lo, hi]（含 0）：最多 half；相鄰兩段被這一端縮掉的不超過 1/3（另一端也可能被別組縮）；
// 不新穿進框；往平行的別條線最多走近兩者距離的 1/3（對方也可能迎面移過來）。
// 相鄰的中段平移會把這段拉長，所以比對框與別條線時，沿線的範圍兩端各多算 half
function room(pts, s, half, blocks, all) {
  const { k, o, at } = s;
  let lo = -half;
  let hi = half;
  for (const p of [pts[k - 1], pts[k + 2]]) {
    if (p[o] < at) lo = Math.max(lo, (p[o] - at) / 3);
    else hi = Math.min(hi, (p[o] - at) / 3);
  }
  const [x, y, w, h] = o === 0 ? ['x', 'y', 'w', 'h'] : ['y', 'x', 'h', 'w']; // x、w 垂直於線，y、h 沿線
  for (const b of blocks) {
    if (b[y] >= s.hi + half || b[y] + b[h] <= s.lo - half) continue;
    if (b[x] + b[w] <= at) lo = Math.max(lo, b[x] + b[w] - at);
    else if (b[x] >= at) hi = Math.min(hi, b[x] - at);
  }
  for (const t of all) {
    if (t.o !== o || t.id === s.id || t.at === at || t.lo > s.hi + half || t.hi < s.lo - half) continue;
    if (t.at < at) lo = Math.max(lo, (t.at - at) / 3);
    else hi = Math.min(hi, (t.at - at) / 3);
  }
  return [lo, hi];
}
