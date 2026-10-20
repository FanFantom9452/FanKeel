// 顯示清單：每個節點、框、連線、標籤、鑽入標記的絕對幾何。它是唯一的幾何來源，畫面與匯出都吃它。
// 純函式：不 import React、不碰 DOM。
import { recsIn, compareIds } from '../core/format.js';
import { approxMeasure, isPlaced } from './measure.js';
import { EDGE_LABEL_SIZE, labelPillSize } from './shapes.js';
import { layout } from './layout.js';
import { routeAll } from './route.js';

const EDGE_HIT = 6;
const LABEL_FRACTIONS = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]; // 標籤沿折線弧長試放的位置，依序
const LABEL_CLEAR = 4; // 標籤底框與其他標籤底框、與節點至少隔這麼遠
// path 裡的數字：絕對座標的 M/L/Q/C 兩兩成對（fields.js 的 STROKE_LIMITS.path 只放行這幾種指令）
const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;

export function scene(doc, viewId, measure = approxMeasure) {
  const boxes = layout(doc, viewId, measure);
  const nodes = recsIn(doc, viewId, 'node');
  const byId = new Map(nodes.map((r) => [r.id, r]));
  const frames = [];
  const shapes = [];
  for (const r of nodes) {
    const b = boxes.get(r.id);
    const label = typeof r.label === 'string' ? r.label : r.id;
    const paint = { fill: r.fill ?? null, stroke: r.stroke ?? null, strokeWidth: r.strokeWidth ?? null };
    if (r.shape === 'frame') {
      frames.push({ type: 'frame', id: r.id, x: b.x, y: b.y, w: b.w, h: b.h, label, ...paint, depth: depthOf(r, byId) });
    } else {
      shapes.push({
        type: 'node', id: r.id, shape: r.shape ?? 'rect', x: b.x, y: b.y, w: b.w, h: b.h, label, lines: label.split('\n'),
        ...paint, color: r.color ?? null, detail: r.detail ?? null, placed: isPlaced(r),
        icon: r.icon ?? null, src: r.src ?? null, size: r.size ?? null, weight: r.weight ?? null,
      });
    }
  }
  frames.sort((a, b) => a.depth - b.depth || compareIds(a.id, b.id));

  const edgeRecs = recsIn(doc, viewId, 'edge').filter((e) => boxes.has(e.from) && boxes.has(e.to));
  // points 是使用者拖出的折點，交給 routeAll：有折點的線照折點走
  const routes = routeAll(
    boxes,
    edgeRecs.map((e) => ({ id: e.id, from: e.from, to: e.to, points: e.points })),
    { frames: new Set(frames.map((f) => f.id)) },
  );
  const edges = edgeRecs.map((e) => {
    const points = routes.get(e.id);
    const label = typeof e.label === 'string' ? e.label : '';
    return {
      type: 'edge', id: e.id, from: e.from, to: e.to, points,
      label, labelAt: halfway(points), labelSize: label ? measure(label, EDGE_LABEL_SIZE) : null,
      stroke: e.stroke ?? null, strokeWidth: e.strokeWidth ?? null, dash: e.dash === true, arrow: e.arrow ?? 'end', head: e.head ?? 'arrow',
    };
  });

  placeLabels(edges, shapes);
  // 保留筆：不進 items（不參與點擊與選取），畫的一方另外疊在最上層
  const strokes = recsIn(doc, viewId, 'stroke')
    .filter((s) => typeof s.d === 'string' && s.d !== '')
    .map((s) => ({
      type: 'stroke', id: s.id, d: s.d,
      color: typeof s.color === 'string' ? s.color : null,
      width: typeof s.width === 'number' ? s.width : null,
    }));
  const items = [...frames, ...edges, ...shapes];
  return { viewId, bounds: boundsOf(items, strokes), items, boxes, strokes };
}

