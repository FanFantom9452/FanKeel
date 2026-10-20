// 形狀元素：把顯示清單的每個項目變成與框架無關的元素描述（El），React 與 SVG 字串都從這裡畫。
// El = {tag: 'g'|'rect'|'ellipse'|'path'|'text'|'image', attrs, text?, html?, children?}；attrs 用 SVG 屬性名。
// html 只出現在 class 為 cr-icon 的 <g>：宿主 icons 解析器給的 SVG 片段，畫的一方原樣嵌入。
// 純函式：不 import React、不碰 DOM。
import { FONT_SIZE, LINE_HEIGHT, ICON_BOX, ICON_ROOM, approxMeasure } from './measure.js';

// 值取自 LevelMark/web/src/style.css：灰階與字型是 @theme（第 6 行起）；@theme 沒有強調色，
// accent 是同檔 :root 的 --accent-default（第 244 行），aiGlow 是 teal 的 --accent-default（第 252 行）。
export const DEFAULT_THEME = Object.freeze({
  bg: '#FFFFFF', // --color-white
  grid: '#E2E2E2', // --color-gray-300
  nodeFill: '#FFFFFF', // --color-white
  nodeStroke: '#888888', // --color-gray-400
  text: '#191919', // --color-gray-900
  mutedText: '#555555', // --color-gray-500
  labelText: '#37352F', // --color-text-secondary
  frameFill: '#FAFAFA', // --color-gray-50
  frameStroke: '#E2E2E2', // --color-gray-300
  edge: '#555555', // --color-gray-500
  accent: '#2383E2',
  aiGlow: '#0F7B6C',
  frameIcon: '#888888', // board.css 淺色主題的 --cr-text-4（LevelMark 的 --color-gray-400 同值）
  // --font-sans；CJK 後備與 board.css 的 --cr-font-sans 同序，否則中文落到另一套字型，600 粗細比拉丁字重
  font: "'Source Sans 3', 'Noto Sans TC', 'Microsoft JhengHei', 'PingFang TC', ui-sans-serif, system-ui, sans-serif",
});

const LABEL_SIZE = 12;
const SUB_SIZE = 12; // 節點副標字級；標題用 FONT_SIZE
const SUB_AFTER_TITLE = 18; // 標題基線到第一行副標基線，取自 mockup（64px 的節點：標題 29、副標 47）
const TITLE_DROP = 6; // 區塊中心到標題基線的距離（兩行時），同樣取自 mockup
export const EDGE_LABEL_SIZE = 12;
const ARROW_LEN = 10;
const ARROW_HALF = 5;
const HEAD_R = 4; // head:'circle' 的半徑
const CROSS_AT = 5; // head:'cross' 的中心離尖端多遠
const CROSS_ARM = 4.5; // head:'cross' 每條臂的半長

// 斜邊與缺角的寬：不超過高的一半、寬的四分之一，窄的節點也畫得出來
const slant = (w, h) => Math.min(h / 2, w / 4);
const poly = (attrs, pts) => ({ tag: 'path', attrs: { ...attrs, d: 'M ' + pts.map((p) => pt(p[0], p[1])).join(' L ') + ' Z' } });

// 多邊形節點的頂點：(x, y, w, h) 是外框，k 是 slant(w, h)
const POLYGONS = {
  hexagon: (x, y, w, h, k) => [[x + k, y], [x + w - k, y], [x + w, y + h / 2], [x + w - k, y + h], [x + k, y + h], [x, y + h / 2]],
  parallelogram: (x, y, w, h, k) => [[x + k, y], [x + w, y], [x + w - k, y + h], [x, y + h]],
  'parallelogram-alt': (x, y, w, h, k) => [[x, y], [x + w - k, y], [x + w, y + h], [x + k, y + h]],
  trapezoid: (x, y, w, h, k) => [[x + k, y], [x + w - k, y], [x + w, y + h], [x, y + h]],
  'trapezoid-alt': (x, y, w, h, k) => [[x, y], [x + w, y], [x + w - k, y + h], [x + k, y + h]],
  asymmetric: (x, y, w, h, k) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x + k, y + h / 2]],
};

