// 清單's shared state (FK_LIST): the selected row, the sort, the sessions
// ticked for 比較 and which station/detail/<id>.js scripts were asked for.
// station.js's list page, its detail panel, the session page and the 3 s
// poll read and write them here (station-52), so the list page can leave
// station.js later without carrying its closure along. Touches no element
// and adds no listener at load.
(function (w, doc) {
    'use strict';
    // `asked[id]` is 'loading', 'loaded' or 'failed'; a session never asked has none.
    var asked = {};
    // The same object every station/detail/<id>.js script writes into
    // (lib/station.js serializeDetail), so a detail the poll re-read is here too.
    var details = w ? (w.STATION_DETAIL || (w.STATION_DETAIL = {})) : {};
    var api = {
        sel: null,
        sortKey: 'updated',
        sortDir: -1,
        // The sessions ticked for 比較, oldest tick first; a third tick drops the first.
        picked: [],
        details: details,
        // A click on header cell `k`: the same column flips; a new one starts
        // ascending for 任務 and descending for the rest.
        sortBy: function (k) {
            if (k === api.sortKey) api.sortDir = -api.sortDir;
            else { api.sortKey = k; api.sortDir = k === 'task' ? 1 : -1; }
        },
        tick: function (id, on) {
            api.picked = api.picked.filter(function (x) { return x !== id; });
            if (on) api.picked.push(id);
            if (api.picked.length > 2) api.picked.shift();
        },
        status: function (id) { return asked[id] || null; },
        // One session's detail is a script of its own, loaded the first time
        // it is opened; `redraw` runs when it lands or fails.
        need: function (s, redraw) {
            if (!s || !s.hasDetail || details[s.id] || asked[s.id] || !doc) return;
            asked[s.id] = 'loading';
            var el = doc.createElement('script');
            el.src = 'station/detail/' + encodeURIComponent(s.id) + '.js';
            el.onload = function () { asked[s.id] = 'loaded'; if (redraw) redraw(); };
            el.onerror = function () { asked[s.id] = 'failed'; if (redraw) redraw(); };
            doc.head.appendChild(el);
        }
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_LIST = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
