#!/usr/bin/env node
'use strict';

// Sets the output style without making anyone open /config.
//
// The point of a style is that it lives in the system prompt: sent verbatim on
// every request, never touched by compaction, and one copy however long the
// session runs. What it costs is that the user has to pick it, and people do not
// go and change settings — they ask. So this is what the skill runs when they do.
//
// It writes `outputStyle` into settings.json, which is the same field /config
// writes. Nothing here is fankeel-specific: a style set this way stays set after
// fankeel is uninstalled, which is correct — it is the user's setting, not this
// plugin's state.

const path = require('node:path');

const settings = require('../lib/settings.js');
const registry = require('../lib/registry.js');
const { STYLES, NAMES, byName, byAny } = require('../lib/styles.js');

// Whether a running session picks up a settings.json change without restarting.
//
// Set from an observed test, not from reading the documentation: the style's
// per-turn reminder is visible in the transcript, so switching the field and
// watching for that line answers it outright.
//
// While this is false, setting a style also writes a four-line digest into the
// session entry so the current session gets the voice immediately; the full
// style takes over from the next session. If it turns out to be true, the digest
// is dead weight and both it and this constant come out.
const SETTINGS_RELOAD_IS_LIVE = false;

function parseArgs(argv) {
    const out = { want: null, sessionId: null, root: null, dir: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--session') { if (argv[i + 1]) out.sessionId = argv[++i]; continue; }
        if (a === '--root') { if (argv[i + 1]) out.root = argv[++i]; continue; }
        if (a === '--claude-dir') { if (argv[i + 1]) out.dir = argv[++i]; continue; }
        if (a.startsWith('--')) continue;
        if (!out.want) out.want = String(a).toLowerCase().trim();
    }
    return out;
}

const choices = () => STYLES.map((s) => '  ' + s.name.padEnd(9) + s.summary);

function status(dir) {
    const set = settings.currentOutputStyle(dir);
    if (!set) return 'output style: none set — Claude Code’s default voice.';
    const known = byAny(set);
    return known
        ? 'output style: ' + known.name + ' (' + known.file + ')'
        : 'output style: ' + set + ' — not one of fankeel’s.';
}

// The bridge is only written for a session that already owns an active task,
// because the field lives on that entry and there is nothing to attach it to
// otherwise. A session with no task still gets the setting, which is the durable
// half and the half that matters.
function bridge(root, sessionId, styleName) {
    if (SETTINGS_RELOAD_IS_LIVE) return { attempted: false };
    if (!root || !sessionId) return { attempted: false };
    const ok = registry.setStyle(root, sessionId, styleName);
    return { attempted: true, ok };
}

function main(argv) {
    const args = parseArgs(argv);
    const dir = args.dir || settings.claudeDir();
    if (!dir) return { text: 'fankeel style: no home directory, so settings.json cannot be found.', ok: false };

    if (!args.want) {
        return { text: [status(dir), '', 'choices:'].concat(choices(), [
            '',
            'Set one with `node ' + path.basename(__filename) + ' <name>`, or `off` to clear it.',
        ]).join('\n'), ok: true };
    }

    const clearing = args.want === 'off' || args.want === 'none' || args.want === 'default';
    const style = clearing ? null : byName(args.want);
    if (!clearing && !style) {
        return {
            text: ['fankeel style: no style called "' + args.want + '".', '', 'choices:'].concat(choices()).join('\n'),
            ok: false,
        };
    }

    const result = settings.setOutputStyle(dir, style ? style.file : null);
    if (!result.ok) {
        // A file that will not parse and a write that would not go through are
        // different problems and get different advice. Telling someone to fix a
        // file by hand when the real fault is a permission is how an hour goes.
        const advice = result.state === 'write-failed'
            ? 'Nothing was written. Check that the path is right and writable.'
            : 'Nothing was written. Fix the file by hand rather than letting this overwrite it.';
        return {
            text: 'fankeel style: ' + result.file + ' is ' + result.state + ' (' + result.reason + ').\n' + advice,
            ok: false,
        };
    }

    const lines = [];
    if (clearing) {
        lines.push(result.changed
            ? 'output style cleared. Back to Claude Code’s default voice.'
            : 'output style was already unset. Nothing to do.');
    } else {
        lines.push(result.changed
            ? 'output style set to ' + style.name + ' (' + style.file + ').'
            : 'output style was already ' + style.name + '. Nothing to do.');
        lines.push('  ' + style.summary);
    }
    if (result.backup) lines.push('  previous settings.json kept at ' + path.basename(result.backup));

    const b = bridge(args.root, args.sessionId, clearing ? null : style.name);
    if (b.attempted && b.ok) {
        lines.push('');
        lines.push(clearing
            ? 'The injected digest is switched off for this session too.'
            : 'This session gets a four-line digest of it on every prompt, so the voice starts now.');
        lines.push('The full style is in the system prompt from your next session, and the digest stops there.');
    } else if (b.attempted && !clearing) {
        lines.push('');
        lines.push('No fankeel task in this session, so nothing bridges the gap: the style');
        lines.push('takes effect from your next Claude Code session.');
    }

    return { text: lines.join('\n'), ok: true };
}

if (require.main === module) {
    const { text, ok } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    process.exit(ok ? 0 : 1);
}

module.exports = { SETTINGS_RELOAD_IS_LIVE, parseArgs, status, main, NAMES };
