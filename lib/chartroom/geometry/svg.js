// SVG 字串：把同一份顯示清單畫成獨立可開的 <svg>。CLI 與瀏覽器的匯出都用它。
// 純函式：不 import React、不碰 DOM。
import { DEFAULT_THEME, itemElements, edgeLabelElements, strokeElements } from './shapes.js';

const XMLNS = 'http://www.w3.org/2000/svg';

// icons(iconId) → 畫在 24×24 方框裡的 SVG 片段或 null；片段原樣嵌入，宿主只能回傳自己圖示集裡的東西。
// images(src) → 圖片的 href 或 null；null（或沒給 images）畫虛線佔位框。
export function toSVG(sc, theme = DEFAULT_THEME, { padding = 24, icons, images } = {}) {
  const b = sc.bounds;
  const x = num(b.x - padding);
  const y = num(b.y - padding);
  const w = num(b.w + padding * 2);
  const h = num(b.h + padding * 2);
  const out = [
    `<svg xmlns="${XMLNS}" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}" font-family="${esc(theme.font)}">`,
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${esc(theme.bg)}"/>`,
  ];
  const resolve = (it) => ({
    href: it.type === 'node' && it.shape === 'image' && it.src && images ? images(it.src) : null,
    iconSvg: it.type === 'node' && it.icon && icons ? icons(it.icon) : null,
  });
  const items = sc.items.map((it) => {
    const els = itemElements(it, theme, resolve(it));
    return `<g data-id="${esc(it.id)}" data-type="${esc(it.type)}">${els.map(elString).join('')}</g>`;
  });
  // 標籤畫在所有線之上、節點之下（scene 的順序是框、線、形狀，所以插在最後一條線後面）；
  // data-label-for 不是 data-id，一個項目在檔案裡仍只有一個 data-id
  const labels = [];
  for (const it of sc.items) {
    if (it.type !== 'edge') continue;
    const els = edgeLabelElements(it, theme);
    if (els.length) labels.push(`<g data-label-for="${esc(it.id)}">${els.map(elString).join('')}</g>`);
  }
  // 筆畫畫在最上層；用 data-stroke 不用 data-id，data-id 的數量仍等於 node 加 edge 紀錄數
  const strokes = (sc.strokes ?? []).map((s) => `<g data-stroke="${esc(s.id)}">${strokeElements(s, theme).map(elString).join('')}</g>`);
  const at = sc.items.findLastIndex((it) => it.type === 'edge') + 1;
  out.push(...items.slice(0, at), ...labels, ...items.slice(at), ...strokes);
  out.push('</svg>');
  return out.join('\n') + '\n';
}

// html 是宿主 icons 解析器給的 SVG 片段，原樣輸出；其餘文字與屬性一律跳脫
function elString(el) {
  let s = '<' + el.tag;
  for (const [k, v] of Object.entries(el.attrs ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    s += ` ${k}="${esc(typeof v === 'number' ? num(v) : v)}"`;
  }
  const inner = (el.text !== undefined ? esc(el.text) : '') + (el.html ?? '') + (el.children ?? []).map(elString).join('');
  return inner === '' ? s + '/>' : `${s}>${inner}</${el.tag}>`;
}

function num(v) {
  return String(Math.round(v * 100) / 100);
}

function esc(v) {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