const n = (v) => Math.round(v * 100) / 100;
const pt = (x, y) => `${n(x)} ${n(y)}`;

// res 由宿主解析：href 是 image 的圖片網址（null 畫虛線佔位框），iconSvg 是 icon 的 SVG 片段（null 不畫，但照樣讓位）
export function nodeElements(item, theme = DEFAULT_THEME, { href = null, iconSvg = null } = {}) {
  const { x, y, w, h } = item;
  const paint = { class: 'cr-shape', fill: item.fill ?? theme.nodeFill, stroke: item.stroke ?? theme.nodeStroke, 'stroke-width': item.strokeWidth ?? 1.25 };
  const k = slant(w, h);
  const out = [];
  let textDy = 0;
  switch (item.shape) {
    case 'round':
      out.push({ tag: 'rect', attrs: { ...paint, x, y, width: w, height: h, rx: 10 } });
      break;
    case 'ellipse':
      out.push({ tag: 'ellipse', attrs: { ...paint, cx: x + w / 2, cy: y + h / 2, rx: w / 2, ry: h / 2 } });
      break;
    case 'diamond':
      out.push({
        tag: 'path',
        attrs: { ...paint, d: `M ${pt(x + w / 2, y)} L ${pt(x + w, y + h / 2)} L ${pt(x + w / 2, y + h)} L ${pt(x, y + h / 2)} Z` },
      });
      break;
    case 'cylinder': {
      const ry = Math.min(12, h / 6);
      const arc = `A ${n(w / 2)} ${n(ry)} 0 0 0`;
      out.push({
        tag: 'path',
        attrs: { ...paint, d: `M ${pt(x, y + ry)} V ${n(y + h - ry)} ${arc} ${pt(x + w, y + h - ry)} V ${n(y + ry)} ${arc} ${pt(x, y + ry)} Z` },
      });
      out.push({ tag: 'path', attrs: { ...paint, fill: 'none', d: `M ${pt(x, y + ry)} ${arc} ${pt(x + w, y + ry)}` } });
      textDy = ry / 2;
      break;
    }
    case 'note': {
      const f = Math.min(12, w / 4, h / 4);
      out.push({ tag: 'path', attrs: { ...paint, d: `M ${pt(x, y)} H ${n(x + w - f)} L ${pt(x + w, y + f)} V ${n(y + h)} H ${n(x)} Z` } });
      out.push({ tag: 'path', attrs: { ...paint, fill: 'none', d: `M ${pt(x + w - f, y)} V ${n(y + f)} H ${n(x + w)}` } });
      break;
    }
    case 'text':
      out.push({ tag: 'rect', attrs: { class: 'cr-shape', x, y, width: w, height: h, fill: 'transparent', stroke: 'none' } });
      break;
    case 'stadium':
      out.push({ tag: 'rect', attrs: { ...paint, x, y, width: w, height: h, rx: Math.min(w, h) / 2 } });
      break;
    case 'subroutine':
      out.push({ tag: 'rect', attrs: { ...paint, x, y, width: w, height: h } });
      out.push({ tag: 'path', attrs: { ...paint, fill: 'none', d: `M ${pt(x + 8, y)} V ${n(y + h)} M ${pt(x + w - 8, y)} V ${n(y + h)}` } });
      break;
    case 'circle':
    case 'double-circle': {
      const r = Math.min(w, h) / 2;
      out.push({ tag: 'ellipse', attrs: { ...paint, cx: x + w / 2, cy: y + h / 2, rx: r, ry: r } });
      if (item.shape === 'double-circle') {
        const ri = Math.max(r - 4, 0);
        out.push({ tag: 'ellipse', attrs: { ...paint, fill: 'none', cx: x + w / 2, cy: y + h / 2, rx: ri, ry: ri } });
      }
      break;
    }
    case 'image':
      out.push(...imageElements(item, theme, href));
      break;
    default: // 多邊形查 POLYGONS；其餘是 rect（frame 正常走 frameElements，這裡只是保底）
      if (Object.hasOwn(POLYGONS, item.shape)) out.push(poly(paint, POLYGONS[item.shape](x, y, w, h, k)));
      else out.push({ tag: 'rect', attrs: { ...paint, x, y, width: w, height: h, rx: 6 } });
  }
  const lines = item.lines ?? String(item.label ?? '').split('\n');
  const bare = item.shape === 'text';
  const font = { fill: item.color ?? theme.text, 'font-weight': bare ? (item.weight === 'bold' ? 700 : 400) : 600, 'font-family': theme.font };
  if (item.shape === 'image') {
    // 圖說畫在框外下方：圖片佔滿整個框，壓在上面會蓋到內容
    const below = y + h + 6 + (lines.length * FONT_SIZE * LINE_HEIGHT) / 2;
    out.push(...textLines(lines, x + w / 2, below, FONT_SIZE, { ...font, 'font-weight': 400 }));
    return out;
  }
  if (typeof item.icon === 'string' && item.icon !== '') {
    textDy += ICON_ROOM / 2;
    if (iconSvg) {
      out.push({ tag: 'g', attrs: { class: 'cr-icon', 'data-icon': item.icon, transform: `translate(${pt(x + w / 2 - ICON_BOX / 2, y + 8)})` }, html: iconSvg });
    }
  }
  const cy = y + h / 2 + textDy;
  if (bare || lines.length < 2) out.push(...textLines(lines, x + w / 2, cy, bare && item.size > 0 ? item.size : FONT_SIZE, font));
  else out.push(...titleSubLines(lines, x + w / 2, cy, font, theme));
  return out;
}

