// 直角繞線：只吃框（Box = {x, y, w, h}），不認識文件。純函式：不 import React、不碰 DOM。
import { compareIds } from '../core/format.js';
import { checkValue } from '../core/fields.js';
import { separateLanes } from './lanes.js';

// 在「障礙框外擴 margin 後的四邊 + 連接點座標」構成的稀疏格點上做 A*；
// 狀態 = 格點 + 進入方向，成本 = 長度 + 每次轉彎 bend；展開超過 maxExpand 就退回 L 形。

const DX = [1, 0, -1, 0]; // 方向：0 東、1 南、2 西、3 北（SVG 的 y 朝下）
const DY = [0, 1, 0, -1];
const CELL = 256; // 障礙索引的桶寬（px）
const LOOP = 24; // 自環往右伸出的距離

export function routeEdge(from, to, obstacles, opts = {}) {
  const { margin = 12, bend = 40, maxExpand = 5000 } = opts;
  const side = ports(from, to);
  // routeAll 為了不讓兩條線擠在同一邊，會用 opts.p0 / opts.p1 蓋掉預設的邊中點，
  // 並用 opts.dir0（離開起點的方向）/ opts.dir1（進入終點的方向）跟著實際使用的邊走
  const p0 = opts.p0 ?? side.p0;
  const p1 = opts.p1 ?? side.p1;
  const dir0 = opts.dir0 ?? side.dir;
  const dir1 = opts.dir1 ?? side.dir;
  const fallback = () => simplify([p0, [p1[0], p0[1]], p1]);

  // 兩端的框不外擴：線從框邊出發，但不能穿回框裡
  const rects = [rectOf(from, 0), rectOf(to, 0)];
  for (const b of obstacles) {
    let r = rectOf(b, margin);
    if (inside(r, p0) || inside(r, p1)) r = rectOf(b, 0); // 太靠近連接點：只避開原框
    if (inside(r, p0) || inside(r, p1)) continue; // 連接點就在框裡：放棄這個障礙
    rects.push(r);
  }

  const xs = gridLines(rects, 'x1', 'x2', [p0[0], p1[0], (p0[0] + p1[0]) / 2]);
  const ys = gridLines(rects, 'y1', 'y2', [p0[1], p1[1], (p0[1] + p1[1]) / 2]);
  const nx = xs.length;
  const ny = ys.length;
  const index = buildIndex(rects);
  const freeMemo = new Map();
  const free = (i, j) => {
    const k = j * nx + i;
    let v = freeMemo.get(k);
    if (v === undefined) {
      v = !blocked(index, rects, xs[i], ys[j]);
      freeMemo.set(k, v);
    }
    return v;
  };
  // 相鄰格線之間沒有任何框邊：這一步穿過框的內部 ⇔ 這一步的中點在框的內部
  const stepFree = (i, j, ni, nj) =>
    free(ni, nj) && !blocked(index, rects, (xs[i] + xs[ni]) / 2, (ys[j] + ys[nj]) / 2);

  const si = xs.indexOf(p0[0]);
  const sj = ys.indexOf(p0[1]);
  const gi = xs.indexOf(p1[0]);
  const gj = ys.indexOf(p1[1]);
  if (!free(si, sj) || !free(gi, gj)) return fallback();

  const key = (i, j, d) => (j * nx + i) * 4 + d;
  const heur = (i, j, d) => {
    const dx = p1[0] - xs[i];
    const dy = p1[1] - ys[j];
    return Math.abs(dx) + Math.abs(dy) + bend * minBends(d, dx, dy, dir1);
  };
  const start = key(si, sj, dir0);
  const g = new Map([[start, 0]]);
  const prev = new Map();
  const closed = new Set();
  const heap = { f: [], h: [], s: [] };
  const h0 = heur(si, sj, dir0);
  heapPush(heap, h0, h0, start);
  let expanded = 0;

  while (heap.s.length > 0) {
    const s = heapPop(heap);
    if (closed.has(s)) continue;
    closed.add(s);
    if (++expanded > maxExpand) return fallback();
    const d = s % 4;
    const cell = (s - d) / 4;
    const i = cell % nx;
    const j = (cell - i) / nx;
    if (i === gi && j === gj) return simplify(trace(s, prev, xs, ys, nx));
    const gs = g.get(s);
    for (let nd = 0; nd < 4; nd++) {
      if (nd === (d + 2) % 4) continue; // 不原地迴轉
      if (s === start && nd !== dir0) continue; // 第一段垂直離開起點的框邊
      const ni = i + DX[nd];
      const nj = j + DY[nd];
      if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
      if (ni === gi && nj === gj && nd !== dir1) continue; // 最後一段垂直進入終點的框邊
      if (!stepFree(i, j, ni, nj)) continue;
      const ns = key(ni, nj, nd);
      if (closed.has(ns)) continue;
      const ng = gs + Math.abs(xs[ni] - xs[i]) + Math.abs(ys[nj] - ys[j]) + (nd === d ? 0 : bend);
      const old = g.get(ns);
      if (old !== undefined && old <= ng) continue;
      g.set(ns, ng);
      prev.set(ns, s);
      const hh = heur(ni, nj, nd);
      heapPush(heap, ng + hh, hh, ns);
    }
  }
  return fallback();
}

