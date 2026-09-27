// assets/station/tour-player.js — the tour page's controller: the scrub bar
// with a marker per beat, keys, playback, and window.tour for
// scripts/tour-record.js. Every picture comes from tourEngine.render; this
// file only decides which frame. Playback maps wall-clock time to a frame
// number; the frame drawn is still a pure function of that number. Nothing
// plays by itself: the page opens paused, reduced motion or not. One
// timeline only (`stages`, the promo) — no chapter chips.
(function () {
    'use strict';
    var E = window.tourEngine;
    var PLAY_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z" fill="currentColor"></path></svg>';
    var PAUSE_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor"></path></svg>';
    function q(id) { return document.getElementById(id); }
    var cv = q('trCanvas'), ctx = cv.getContext('2d'), scrub = q('trScrub'), play = q('trPlay');
    var rec = /(?:^|[?&])record(?:[=&]|$)/.test(location.search.slice(1));
    if (rec) document.body.classList.add('rec');
    var css = getComputedStyle(document.documentElement);
    var P = E.palette(function (k) { return css.getPropertyValue('--' + k).trim(); });
    var name = 'stages', frame = 0, playing = false, t0 = 0, f0 = 0;

    function paint() {
        var tl = E.get(name), n = tl.length, b = E.beatAt(tl, frame);
        E.render(ctx, name, frame, { palette: P, blur: rec });
        scrub.style.setProperty('--p', (frame / (n - 1)).toFixed(4));
        scrub.setAttribute('aria-valuemax', String(n - 1));
        scrub.setAttribute('aria-valuenow', String(frame));
        scrub.setAttribute('aria-valuetext', E.clock(frame) + (b >= 0 ? '，' + tl.beats[b].label : ''));
        q('trTime').innerHTML = '<b>' + E.clock(frame) + '</b> / ' + E.clock(n);
        q('trFno').textContent = 'f ' + frame + ' / ' + n + ' · ' + E.FPS + ' fps';
    }
    function seek(f) {
        frame = Math.max(0, Math.min(E.length(name) - 1, Math.round(f)));
        paint();
    }
    function marks() {
        var old = scrub.querySelectorAll('.tr-mk');
        for (var i = 0; i < old.length; i++) old[i].remove();
        var tl = E.get(name), thumb = scrub.querySelector('.tr-thumb');
        tl.beats.forEach(function (b) {
            var m = document.createElement('button');
            m.type = 'button';
            m.className = 'tr-mk';
            m.style.setProperty('--at', (b.at / (tl.length - 1)).toFixed(4));
            if (b.stage) m.style.setProperty('--c', 'var(--st-' + b.stage + ')');
            m.dataset.f = String(b.at);
            m.innerHTML = '<span>' + b.label + '</span>';
            scrub.insertBefore(m, thumb);
        });
    }
    function stop() {
        playing = false;
        play.setAttribute('aria-pressed', 'false');
        play.setAttribute('aria-label', '播放');
        play.innerHTML = PLAY_SVG;
    }
    function step(now) {
        if (!playing) return;
        var last = E.length(name) - 1, f = f0 + Math.floor((now - t0) * E.FPS / 1000);
        if (f >= last) { seek(last); stop(); return; }
        seek(f);
        requestAnimationFrame(step);
    }
    function start() {
        if (frame >= E.length(name) - 1) seek(0);
        playing = true;
        t0 = performance.now();
        f0 = frame;
        play.setAttribute('aria-pressed', 'true');
        play.setAttribute('aria-label', '暫停');
        play.innerHTML = PAUSE_SVG;
        requestAnimationFrame(step);
    }
    function toggle() { if (playing) stop(); else start(); }

    play.addEventListener('click', toggle);
    scrub.addEventListener('click', function (e) {
        stop();
        var mk = e.target.closest('.tr-mk');
        if (mk) { seek(Number(mk.dataset.f)); return; }
        var r = scrub.getBoundingClientRect();
        seek((e.clientX - r.left) / r.width * (E.length(name) - 1));
    });
    // Space toggles wherever focus is; keyup's default is cancelled so a
    // focused button is not clicked a second time by the same key.
    document.addEventListener('keydown', function (e) {
        if (e.key === ' ') { e.preventDefault(); toggle(); return; }
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        stop();
        var dir = e.key === 'ArrowRight' ? 1 : -1;
        seek(e.shiftKey ? E.stepBeat(E.get(name), frame, dir) : frame + dir);
    });
    document.addEventListener('keyup', function (e) { if (e.key === ' ') e.preventDefault(); });

    marks();
    var m = /^#stages@(\d+)$/.exec(location.hash);
    seek(m ? Number(m[1]) : 0);

    window.tour = { seek: seek, length: function (n) { return E.length(n); }, ready: false };
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
        paint();
        window.tour.ready = true;
        cv.dataset.ready = 'true';
    });
})();
