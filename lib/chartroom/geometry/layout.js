// 自動排版：只擺未擺放的節點。結果固定（同輸入同輸出）、絕不移動已擺放的節點、不與任何節點重疊。
// 純函式：不 import React、不碰 DOM。
import { recsIn, compareIds } from '../core/format.js';
import { approxMeasure, nodeSize, isPlaced } from './measure.js';
import { EDGE_LABEL_SIZE, labelPillSize } from './shapes.js';

const RIGHT_GAP = 80; // 已擺放內容右緣到第一欄（TB 是下緣到第一列）
const COL_GAP = 60;
const ROW_GAP = 24;
const PAD = 16; // frame 內距
const HEAD = 24; // frame 標題列；子節點從內距下方再空一列開始
const GAP = 24; // frame 內的間距
const EDGE_PAD = 12; // 走道裡連線標籤底框的左右各留這麼多
const LOOSE_ROWS = 6; // 和其他未擺放頂層節點都沒有連線的，每欄最多幾個
const SWEEPS = 4; // 重心排序來回掃幾輪

export function layout(doc, viewId, measure = approxMeasure) {
  const nodes = recsIn(doc, viewId, 'node');
  const byId = new Map(nodes.map((r) => [r.id, r]));
  const size = new Map(nodes.map((r) => [r.id, nodeSize(r, measure)]));
  const parent = parentMap(nodes, byId);
  const kids = new Map();
  for (const r of nodes) {
    const p = parent.get(r.id);
    if (p === undefined) continue;
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p).push(r.id); // nodes 已依 id 排序，kids 也是
  }

  const rel = new Map(); // id → 相對父框的左上角（頂層則為絕對座標）
  const foot = new Map(); // id → 自身加上所有子孫、相對自身左上角的外框 {x1,y1,x2,y2}

  const arrange = (id) => {
    const s = size.get(id);
    const children = kids.get(id) ?? [];
    for (const c of children) arrange(c);
    const taken = [];
    for (const c of children) {
      const r = byId.get(c);
      if (!isPlaced(r)) continue;
      rel.set(c, { x: r.x, y: r.y });
      taken.push(shift(foot.get(c), r.x, r.y));
    }
    const loose = children.filter((c) => !isPlaced(byId.get(c)));
    let right = 0; // 未擺放的子節點的右下緣：框的外框長到包住它們，已擺放的子節點伸出框外不算
    let bottom = 0;
    const put = (c, cx, cy) => {
      const f = foot.get(c);
      rel.set(c, { x: cx - f.x1, y: cy - f.y1 });
      taken.push({ x1: cx, y1: cy, x2: cx + f.x2 - f.x1, y2: cy + f.y2 - f.y1 });
      right = Math.max(right, cx + f.x2 - f.x1);
      bottom = Math.max(bottom, cy + f.y2 - f.y1);
    };
    if (taken.length > 0 && loose.length > 0) {
      // 框裡已有擺放的子節點：未擺放的另起一欄放在它們右邊 2 × GAP，整欄由上往下堆，不去擠已擺放的縫隙；
      // 下一個會超出（框高 − 內距，或已擺放的下緣）且這欄已有節點就換欄
      const limit = Math.max(s.h - PAD, ...taken.map((t) => t.y2));
      let cx = Math.max(...taken.map((t) => t.x2)) + 2 * GAP;
      let cy = PAD + HEAD;
      let colW = 0;
      for (const c of loose) {
        const f = foot.get(c);
        const w = f.x2 - f.x1;
        const h = f.y2 - f.y1;
        if (cy > PAD + HEAD && cy + h > limit) {
          cx += colW + GAP;
          cy = PAD + HEAD;
          colW = 0;
        }
        put(c, cx, cy);
        cy += h + GAP;
        colW = Math.max(colW, w);
      }
    } else {
      const maxX = s.w - PAD;
      let cx = PAD;
      let cy = PAD + HEAD;
      let rowH = 0;
      for (const c of loose) {
        const f = foot.get(c);
        const w = f.x2 - f.x1;
        const h = f.y2 - f.y1;
        if (cx > PAD && cx + w > maxX) {
          cx = PAD;
          cy += rowH + GAP;
          rowH = 0;
        }
        put(c, cx, cy);
        rowH = Math.max(rowH, h);
        cx += w + GAP;
      }
    }
    if (loose.length > 0) size.set(id, { ...s, w: Math.max(s.w, right + PAD), h: Math.max(s.h, bottom + PAD) });
    const g = size.get(id);
    foot.set(id, taken.reduce(union, { x1: 0, y1: 0, x2: g.w, y2: g.h }));
  };

  const tops = nodes.filter((r) => !parent.has(r.id));
  for (const r of tops) arrange(r.id);

  // 方向取自 view 的 dir：LR（預設）一層一欄、由左往右；TB 一層一列、由上往下，就是把 LR 的 x、y 對調
  const tb = doc.recs[viewId]?.dir === 'TB';
  let startX = 0;
  let startY = 0;
  const placedTops = tops.filter((r) => isPlaced(r));
  if (placedTops.length > 0) {
    startX = tb ? Infinity : -Infinity;
    startY = tb ? -Infinity : Infinity;
    for (const r of placedTops) {
      const f = foot.get(r.id);
      rel.set(r.id, { x: r.x, y: r.y });
      if (tb) {
        startX = Math.min(startX, r.x + f.x1);
        startY = Math.max(startY, r.y + f.y2 + RIGHT_GAP);
      } else {
        startX = Math.max(startX, r.x + f.x2 + RIGHT_GAP);
        startY = Math.min(startY, r.y + f.y1);
      }
    }
  }

  const free = tops.filter((r) => !isPlaced(r)).map((r) => r.id);
  const topOf = (id) => {
    let cur = id;
    while (parent.has(cur)) cur = parent.get(cur);
    return cur;
  };
  const edges = recsIn(doc, viewId, 'edge');
  const cols = columns(free, edges, topOf);
  const gaps = channelGaps(cols, edges, topOf, measure, tb);
  let x = startX;
  let y = startY;
  // TB：每一列依最寬的一列的中線置中，單節點的列中心 x 一致，列間的直線不折
  const rowWidth = (col) => col.reduce((sum, id) => sum + foot.get(id).x2 - foot.get(id).x1 + ROW_GAP, -ROW_GAP);
  const widest = tb ? Math.max(0, ...cols.map(rowWidth)) : 0;
  cols.forEach((col, k) => {
    let along = tb ? startX + (widest - rowWidth(col)) / 2 : startY; // 這一欄（TB 是這一列）裡下一個節點的位置
    let across = 0; // 這一欄最寬（TB 是這一列最高）
    for (const id of col) {
      const f = foot.get(id);
      const w = f.x2 - f.x1;
      const h = f.y2 - f.y1;
      if (tb) {
        rel.set(id, { x: along - f.x1, y: y - f.y1 });
        along += w + ROW_GAP;
        across = Math.max(across, h);
      } else {
        rel.set(id, { x: x - f.x1, y: along - f.y1 });
        along += h + ROW_GAP;
        across = Math.max(across, w);
      }
    }
    if (tb) y += across + gaps[k];
    else x += across + gaps[k];
  });

  const abs = new Map();
  const absOf = (id) => {
    const known = abs.get(id);
    if (known) return known;
    const r = rel.get(id);
    const p = parent.get(id);
    let a = r;
    if (p !== undefined) {
      const pa = absOf(p);
      a = { x: pa.x + r.x, y: pa.y + r.y };
    }
    abs.set(id, a);
    return a;
  };
  const out = new Map();
  for (const r of nodes) {
    const a = absOf(r.id);
    const s = size.get(r.id);
    out.set(r.id, { x: a.x, y: a.y, w: s.w, h: s.h });
  }
  return out;
}