export function frameElements(item, theme = DEFAULT_THEME) {
  const { x, y, w, h } = item;
  return [
    {
      tag: 'rect',
      attrs: { class: 'cr-frame', x, y, width: w, height: h, rx: 8, fill: item.fill ?? theme.frameFill, stroke: item.stroke ?? theme.frameStroke, 'stroke-width': item.strokeWidth ?? 1 },
    },
    {
      tag: 'path',
      attrs: {
        class: 'cr-frame-icon',
        d: `M ${pt(x + 14, y + 12)} h12 M ${pt(x + 14, y + 20)} h12 M ${pt(x + 17, y + 9)} v14 M ${pt(x + 23, y + 9)} v14`,
        fill: 'none',
        stroke: theme.frameIcon,
        'stroke-width': 1.5,
        'stroke-linecap': 'round',
      },
    },
    {
      tag: 'text',
      attrs: { class: 'cr-frame-label', x: n(x + 34), y: n(y + 20), fill: theme.mutedText, 'font-size': LABEL_SIZE, 'font-weight': 600, 'font-family': theme.font },
      text: String(item.label).split('\n')[0],
    },
  ];
}

// 線與箭頭加上標籤：Overlay 拖曳預覽用；Board 與 toSVG 把標籤另外畫在所有線之上
export function edgeElements(item, theme = DEFAULT_THEME) {
  return edgeLineElements(item, theme).concat(edgeLabelElements(item, theme));
}

export function edgeLineElements(item, theme = DEFAULT_THEME) {
  const color = item.stroke ?? theme.edge;
  const pts = item.points;
  const line = {
    class: 'cr-edge',
    d: 'M ' + pts.map((p) => pt(p[0], p[1])).join(' L '),
    fill: 'none',
    stroke: color,
    'stroke-width': item.strokeWidth ?? 1.5,
    'stroke-linejoin': 'round',
  };
  if (item.dash) line['stroke-dasharray'] = '6 4';
  const out = [{ tag: 'path', attrs: line }];
  const head = item.head ?? 'arrow';
  if (item.arrow === 'end' || item.arrow === 'both') out.push(headElement(head, pts[pts.length - 1], pts[pts.length - 2], color));
  if (item.arrow === 'both') out.push(headElement(head, pts[0], pts[1], color));
  return out;
}

// 連線標籤底框的大小：edgeLabelElements 畫的與 scene() 避讓用的是同一個，不會各算各的。
// 單行 22（t.h 16.8 + 5 還不到），多行（Shift+Enter）跟著長
export function labelPillSize(item) {
  const t = item.labelSize ?? approxMeasure(item.label, EDGE_LABEL_SIZE);
  return { w: t.w + 16, h: Math.max(22, t.h + 5) };
}

