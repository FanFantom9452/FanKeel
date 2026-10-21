'use strict';
// assets/station/tip.js — the one tooltip every chart on the redesigned
// station pages shares (docs/99-archive/2026-10-21-station-redesign-design.md,
// "Rules every redesigned page keeps"; mockup _sess/r59-tip.js). A mark
// carries its own label and at most two values, written into its tag by
// `attr()`; one `.fk-tip` box shows them on hover and on keyboard focus and
// hides on leave, blur or Esc. The box gets escaped text only. Loaded before
// station.js with the other modules; it binds its listeners once, when it is
// first loaded with a document.
(function (w, doc) {
    var SEP = '\u241f';
    var ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ENT[c]; }); }
    function valuesOf(values) {
        return (values || []).filter(function (v) { return v !== undefined && v !== null && v !== ''; }).slice(0, 2).map(String);
    }
    // To splice into a mark's opening tag. A third value is dropped: a tip
    // says what its own segment is and that segment's figures, nothing more.
    function attr(label, values) {
        var v = valuesOf(values);
        return ' tabindex="0" data-tip="' + esc(label) + '"' + (v.length ? ' data-tip-v="' + esc(v.join(SEP)) + '"' : '')
            + ' aria-label="' + esc([String(label)].concat(v).join(' · ')) + '"';
    }

    var box = null, on = null, bound = false;
    function boxOf() {
        if (!box) {
            box = doc.createElement('div');
            box.className = 'fk-tip';
            box.setAttribute('role', 'tooltip');
            box.hidden = true;
            doc.body.appendChild(box);
        }
        return box;
    }
    function markOf(t) { return t && typeof t.closest === 'function' ? t.closest('[data-tip]') : null; }
    function show(el) {
        var b = boxOf(), v = String(el.getAttribute('data-tip-v') || '');
        b.innerHTML = '<b>' + esc(el.getAttribute('data-tip')) + '</b>'
            + (v ? v.split(SEP).map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') : '');
        var r = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : { left: 0, top: 0, width: 0 };
        b.style.left = Math.round(r.left + r.width / 2 + ((w && w.scrollX) || 0)) + 'px';
        b.style.top = Math.round(r.top + ((w && w.scrollY) || 0)) + 'px';
        b.hidden = false;
        on = el;
    }
    function hide() {
        if (box) box.hidden = true;
        on = null;
    }
    function init() {
        if (bound || !doc || typeof doc.addEventListener !== 'function') return;
        bound = true;
        doc.addEventListener('mouseover', function (e) {
            var m = markOf(e.target);
            if (m && m !== on) show(m);
        });
        doc.addEventListener('mouseout', function (e) {
            if (on && markOf(e.target) === on && markOf(e.relatedTarget) !== on) hide();
        });
        doc.addEventListener('focusin', function (e) {
            var m = markOf(e.target);
            if (m) show(m);
        });
        doc.addEventListener('focusout', function (e) {
            if (on && markOf(e.target) === on) hide();
        });
        doc.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && on) hide();
        });
    }
    init();

    var api = { attr: attr, show: show, hide: hide, init: init, SEP: SEP };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_TIP = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