export function hitTest(sc, x, y) {
  for (let k = sc.items.length - 1; k >= 0; k--) {
    const it = sc.items[k];
    if (it.type === 'node' && within(it, x, y)) return it;
  }
  for (let k = sc.items.length - 1; k >= 0; k--) {
    const it = sc.items[k];
    if (it.type === 'edge' && nearLine(it.points, x, y) <= EDGE_HIT) return it;
  }
  let best = null;
  for (const it of sc.items) {
    if (it.type === 'frame' && within(it, x, y) && (!best || it.depth >= best.depth)) best = it;
  }
  return best;
}

// 框的層數：往上數同一 view 裡、shape 是 frame 的祖先；成環時停下
function depthOf(rec, byId) {
  const seen = new Set([rec.id]);
  let depth = 0;
  let cur = byId.get(rec.frame);
  while (cur && cur.shape === 'frame' && !seen.has(cur.id)) {
    seen.add(cur.id);
    depth++;
    cur = byId.get(cur.frame);
  }
  return depth;
}

export function halfway(points) {
  return pointAt(points, 0.5);
}

// 依 edges 的順序放有標籤的連線：標籤底框離已放好的底框、離任何節點（框不算）都至少 LABEL_CLEAR 的第一個位置；
// 都不行就留在 0.5。拖曳預覽不經過這裡，仍用 halfway，放手後才重新避讓
function placeLabels(edges, shapes) {
  const nodes = shapes.map((n) => ({ x1: n.x, y1: n.y, x2: n.x + n.w, y2: n.y + n.h }));
  const placed = [];
  for (const e of edges) {
    if (!e.label) continue;
    const { w, h } = labelPillSize(e);
    const boxAt = ([x, y]) => ({ x1: x - w / 2, y1: y - h / 2, x2: x + w / 2, y2: y + h / 2 });
    const clear = (b) => placed.every((p) => apart(b, p, LABEL_CLEAR)) && nodes.every((n) => apart(b, n, LABEL_CLEAR));
    const at = LABEL_FRACTIONS.map((f) => pointAt(e.points, f)).find((p) => clear(boxAt(p))) ?? e.labelAt;
    e.labelAt = at;
    placed.push(boxAt(at));
  }
}

// 兩個框 {x1,y1,x2,y2} 至少隔 gap（四個方向有一個夠遠就行）
function apart(b, p, gap) {
  return b.x1 >= p.x2 + gap || p.x1 >= b.x2 + gap || b.y1 >= p.y2 + gap || p.y1 >= b.y2 + gap;
}

// 折線全長的 frac 處的點
function pointAt(points, frac) {
  let total = 0;
  for (let k = 1; k < points.length; k++) total += Math.hypot(points[k][0] - points[k - 1][0], points[k][1] - points[k - 1][1]);
  let left = total * frac;
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1];
    const b = points[k];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > 0 && len >= left) {
      const t = left / len;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    left -= len;
  }
  return [points[0][0], points[0][1]];
}

function boundsOf(items, strokes = []) {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  const add = (x, y) => {
    x1 = Math.min(x1, x);
    y1 = Math.min(y1, y);
    x2 = Math.max(x2, x);
    y2 = Math.max(y2, y);
  };
  for (const it of items) {
    if (it.type === 'edge') {
      for (const p of it.points) add(p[0], p[1]);
    } else {
      add(it.x, it.y);
      add(it.x + it.w, it.y + it.h);
    }
  }
  for (const s of strokes) {
    const pad = (s.width ?? 2) / 2;
    const nums = (s.d.match(NUMBER) ?? []).map(Number);
    for (let k = 0; k + 1 < nums.length; k += 2) {
      add(nums[k] - pad, nums[k + 1] - pad);
      add(nums[k] + pad, nums[k + 1] + pad);
    }
  }
  if (x1 === Infinity) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function within(b, x, y) {
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

function nearLine(points, x, y) {
  let best = Infinity;
  for (let k = 1; k < points.length; k++) best = Math.min(best, segDist(points[k - 1], points[k], x, y));
  return best;
}

// 點 (x, y) 到線段 a–b 的距離；a、b 是 [x, y]，零長線段量到 a
export function segDist(a, b, x, y) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len2));
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}