// 有效的父框：同一 view、shape 是 frame、不是自己；成環的節點一律當成頂層
function parentMap(nodes, byId) {
  const raw = new Map();
  for (const r of nodes) {
    const p = r.frame;
    if (typeof p === 'string' && p !== r.id && byId.get(p)?.shape === 'frame') raw.set(r.id, p);
  }
  const parent = new Map(raw);
  for (const r of nodes) {
    const seen = [];
    let cur = r.id;
    while (raw.has(cur) && !seen.includes(cur)) {
      seen.push(cur);
      cur = raw.get(cur);
    }
    if (raw.has(cur) && seen.includes(cur)) {
      let c = cur;
      do {
        parent.delete(c);
        c = raw.get(c);
      } while (c !== cur);
    }
  }
  return parent;
}

// 頂層未擺放節點分欄。彼此有連線的：DFS 拿掉回邊 → 最長路徑分層 → 依前驅重心排一次，再來回各掃 SWEEPS 輪
// （由右到左依後繼、由左到右依前驅；這一側沒有鄰居的以目前位置當重心，同分保持目前順序，起始順序是 id）。
// 和其他未擺放頂層節點都沒有連線的：依 id 接在後面，每欄最多 LOOSE_ROWS 個
function columns(ids, edges, topOf) {
  const set = new Set(ids);
  const succ = new Map(ids.map((id) => [id, []]));
  const linked = new Set();
  for (const e of edges) {
    const a = topOf(e.from);
    const b = topOf(e.to);
    if (a === b || !set.has(a) || !set.has(b)) continue;
    linked.add(a);
    linked.add(b);
    if (!succ.get(a).includes(b)) succ.get(a).push(b);
  }
  for (const list of succ.values()) list.sort(compareIds);

  const ranked = ids.filter((id) => linked.has(id));
  const preds = new Map(ranked.map((id) => [id, []]));
  const next = new Map(ranked.map((id) => [id, []])); // 拿掉回邊之後的後繼
  const state = new Map(); // 1 = 在堆疊上，2 = 完成
  const visit = (u) => {
    state.set(u, 1);
    for (const v of succ.get(u)) {
      if (state.get(v) === 1) continue; // 回邊
      preds.get(v).push(u);
      next.get(u).push(v);
      if (!state.has(v)) visit(v);
    }
    state.set(u, 2);
  };
  for (const id of ranked) if (!state.has(id)) visit(id);

  const layer = new Map();
  const layerOf = (id) => {
    if (layer.has(id)) return layer.get(id);
    let l = 0;
    for (const p of preds.get(id)) l = Math.max(l, layerOf(p) + 1);
    layer.set(id, l);
    return l;
  };
  const cols = [];
  for (const id of ranked) {
    const l = layerOf(id);
    if (!cols[l]) cols[l] = [];
    cols[l].push(id);
  }

  const pos = new Map();
  for (const col of cols) col.forEach((id, n) => pos.set(id, n));
  const order = (col, nbrs) => {
    const bary = new Map(col.map((id) => {
      const ns = nbrs.get(id);
      return [id, ns.length ? ns.reduce((sum, p) => sum + pos.get(p), 0) / ns.length : pos.get(id)];
    }));
    col.sort((a, b) => bary.get(a) - bary.get(b) || pos.get(a) - pos.get(b));
    col.forEach((id, n) => pos.set(id, n));
  };
  for (let k = 1; k < cols.length; k++) order(cols[k], preds);
  for (let s = 0; s < SWEEPS; s++) {
    for (let k = cols.length - 2; k >= 0; k--) order(cols[k], next);
    for (let k = 1; k < cols.length; k++) order(cols[k], preds);
  }

  const loose = ids.filter((id) => !linked.has(id));
  for (let k = 0; k < loose.length; k += LOOSE_ROWS) cols.push(loose.slice(k, k + LOOSE_ROWS));
  return cols;
}

