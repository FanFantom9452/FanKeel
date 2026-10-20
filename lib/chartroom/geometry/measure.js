// 文字尺寸。measure 由外部注入（瀏覽器用 canvas measureText）；這裡是 Node 也能跑的近似值。
// 不 import React、不碰 DOM。

export const FONT_SIZE = 14;
export const LINE_HEIGHT = 1.4;
// 宿主 icons 解析器畫圖示的方框是 24×24（toSVG 的契約）；ICON_ROOM 再加上圖示與標題之間的 8
export const ICON_BOX = 24;
export const ICON_ROOM = ICON_BOX + 8;
// 沒寫尺寸的 image 節點：4:3，同 LevelMark web/src/lib/mermaid-label-measure.js 的 IMAGE_DEFAULT_W/H
export const IMAGE_SIZE = Object.freeze({ w: 240, h: 180 });
const ROUND = new Set(['circle', 'double-circle']);
// 鑽入標記（shapes.js 的 badgeElements）佔節點右緣內 30 到 10；標籤置中，兩側各留 BADGE_ROOM（含 4 的空隙）
const BADGE_ROOM = 34;
const CJK = /[\u2E80-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF]/;

// 中日韓與全形字寬 1em，其他 0.6em；多行取最寬的一行
export function approxMeasure(text, fontSize = FONT_SIZE) {
  const lines = String(text).split('\n');
  let w = 0;
  for (const line of lines) {
    let lw = 0;
    for (const ch of line) lw += CJK.test(ch) ? fontSize : fontSize * 0.6;
    w = Math.max(w, lw);
  }
  return { w, h: lines.length * fontSize * LINE_HEIGHT };
}

export function isPlaced(rec) {
  return typeof rec.x === 'number' && typeof rec.y === 'number';
}

// 有 w,h 就用。image 沒寫的那一邊用 IMAGE_SIZE；其餘由標籤（沒有就用 id）算出，最小 80×40，
// shape:'text' 不設最小值、用自己的 size 量。有 icon 又沒寫 h 的多長 ICON_ROOM；
// circle、double-circle 兩邊都沒寫時取較長的一邊成正方形；有 detail 又沒寫 w 的，標籤兩側各讓出鑽入標記的位置；
// diamond 沒寫 w、h 的那一邊取標籤矩形的兩倍再加邊距（外接菱形：|x|/(w/2) + |y|/(h/2) ≤ 1，標籤四角落在內側；有 detail 時寬度仍不小於 t.w + 2 * BADGE_ROOM）
export function nodeSize(rec, measure = approxMeasure) {
  const hasW = typeof rec.w === 'number';
  const hasH = typeof rec.h === 'number';
  if (hasW && hasH) return { w: rec.w, h: rec.h };
  if (rec.shape === 'image') return { w: hasW ? rec.w : IMAGE_SIZE.w, h: hasH ? rec.h : IMAGE_SIZE.h };
  const bare = rec.shape === 'text';
  const size = bare && typeof rec.size === 'number' && rec.size > 0 ? rec.size : FONT_SIZE;
  const t = measure(typeof rec.label === 'string' ? rec.label : rec.id, size);
  const diamond = rec.shape === 'diamond';
  const padW = rec.detail ? 2 * BADGE_ROOM : 24;
  let w = hasW ? rec.w : bare ? t.w + 24 : Math.max(80, t.w + padW, diamond ? 2 * t.w + 24 : 0);
  let h = hasH ? rec.h : bare ? t.h + 16 : Math.max(40, diamond ? 2 * t.h + 16 : t.h + 16);
  if (!hasH && typeof rec.icon === 'string' && rec.icon !== '') h += ICON_ROOM;
  if (ROUND.has(rec.shape) && !hasW && !hasH) {
    w = Math.max(w, h);
    h = w;
  }
  return { w, h };
}