// glow：AI 動過的連線，標籤改用 aiGlow 的框與字（mockup 的 .edge-label.ai-touched）
export function edgeLabelElements(item, theme = DEFAULT_THEME, { glow = false } = {}) {
  if (!item.label) return [];
  const { w: bw, h: bh } = labelPillSize(item);
  const [lx, ly] = item.labelAt;
  const font = { fill: glow ? theme.aiGlow : theme.labelText, 'font-weight': glow ? 600 : 500, 'font-family': theme.font };
  return [
    {
      tag: 'rect',
      attrs: { class: 'cr-edge-label', x: n(lx - bw / 2), y: n(ly - bh / 2), width: n(bw), height: n(bh), rx: 4, fill: theme.bg, stroke: glow ? theme.aiGlow : theme.frameStroke, 'stroke-width': 1 },
    },
    ...textLines(item.label.split('\n'), lx, ly, EDGE_LABEL_SIZE, font),
  ];
}

export function badgeElements(item, theme = DEFAULT_THEME) {
  if (!item.detail) return [];
  return [
    {
      tag: 'g',
      attrs: { class: 'cr-badge', 'data-badge': item.id, transform: `translate(${pt(item.x + item.w - 20, item.y + 20)})` },
      children: [
        { tag: 'ellipse', attrs: { cx: 0, cy: 0, rx: 10, ry: 10, fill: theme.accent } },
        {
          tag: 'path',
          attrs: { d: 'M -2 -4.5 L 2.5 0 L -2 4.5', fill: 'none', stroke: '#FFFFFF', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
        },
      ],
    },
  ];
}

export function reactAttrs(attrs) {
  const out = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') out.className = v;
    else if (k.startsWith('data-') || k.startsWith('aria-')) out[k] = v;
    else out[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  }
  return out;
}

// 多行文字：一行一個 text，以 (cx, cy) 為中心、行距 1.4；0.35em 是基線到字身中線的距離
function textLines(lines, cx, cy, size, attrs) {
  const lh = size * LINE_HEIGHT;
  const top = cy - ((lines.length - 1) * lh) / 2 + size * 0.35;
  return lines.map((line, k) => ({
    tag: 'text',
    attrs: { class: 'cr-label', x: n(cx), y: n(top + k * lh), 'text-anchor': 'middle', 'font-size': size, ...attrs },
    text: line,
  }));
}

// 標題加副標：第一行 14px/600，其餘 12px/400 淡色；基線距離與整塊的垂直置中取自 mockup
function titleSubLines(lines, cx, cy, titleAttrs, theme) {
  const sub = { fill: theme.mutedText, 'font-weight': 400, 'font-family': theme.font };
  let y = cy - (SUB_AFTER_TITLE + (lines.length - 2) * SUB_SIZE * LINE_HEIGHT) / 2 + TITLE_DROP;
  return lines.map((line, k) => {
    if (k === 1) y += SUB_AFTER_TITLE;
    else if (k > 1) y += SUB_SIZE * LINE_HEIGHT;
    return {
      tag: 'text',
      attrs: { class: 'cr-label', x: n(cx), y: n(y), 'text-anchor': 'middle', 'font-size': k ? SUB_SIZE : FONT_SIZE, ...(k ? sub : titleAttrs) },
      text: line,
    };
  });
}

// 連線端點：arrow 是尖端在 tip 的實心三角形，circle 是貼著 tip 的實心圓，cross 是中心離 tip CROSS_AT 的 ×
function headElement(head, tip, from, color) {
  const dx = tip[0] - from[0];
  const dy = tip[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  if (head === 'circle') {
    return {
      tag: 'ellipse',
      attrs: { class: 'cr-arrow', cx: n(tip[0] - ux * HEAD_R), cy: n(tip[1] - uy * HEAD_R), rx: HEAD_R, ry: HEAD_R, fill: color, stroke: 'none' },
    };
  }
  if (head === 'cross') {
    const cx = tip[0] - ux * CROSS_AT;
    const cy = tip[1] - uy * CROSS_AT;
    const s = CROSS_ARM / Math.SQRT2; // 兩條臂與線各成 45°
    const arm1 = [(ux - uy) * s, (uy + ux) * s];
    const arm2 = [(ux + uy) * s, (uy - ux) * s];
    return {
      tag: 'path',
      attrs: {
        class: 'cr-arrow',
        d: `M ${pt(cx - arm1[0], cy - arm1[1])} L ${pt(cx + arm1[0], cy + arm1[1])} M ${pt(cx - arm2[0], cy - arm2[1])} L ${pt(cx + arm2[0], cy + arm2[1])}`,
        fill: 'none',
        stroke: color,
        'stroke-width': 2,
        'stroke-linecap': 'round',
      },
    };
  }
  const bx = tip[0] - ux * ARROW_LEN;
  const by = tip[1] - uy * ARROW_LEN;
  const px = -uy * ARROW_HALF;
  const py = ux * ARROW_HALF;
  return {
    tag: 'path',
    attrs: { class: 'cr-arrow', d: `M ${pt(tip[0], tip[1])} L ${pt(bx + px, by + py)} L ${pt(bx - px, by - py)} Z`, fill: color, stroke: 'none' },
  };
}

// 一個顯示清單項目的全部元素：框畫框、連線畫線（標籤另外畫）、筆畫畫路徑、其餘畫節點再接鑽入標記（沒有 detail 時是空的）。
// 匯出的 SVG、畫布與拖曳預覽都從這裡分派；res（{ href, iconSvg }）只給節點用
export function itemElements(item, theme = DEFAULT_THEME, res = {}) {
  if (item.type === 'frame') return frameElements(item, theme);
  if (item.type === 'edge') return edgeLineElements(item, theme);
  if (item.type === 'stroke') return strokeElements(item, theme);
  return nodeElements(item, theme, res).concat(badgeElements(item, theme));
}

// image：解析得到網址就畫圖片；否則是虛線佔位框加一座山一顆太陽（同 LevelMark topology-render.js 的 imageGlyph）
function imageElements(item, theme, href) {
  const { x, y, w, h } = item;
  if (href) {
    return [{ tag: 'image', attrs: { class: 'cr-image', href, x, y, width: w, height: h, preserveAspectRatio: 'xMidYMid meet' } }];
  }
  const color = item.stroke ?? theme.nodeStroke;
  const r = Math.min(w, h) * 0.28;
  const gx = x + w / 2 - r;
  const gy = y + h / 2 - r * 0.75;
  return [
    { tag: 'rect', attrs: { class: 'cr-shape', x, y, width: w, height: h, rx: 8, fill: 'none', stroke: color, 'stroke-width': item.strokeWidth ?? 1, 'stroke-dasharray': '6 4' } },
    {
      tag: 'path',
      attrs: {
        class: 'cr-image-glyph',
        d: `M ${pt(gx, gy)} H ${n(gx + 2 * r)} V ${n(gy + 1.5 * r)} H ${n(gx)} Z M ${pt(gx, gy + 1.5 * r)} L ${pt(gx + 0.8 * r, gy + 0.675 * r)} L ${pt(gx + 2 * r, gy + 1.5 * r)}`,
        fill: 'none',
        stroke: color,
        'stroke-width': 1.5,
        'stroke-linejoin': 'round',
      },
    },
    { tag: 'ellipse', attrs: { class: 'cr-image-glyph', cx: n(gx + 0.56 * r), cy: n(gy + 0.45 * r), rx: n(0.16 * r), ry: n(0.16 * r), fill: color, stroke: 'none' } },
  ];
}

// 保留筆：一條圓頭的路徑；沒寫色用主題的 accent，沒寫寬是 2（同 LevelMark clampStrokeWidth 的預設）
export function strokeElements(item, theme = DEFAULT_THEME) {
  return [{
    tag: 'path',
    attrs: { class: 'cr-ink', d: item.d, fill: 'none', stroke: item.color ?? theme.accent, 'stroke-width': item.width ?? 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
  }];
}
