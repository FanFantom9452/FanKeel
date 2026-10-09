'use strict';
// The first item with the id, or null.
function find(items, id) {
    for (const item of items) if (item.id === id) return item;
    return null;
}

exports.find = find;