export function routeAll(boxes, edges, { frames = new Set(), ...opts } = {}) {
  const out = new Map();
  const skip = new Set(); // 有折點的線與自環不分軌
  // 有折點的線由使用者決定路徑，不參與同邊錯開，其餘的線也不必為它讓位
  const spread = assignPorts(boxes, edges.filter((e) => !checkValue('points', e.points)), opts.margin);
  for (const e of edges) {
    const a = boxes.get(e.from);
    const b = boxes.get(e.to);
    if (!a || !b) continue;
    if (checkValue('points', e.points)) {
      out.set(e.id, routeVia(a, b, e.points));
      skip.add(e.id);
      continue;
    }
    if (e.from === e.to) {
      out.set(e.id, selfLoop(a));
      skip.add(e.id);
      continue;
    }
    const obstacles = [];
    for (const [id, box] of boxes) {
      if (id !== e.from && id !== e.to && !frames.has(id)) obstacles.push(box);
    }
    out.set(e.id, routeEdge(a, b, obstacles, { ...opts, ...spread.get(e.id) }));
  }
  const blocks = [...boxes].filter(([id]) => !frames.has(id)).map(([, box]) => box);
  return separateLanes(out, skip, opts.margin ?? 12, blocks);
}

// 使用者拖出的折點（座標系同所在 view）：從起點框面向第一個折點的那一邊中點出發，依序直線經過每個折點，
// 進入終點框面向最後一個折點的那一邊中點。不繞障礙、不轉成直角；連續重複的點只留一個
export function routeVia(from, to, points) {
  const path = [sideToward(from, points[0]), ...points.map((p) => [p[0], p[1]]), sideToward(to, points[points.length - 1])];
  const out = [];
  for (const p of path) {
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out.length >= 2 ? out : [out[0], [out[0][0], out[0][1]]];
}

// 框面向 p 的那一邊的中點：水平位移較大就是左右邊，否則上下邊（與 ports 同一個判斷）
function sideToward(b, p) {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const dx = p[0] - cx;
  const dy = p[1] - cy;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? [b.x + b.w, cy] : [b.x, cy];
  return dy >= 0 ? [cx, b.y + b.h] : [cx, b.y];
}

// 同一個框的同一邊上有 k ≥ 2 個線端時：
// 1. 另一端的主要連接點離本邊中點的垂直偏移最小的留下（東西邊看 y、南北邊看 x），同值依 edge id；
// 2. 其餘的改走次要邊（面向另一端的垂直邊），但另一個框要整個在那一邊之外、且至少隔 margin，
//    次要邊上又還沒有任何線端才搬，依 框 id、邊、edge id 的順序逐一處理；
// 3. 搬不走的仍共用一邊，沿該邊在 (i+1)/(k+1) 處錯開，依另一端沿邊方向的座標排序，同值依 edge id。
// 回傳 edge id → { p0?, dir0?, p1?, dir1? }，直接當 routeEdge 的 opts；
// 獨自在原本那一邊的線端不在表內，維持邊中點與 ports 的方向。routeAll 與拖曳預覽共用，兩邊的連接點才會一致
export function assignPorts(boxes, edges, margin = 12) {
  const ends = [];
  for (const e of edges) {
    const a = boxes.get(e.from);
    const b = boxes.get(e.to);
    if (!a || !b || e.from === e.to) continue;
    const { p0, p1, dir } = ports(a, b);
    ends.push({ id: e.id, end: 'p0', node: e.from, box: a, other: b, far: p1, side: dir, home: dir });
    ends.push({ id: e.id, end: 'p1', node: e.to, box: b, other: a, far: p0, side: (dir + 2) % 4, home: (dir + 2) % 4 });
  }
  const groupBy = () => {
    const groups = new Map();
    for (const s of ends) {
      const key = `${s.side}|${s.node}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    }
    return groups;
  };
  const cx = (b) => b.x + b.w / 2;
  const cy = (b) => b.y + b.h / 2;
  const offset = (s) => (s.side % 2 === 0 ? Math.abs(s.far[1] - cy(s.box)) : Math.abs(s.far[0] - cx(s.box)));
  const movers = [];
  for (const list of groupBy().values()) {
    if (list.length < 2) continue;
    list.sort((u, v) => offset(u) - offset(v) || compareIds(u.id, v.id));
    movers.push(...list.slice(1));
  }
  movers.sort((u, v) => compareIds(u.node, v.node) || u.side - v.side || compareIds(u.id, v.id));
  const used = new Set(ends.map((s) => `${s.side}|${s.node}`));
  for (const m of movers) {
    const alt = m.side % 2 === 0 ? (cy(m.other) >= cy(m.box) ? 1 : 3) : (cx(m.other) >= cx(m.box) ? 0 : 2);
    const key = `${alt}|${m.node}`;
    if (!faces(m, alt, margin) || used.has(key)) continue;
    used.add(key);
    m.side = alt;
  }

  const out = new Map(); // edge id → { p0?, dir0?, p1?, dir1? }
  for (const list of groupBy().values()) {
    list.sort((u, v) => {
      const at = (s) => (s.side % 2 === 0 ? cy(s.other) : cx(s.other));
      return at(u) - at(v) || compareIds(u.id, v.id);
    });
    list.forEach((s, i) => {
      if (list.length < 2 && s.side === s.home) return;
      const t = (i + 1) / (list.length + 1);
      const { box } = s;
      const pt = [[box.x + box.w, box.y + box.h * t], [box.x + box.w * t, box.y + box.h],
        [box.x, box.y + box.h * t], [box.x + box.w * t, box.y]][s.side];
      const [pk, dk] = s.end === 'p0' ? ['p0', 'dir0'] : ['p1', 'dir1'];
      out.set(s.id, { ...out.get(s.id), [pk]: pt, [dk]: s.end === 'p0' ? s.side : (s.side + 2) % 4 });
    });
  }
  return out;
}

// 另一個框是否整個在 side 那一邊之外，且至少隔 margin：連接點才有路可出
function faces({ box, other }, side, margin) {
  return [
    other.x >= box.x + box.w + margin,
    other.y >= box.y + box.h + margin,
    other.x + other.w <= box.x - margin,
    other.y + other.h <= box.y - margin,
  ][side];
}

// 依兩框中心的位移決定出入的邊：水平位移較大就走左右兩邊，否則走上下兩邊
function ports(a, b) {
  const ax = a.x + a.w / 2;
  const ay = a.y + a.h / 2;
  const bx = b.x + b.w / 2;
  const by = b.y + b.h / 2;
  const dx = bx - ax;
  const dy = by - ay;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { p0: [a.x + a.w, ay], p1: [b.x, by], dir: 0 }
      : { p0: [a.x, ay], p1: [b.x + b.w, by], dir: 2 };
  }
  return dy >= 0
    ? { p0: [ax, a.y + a.h], p1: [bx, b.y], dir: 1 }
    : { p0: [ax, a.y], p1: [bx, b.y + b.h], dir: 3 };
}

function selfLoop(b) {
  const r = b.x + b.w;
  const cy = b.y + b.h / 2;
  const q = b.h / 4;
  return [[r, cy - q], [r + LOOP, cy - q], [r + LOOP, cy + q], [r, cy + q]];
}

// 目前朝 d、要以方向 e 抵達 (dx, dy) 之外的目標，至少還要轉幾次（可採納的下界）
function minBends(d, dx, dy, e) {
  if (d === e) {
    let ahead;
    if (e === 0) ahead = dy === 0 && dx >= 0;
    else if (e === 2) ahead = dy === 0 && dx <= 0;
    else if (e === 1) ahead = dx === 0 && dy >= 0;
    else ahead = dx === 0 && dy <= 0;
    return ahead ? 0 : 2;
  }
  return d === (e + 2) % 4 ? 2 : 1;
}

function rectOf(b, m) {
  return { x1: b.x - m, y1: b.y - m, x2: b.x + b.w + m, y2: b.y + b.h + m };
}

function inside(r, p) {
  return p[0] > r.x1 && p[0] < r.x2 && p[1] > r.y1 && p[1] < r.y2;
}

function gridLines(rects, lo, hi, extra) {
  const set = new Set(extra);
  for (const r of rects) {
    set.add(r[lo]);
    set.add(r[hi]);
  }
  return [...set].sort((u, v) => u - v);
}

function bucketKey(cx, cy) {
  return (cx + 4096) * 8192 + (cy + 4096);
}

function buildIndex(rects) {
  const index = new Map();
  rects.forEach((r, n) => {
    for (let cx = Math.floor(r.x1 / CELL); cx <= Math.floor(r.x2 / CELL); cx++) {
      for (let cy = Math.floor(r.y1 / CELL); cy <= Math.floor(r.y2 / CELL); cy++) {
        const k = bucketKey(cx, cy);
        const list = index.get(k);
        if (list) list.push(n);
        else index.set(k, [n]);
      }
    }
  });
  return index;
}

// 點是否落在任何框的內部（框邊上不算）
function blocked(index, rects, px, py) {
  const list = index.get(bucketKey(Math.floor(px / CELL), Math.floor(py / CELL)));
  if (!list) return false;
  for (const n of list) {
    const r = rects[n];
    if (px > r.x1 && px < r.x2 && py > r.y1 && py < r.y2) return true;
  }
  return false;
}

function trace(s, prev, xs, ys, nx) {
  const pts = [];
  for (let t = s; t !== undefined; t = prev.get(t)) {
    const cell = (t - (t % 4)) / 4;
    const i = cell % nx;
    pts.push([xs[i], ys[(cell - i) / nx]]);
  }
  return pts.reverse();
}

// 去掉重複點與共線的中間點；至少留兩點
function simplify(pts) {
  const out = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && last[0] === p[0] && last[1] === p[1]) continue;
    if (out.length >= 2) {
      const a = out[out.length - 2];
      if ((a[0] === last[0] && last[0] === p[0]) || (a[1] === last[1] && last[1] === p[1])) out.pop();
    }
    out.push(p);
  }
  return out.length >= 2 ? out : [pts[0], pts[pts.length - 1]];
}

// 二元堆：依 f 由小到大，f 相同時 h 小的先出
function less(heap, a, b) {
  return heap.f[a] < heap.f[b] || (heap.f[a] === heap.f[b] && heap.h[a] < heap.h[b]);
}

function swap(heap, a, b) {
  const f = heap.f[a];
  heap.f[a] = heap.f[b];
  heap.f[b] = f;
  const h = heap.h[a];
  heap.h[a] = heap.h[b];
  heap.h[b] = h;
  const s = heap.s[a];
  heap.s[a] = heap.s[b];
  heap.s[b] = s;
}

function heapPush(heap, f, h, s) {
  heap.f.push(f);
  heap.h.push(h);
  heap.s.push(s);
  let i = heap.s.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (!less(heap, i, p)) break;
    swap(heap, i, p);
    i = p;
  }
}

function heapPop(heap) {
  const top = heap.s[0];
  const last = heap.s.length - 1;
  swap(heap, 0, last);
  heap.f.pop();
  heap.h.pop();
  heap.s.pop();
  const n = heap.s.length;
  let i = 0;
  for (;;) {
    const l = 2 * i + 1;
    const r = l + 1;
    let m = i;
    if (l < n && less(heap, l, m)) m = l;
    if (r < n && less(heap, r, m)) m = r;
    if (m === i) break;
    swap(heap, i, m);
    i = m;
  }
  return top;
}