// 欄 k 與 k + 1 之間的走道寬（TB 是列與列之間的高）：COL_GAP，或跨過它的有標籤連線裡，最寬（TB 是最高）的
// 標籤底框加兩側各 EDGE_PAD。標籤的量法與 scene 相同（注入的 measure、字級 EDGE_LABEL_SIZE）；跨好幾欄的連線，每條走道都算
function channelGaps(cols, edges, topOf, measure, tb = false) {
  const colOf = new Map();
  cols.forEach((col, k) => col.forEach((id) => colOf.set(id, k)));
  const gaps = cols.map(() => COL_GAP);
  for (const e of edges) {
    if (typeof e.label !== 'string' || e.label === '') continue;
    const a = colOf.get(topOf(e.from));
    const b = colOf.get(topOf(e.to));
    if (a === undefined || b === undefined || a === b) continue;
    const pill = labelPillSize({ label: e.label, labelSize: measure(e.label, EDGE_LABEL_SIZE) });
    const need = (tb ? pill.h : pill.w) + 2 * EDGE_PAD;
    for (let k = Math.min(a, b); k < Math.max(a, b); k++) gaps[k] = Math.max(gaps[k], need);
  }
  return gaps;
}

function shift(f, dx, dy) {
  return { x1: f.x1 + dx, y1: f.y1 + dy, x2: f.x2 + dx, y2: f.y2 + dy };
}

function union(a, b) {
  return { x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1), x2: Math.max(a.x2, b.x2), y2: Math.max(a.y2, b.y2) };
}
