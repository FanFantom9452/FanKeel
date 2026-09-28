// assets/station/tour-stages.js — the promo (1:00, 3600 frames = 30 bars at
// 120 BPM): eleven cuts, each a document page whose blocks rise on the beat,
// no terminal anywhere. hook 0–239, route 240–479, the seven stages 360
// frames each from 480, clash 3000–3239, outro 3240–3599 — every cut starts
// on a bar line (a multiple of 120). The cuts themselves are
// tour-opening.js (hook … build) and tour-closing.js (verify … outro); this
// file puts them end to end, registers the timeline, and hands the score its
// cues: the frame each cut starts on and the frame each block rises on. The
// storyboard is .fankeel/build/2026-09-28-tour-blocks/mockup.html.
(function (root, module) {
    'use strict';
    var E = root.tourEngine || require('./tour.js');
    var A = root.tourOpening || require('./tour-opening.js');
    var B = root.tourClosing || require('./tour-closing.js');

    var CUTS = A.CUTS.concat(B.CUTS);
    var LENGTH = 3600;
    var STARTS = [];
    var end = CUTS.reduce(function (at, c) { STARTS.push(at); return at + c.len; }, 0);
    if (end !== LENGTH) throw new Error('tour: the cuts run to ' + end + ' frames, not ' + LENGTH);

    function draw(ctx, f, P) {
        var i = CUTS.length - 1;
        while (i > 0 && STARTS[i] > f) i--;
        CUTS[i].draw(ctx, P, f - STARTS[i]);
    }

    // The storyboard's own stills, three a cut.
    var STILLS = [66, 156, 225, 255, 345, 465, 525, 615, 810, 885, 1065, 1155, 1305, 1386, 1530, 1665, 1815, 1905,
        1995, 2115, 2250, 2355, 2475, 2610, 2715, 2865, 2970, 3045, 3135, 3225, 3285, 3375, 3540];

    var TOUR_STAGES = {
        length: LENGTH,
        beats: CUTS.map(function (c, i) {
            var b = { at: STARTS[i], label: c.name };
            if (E.ROUTE.indexOf(c.name) >= 0) b.stage = c.name;
            return b;
        }),
        stills: STILLS,
        cues: {
            cuts: STARTS.slice(),
            blocks: CUTS.reduce(function (out, c, i) { return out.concat(c.beats.map(function (b) { return STARTS[i] + b; })); }, []),
        },
        draw: draw,
    };
    E.register('stages', TOUR_STAGES);

    module.exports = { TOUR_STAGES: TOUR_STAGES };
})(typeof window !== 'undefined' ? window : globalThis, typeof module !== 'undefined' ? module : {});
