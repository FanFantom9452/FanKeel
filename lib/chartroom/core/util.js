// core 內部共用的小工具；不從 index.js 匯出。

// 以定義屬性寫入：名為 __proto__ 的未知 key 會成為普通的自有屬性，不會改到原型。
export function put(obj, key, value) {
  Object.defineProperty(obj, key, { value, enumerable: true, writable: true, configurable: true });
}

export function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
