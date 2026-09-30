// assets/station/tour-player.js — the tour page's controller: the scrub bar
// with a marker per beat, keys, playback with its score, the mute button,
// and window.tour for scripts/tour-record.js. Every picture comes from
// tourEngine.render; this file only decides which frame, and in which
// language: `?lang=zh|en` when the url says, else the station's own
// (FK_I18N.lang, from i18n.js), else zh. Nothing plays by itself: the page
// opens paused, and the sound is made on the first press of play — the
// click a browser's autoplay rule asks for. While the sound runs, the frame
// follows the audio clock, so picture and sound cannot drift apart; a pause
// or a seek stops the sound, and play starts it again at the frame shown.
// `?record` strips the page to the canvas with no sound; `?check` measures
// every string of every fifth frame with the real fonts and writes what did
// not fit onto the canvas as data-overflow.
(function () {
    'use strict';
    var E = window.tourEngine, M = window.tourMusic;
    var PLAY_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z" fill="currentColor"></path></svg>';
    var PAUSE_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor"></path></svg>';
    var SOUND_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor"></path><path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6 6 0 0 1 0 9" stroke="currentColor" stroke-width="1.4" fill="none"></path></svg>';
    var MUTED_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor"></path><path d="M11 6l4 4M15 6l-4 4" stroke="currentColor" stroke-width="1.4"></path></svg>';
    function q(id) { return document.getElementById(id); }
    var cv = q('trCanvas'), ctx = cv.getContext('2d'), scrub = q('trScrub'), play = q('trPlay'), mute = q('trMute');
    var search = location.search.slice(1);
    var rec = /(?:^|&)record(?:[=&]|$)/.test(search);
    var checking = /(?:^|&)check(?:[=&]|$)/.test(search);
    var said = /(?:^|&)lang=(zh|en)(?:&|$)/.exec(search);
    var lang = said ? said[1] : window.FK_I18N ? window.FK_I18N.lang : 'zh';
    if (rec) document.body.classList.add('rec');
    var css = getComputedStyle(document.documentElement);
    var P = E.palette(function (k) { return css.getPropertyValue('--' + k).trim(); }, lang);
    cv.dataset.lang = P.lang;
    // The timeline the hash names — #promo30@900 — or reel. Read here, before
    // marks() draws the beats, so the marks are the named timeline's.
    var hashed = /^#(\w+)@(\d+)$/.exec(location.hash);
    var name = hashed && E.names().indexOf(hashed[1]) >= 0 ? hashed[1] : 'reel';
    var frame = 0, playing = false, t0 = 0, f0 = 0;

    // The score, made once on the first play: the PCM from tour-music.js in
    // an AudioBuffer, through one gain node the mute button sets.
    var audio = null, muted = false;
    function sound() {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (rec || !M || !AC) return null;
        if (!audio) {
            var ac = new AC(), pcm = M.render(E.get(name).cues, E.length(name));
            var buf = ac.createBuffer(1, pcm.length, M.RATE);
            buf.getChannelData(0).set(pcm);
            var gain = ac.createGain();
            gain.gain.value = muted ? 0 : 1;
            gain.connect(ac.destination);
            audio = { ac: ac, buf: buf, gain: gain, src: null, t0: 0, f0: 0 };
        }
        return audio;
    }
    function soundStop() {
        if (!audio || !audio.src) return;
        try { audio.src.stop(); } catch (e) { /* already ended */ }
        audio.src.disconnect();
        audio.src = null;
    }
    function soundFrom(f) {
        var a = sound();
        if (!a) return;
        soundStop();
        if (a.ac.state === 'suspended') a.ac.resume();
        var src = a.ac.createBufferSource();
        src.buffer = a.buf;
        src.connect(a.gain);
        src.start(0, f / E.FPS);
        a.src = src;
        a.t0 = a.ac.currentTime;
        a.f0 = f;
    }
    function setMute(on) {
        muted = on;
        if (audio) audio.gain.gain.value = on ? 0 : 1;
        mute.setAttribute('aria-pressed', String(on));
        mute.setAttribute('aria-label', on ? '取消靜音' : '靜音');
        mute.innerHTML = on ? MUTED_SVG : SOUND_SVG;
    }

    // Nothing is drawn until the timeline's own `ready` (its icons) settles.
    var settled = false;
    function paint() {
        if (!settled) return;
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
        soundStop();
        play.setAttribute('aria-pressed', 'false');
        play.setAttribute('aria-label', '播放');
        play.innerHTML = PLAY_SVG;
    }
    // The audio clock while the sound runs, the wall clock otherwise.
    function now() {
        if (audio && audio.src && audio.ac.state === 'running') return audio.f0 + Math.floor((audio.ac.currentTime - audio.t0) * E.FPS);
        return f0 + Math.floor((performance.now() - t0) * E.FPS / 1000);
    }
    function step() {
        if (!playing) return;
        var last = E.length(name) - 1, f = now();
        if (f >= last) { seek(last); stop(); return; }
        seek(f);
        requestAnimationFrame(step);
    }
    function start() {
        if (frame >= E.length(name) - 1) seek(0);
        playing = true;
        t0 = performance.now();
        f0 = frame;
        soundFrom(frame);
        play.setAttribute('aria-pressed', 'true');
        play.setAttribute('aria-label', '暫停');
        play.innerHTML = PAUSE_SVG;
        requestAnimationFrame(step);
    }
    function toggle() { if (playing) stop(); else start(); }

    play.addEventListener('click', toggle);
    mute.addEventListener('click', function () { setMute(!muted); });
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

    // ?check: every fifth frame drawn with the fit log on; the strings that
    // did not fit, and the table's strings never drawn through fit, go on
    // the canvas for tests/tour-page.test.js to read.
    function check() {
        var log = [], strings = E.get(name).strings;
        E.fitLog(log);
        for (var f = 0; f < E.length(name); f += 5) E.render(ctx, name, f, { palette: P });
        E.fitLog(null);
        var over = {}, drawn = log.map(function (e) { if (e.over) over[e.s] = 1; return e.s; }).join('\n');
        cv.dataset.overflow = JSON.stringify(Object.keys(over));
        cv.dataset.missing = JSON.stringify(Object.keys(strings).filter(function (k) { return drawn.indexOf(strings[k][P.lang].trim()) < 0; }));
    }

    marks();
    setMute(false);
    seek(hashed && hashed[1] === name ? Number(hashed[2]) : 0);

    window.tour = { seek: seek, length: function (n) { return E.length(n); }, ready: false };
    // A timeline may carry `ready`, a promise (promo30v5's icons): the first
    // paint and tour.ready wait for it; a rejection names the icon on the
    // canvas (data-error) and tour.ready stays false.
    var tlReady = E.get(name).ready || Promise.resolve();
    Promise.all([document.fonts ? document.fonts.ready : Promise.resolve(), tlReady]).then(function () {
        settled = true;
        if (checking) check();
        paint();
        window.tour.ready = true;
        cv.dataset.ready = 'true';
    }, function (e) {
        cv.dataset.error = String((e && e.message) || e);
        console.error('tour: ' + cv.dataset.error);
    });
})();
