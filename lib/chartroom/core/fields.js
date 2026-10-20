// Chartroom 唯一的欄位表。format、validate、ops、context 與 JSON Schema 都從這裡讀。
// 物件 key 的順序就是 .board 每一行的序列化順序；新欄位一律接在舊欄位後面，沒用到新欄位的舊檔案逐位元不變。

export const KINDS = Object.freeze(['view', 'node', 'edge', 'stroke']);

// 前 8 種是原本的；之後是 LevelMark canvas 的圖片，與 mermaid flowchart 每一種節點形狀的對應
export const SHAPES = Object.freeze([
  'rect', 'round', 'ellipse', 'diamond', 'cylinder', 'note', 'text', 'frame',
  'image', 'stadium', 'subroutine', 'hexagon', 'parallelogram', 'parallelogram-alt',
  'trapezoid', 'trapezoid-alt', 'circle', 'double-circle', 'asymmetric',
]);

export const ARROWS = Object.freeze(['none', 'end', 'both']);

// 連線端點的樣子，畫在 arrow 標出的那一端或兩端
export const HEADS = Object.freeze(['arrow', 'circle', 'cross']);

// shape:'text' 的字重
export const WEIGHTS = Object.freeze(['normal', 'bold']);

// view 裡未擺放節點的自動排版方向
export const DIRS = Object.freeze(['LR', 'TB']);

// 保留筆的上限，沿用 LevelMark web/src/lib/mermaid-stroke-validator.js：寬 0.5–20、d ≤ 64 KB、#RRGGBB
export const STROKE_LIMITS = Object.freeze({ minWidth: 0.5, maxWidth: 20, maxPath: 65536, hex: '^#[0-9a-fA-F]{6}$', path: '^M[MLQC0-9eE.+,\\s-]*$' });

const HEX = new RegExp(STROKE_LIMITS.hex);
// 只收絕對座標的 M/L/Q/C：geometry 的 boundsOf 只讀這幾種，其他指令（H、V、A、小寫相對）會讓邊界算錯
const PATH = new RegExp(STROKE_LIMITS.path);

export const FIELDS = Object.freeze({
  view: Object.freeze({
    title: 'string',
    dir: 'dir',
  }),
  node: Object.freeze({
    in: 'view',
    label: 'string',
    shape: 'shape',
    x: 'number',
    y: 'number',
    w: 'number',
    h: 'number',
    frame: 'node',
    detail: 'view',
    fill: 'string',
    stroke: 'string',
    color: 'string',
    note: 'string',
    icon: 'string', // 宿主的圖示 id（例如 hw:server），怎麼畫由宿主的 icons 解析器決定
    src: 'string', // shape:'image' 的圖片路徑，怎麼取圖由宿主的 images 解析器決定
    size: 'number', // shape:'text' 的字級（px）
    weight: 'weight', // shape:'text' 的字重
    strokeWidth: 'number',
  }),
  edge: Object.freeze({
    in: 'view',
    from: 'node',
    to: 'node',
    label: 'string',
    stroke: 'string',
    dash: 'boolean',
    arrow: 'arrow',
    head: 'head',
    strokeWidth: 'number',
    points: 'points', // 使用者拖出的折點 [[x,y],…]，座標系同所在 view
  }),
  stroke: Object.freeze({
    in: 'view',
    d: 'path',
    color: 'hex',
    width: 'width',
  }),
});

export const REQUIRED = Object.freeze({
  view: Object.freeze([]),
  node: Object.freeze(['in']),
  edge: Object.freeze(['in', 'from', 'to']),
  stroke: Object.freeze(['in', 'd']),
});

export const GEOMETRY_FIELDS = Object.freeze(['x', 'y', 'w', 'h']);

export const STYLE_FIELDS = Object.freeze(['fill', 'stroke', 'color']);

export function fieldOrder(kind) {
  if (!Object.hasOwn(FIELDS, kind)) throw new Error('unknown kind: ' + kind);
  return Object.keys(FIELDS[kind]);
}

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isPair = (p) => Array.isArray(p) && p.length === 2 && isNumber(p[0]) && isNumber(p[1]);

// 'view'／'node' 是參照：這裡只看是不是非空字串，指向的東西存不存在由 validateDoc 判斷。
export function checkValue(type, value) {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return isNumber(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'shape':
      return SHAPES.includes(value);
    case 'arrow':
      return ARROWS.includes(value);
    case 'head':
      return HEADS.includes(value);
    case 'weight':
      return WEIGHTS.includes(value);
    case 'dir':
      return DIRS.includes(value);
    case 'points':
      return Array.isArray(value) && value.length > 0 && value.every(isPair);
    case 'path':
      return typeof value === 'string' && value !== '' && value.length <= STROKE_LIMITS.maxPath && PATH.test(value);
    case 'hex':
      return typeof value === 'string' && HEX.test(value);
    case 'width':
      return isNumber(value) && value >= STROKE_LIMITS.minWidth && value <= STROKE_LIMITS.maxWidth;
    case 'view':
    case 'node':
      return typeof value === 'string' && value !== '';
    default:
      return false;
  }
}
