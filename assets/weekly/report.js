// The weekly report's filters (docs/90-agent/plans/2026-10-30-weekly-facets-design.md
// §2; from the mockup's src/new.js): the 一般／技術 switch in the header and the
// facet chips over 做了哪些事. lib/weekly-render.js inlines this file after
// </main>. Without it report.css keeps the bar and the switch hidden and
// every card and its technical detail open, so a mail client that strips
// scripts still shows the whole report.
(function () {
    var page = document.querySelector('main.page');
    if (!page) return;
    document.documentElement.classList.add('js');
    var bar = page.querySelector('.facet-bar');
    var cards = [].slice.call(page.querySelectorAll('.event'));
    var AUD = {};
    [].forEach.call(page.querySelectorAll('.fchip[data-facet][data-aud]'), function (chip) {
        AUD[chip.getAttribute('data-facet')] = chip.getAttribute('data-aud');
    });
    var NAME = { gen: '一般', tech: '技術' };
    var state = { aud: 'gen', facet: 'all' };
    function facetsOf(c) { return (c.getAttribute('data-facets') || '').split(' ').filter(Boolean); }
    function fits(f, aud) { return AUD[f] === 'both' || AUD[f] === aud; }
    function apply() {
        page.setAttribute('data-aud', state.aud);
        [].forEach.call(page.querySelectorAll('.seg button'), function (b) {
            b.setAttribute('aria-pressed', String(b.getAttribute('data-aud') === state.aud));
        });
        var inAud = cards.filter(function (c) { return facetsOf(c).some(function (f) { return fits(f, state.aud); }); });
        if (bar) {
            // a chip this audience does not read is hidden; a hidden selection falls back to 全部
            [].forEach.call(bar.querySelectorAll('.fchip[data-facet]'), function (chip) {
                var f = chip.getAttribute('data-facet');
                var n = f === 'all' ? inAud.length : inAud.filter(function (c) { return facetsOf(c).indexOf(f) >= 0; }).length;
                chip.querySelector('.n').textContent = n;
                chip.hidden = f !== 'all' && (!fits(f, state.aud) || n === 0);
                if (chip.hidden && state.facet === f) state.facet = 'all';
            });
            [].forEach.call(bar.querySelectorAll('.fgroup'), function (g) {
                g.hidden = !g.querySelector('.fchip:not([hidden])');
            });
            [].forEach.call(bar.querySelectorAll('.fchip[data-facet]'), function (chip) {
                chip.setAttribute('aria-pressed', String(chip.getAttribute('data-facet') === state.facet));
            });
        }
        var shown = 0;
        cards.forEach(function (c) {
            var ok = inAud.indexOf(c) >= 0 && (state.facet === 'all' || facetsOf(c).indexOf(state.facet) >= 0);
            c.hidden = !ok;
            if (ok) shown++;
        });
        // each group's own count: 已完成 and 進行中 are two grids
        [].forEach.call(page.querySelectorAll('.event-grid'), function (grid) {
            var head = grid.previousElementSibling;
            var count = head && head.classList.contains('group-h') ? head.querySelector('.count') : null;
            if (count) count.textContent = grid.querySelectorAll('.event:not([hidden])').length;
        });
        if (bar) bar.querySelector('.fb-status').textContent = '「' + NAME[state.aud] + '」顯示 ' + shown + ' 件，共 ' + cards.length + ' 件';
    }
    page.addEventListener('click', function (e) {
        var seg = e.target.closest('.seg button');
        var chip = e.target.closest('.fchip');
        if (seg) { state.aud = seg.getAttribute('data-aud'); apply(); }
        if (chip) { state.facet = chip.getAttribute('data-facet'); apply(); }
    });
    apply();
})();
