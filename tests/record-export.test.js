'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const zip = require('../lib/zip.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'record.js');
const WIN = process.platform === 'win32';
// os.homedir() reads USERPROFILE on Windows and HOME elsewhere; a made-up one
// makes "no home directory left" checkable on any machine.
const HOME = WIN ? 'C:\\Users\\zedtester' : '/home/zedtester';
const SPELLINGS = [HOME + (WIN ? '\\proj' : '/proj'), HOME.split('\\').join('/') + '/b'].concat(WIN ? ['/c/Users/zedtester/c', 'C:\\USERS\\ZEDTESTER\\d'] : []);
const A = '2026-11-01-aaaaaaaa.jsonl.gz';
const B = '2026-11-02-bbbbbbbb.jsonl.gz';
const REPORT = 'recurring: mover commits — 2/2 bundles — evidence: aaaaaaaa turn 3, bbbbbbbb turn 5';
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// A bundle the way lib/bundle.js packs one: the head line, then { f, e } rows.
function gz(id) {
    const head = JSON.stringify({ bundle: 1, sessions: [id], files: [id + '.jsonl'], redacted: {} });
    const rows = SPELLINGS.map((p) => JSON.stringify({ f: id + '.jsonl', e: { type: 'user', version: '2.1.0', cwd: SPELLINGS[0], message: { role: 'user', content: 'open ' + p } } }));
    return zlib.gzipSync(head + '\n' + rows.join('\n') + '\n');
}

function run(root, args, input) {
    try {
        return { out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', root], { encoding: 'utf8', input: input || '', env: { ...process.env, HOME, USERPROFILE: HOME } }), code: 0 };
    } catch (e) {
        return { out: String(e.stdout || '') + String(e.stderr || ''), code: e.status };
    }
}

// Two bundles, a retro filed for the first, and a cross report; returns its anchor.
function seed() {
    const root = tmp('fankeel-rexp-');
    const dir = path.join(root, '.fankeel', 'bundles');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, A), gz('aaaaaaaa'));
    fs.writeFileSync(path.join(dir, B), gz('bbbbbbbb'));
    assert.equal(run(root, ['retro', '--bundle', 'aaaaaaaa'], 'retro: aaaaaaaa — 5 turns read, 0 hunks\nclean').code, 0);
    const r = run(root, ['retro', '--cross'], REPORT);
    assert.equal(r.code, 0, r.out);
    return { root, anchor: /#(x-\S+)/.exec(r.out)[1] };
}

const exported = (root, out) => path.join(root, ...(/^export: (\S+)$/m.exec(out)[1]).split('/'));
const entries = (file) => new Map(zip.read(fs.readFileSync(file)).map((e) => [e.name, e.data]));

test('export writes a gitignored ZIP of manifest, report and bundles, every home directory turned into [HOME]', () => {
    const s = seed();
    const r = run(s.root, ['export', '--cross', s.anchor, '--bundles', 'aaaaaaaa,bbbbbbbb']);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /^export: \.fankeel\/exports\/retro-\d{4}-\d{2}-\d{2}-[0-9a-f]{8}\.zip$/m);
    assert.match(r.out, /2 bundles，homeMasked: true/);
    assert.match(r.out, /不要上傳到 Gitea/);
    assert.match(fs.readFileSync(path.join(s.root, '.fankeel', '.gitignore'), 'utf8'), /^exports\/$/m);
    const got = entries(exported(s.root, r.out));
    assert.deepEqual([...got.keys()], ['manifest.json', 'report.md', 'bundles/' + A, 'bundles/' + B]);
    const m = JSON.parse(got.get('manifest.json').toString('utf8'));
    assert.deepEqual(Object.keys(m).sort(), ['arch', 'bundles', 'claudeCode', 'created', 'engines', 'export', 'fankeel', 'gitHead', 'homeMasked', 'node', 'osRelease', 'packages', 'platform']);
    assert.equal(m.homeMasked, true);
    assert.deepEqual(m.claudeCode, ['2.1.0']);
    assert.ok(!/zedtester/i.test(got.get('manifest.json').toString('utf8')), 'the manifest names the home directory');
    for (const b of m.bundles) {
        const data = got.get('bundles/' + b.name);
        assert.equal(b.sha256, sha256(data), b.name);
        assert.equal(b.bytes, data.length, b.name);
        const text = zlib.gunzipSync(data).toString('utf8');
        assert.ok(!/zedtester/i.test(text), b.name + ' still holds the home directory');
        assert.ok(text.includes('[HOME]'), b.name);
        assert.equal(text.split('\n')[0], zlib.gunzipSync(gz(b.name.slice(11, 19))).toString('utf8').split('\n')[0], 'the head line changed');
    }
    const report = got.get('report.md').toString('utf8');
    assert.ok(report.includes(REPORT) && report.includes('<summary>retro aaaaaaaa '));
    assert.ok(zlib.gunzipSync(fs.readFileSync(path.join(s.root, '.fankeel', 'bundles', A))).toString('utf8').includes('zedtester'), 'the bundle on disk was rewritten');
});

test('--keep-home leaves the paths as they were and says so in the manifest', () => {
    const s = seed();
    const r = run(s.root, ['export', '--cross', s.anchor, '--bundles', 'aaaaaaaa', '--keep-home']);
    assert.equal(r.code, 0, r.out);
    const got = entries(exported(s.root, r.out));
    assert.equal(JSON.parse(got.get('manifest.json').toString('utf8')).homeMasked, false);
    assert.ok(zlib.gunzipSync(got.get('bundles/' + A)).toString('utf8').includes('zedtester'));
});

test('--global-packages adds a globalPackages field, a list or an unavailable line', () => {
    const s = seed();
    const r = run(s.root, ['export', '--cross', s.anchor, '--bundles', 'aaaaaaaa', '--global-packages']);
    assert.equal(r.code, 0, r.out);
    const m = JSON.parse(entries(exported(s.root, r.out)).get('manifest.json').toString('utf8'));
    assert.ok(typeof m.globalPackages === 'object' || /^unavailable: /.test(m.globalPackages), JSON.stringify(m.globalPackages));
});

test('an anchor or a bundle that is not there is refused by name and nothing is written', () => {
    const s = seed();
    const r = run(s.root, ['export', '--cross', 'x-1999-01-01', '--bundles', 'aaaaaaaa,dddddddd']);
    assert.equal(r.code, 1);
    assert.match(r.out, /x-1999-01-01/);
    assert.match(r.out, /bundle dddddddd/);
    assert.equal(fs.existsSync(path.join(s.root, '.fankeel', 'exports')), false);
});

test('import puts the bundles where sessions --list reads them, files the report, and skips a name already there', () => {
    const s = seed();
    const zipFile = exported(s.root, run(s.root, ['export', '--cross', s.anchor, '--bundles', 'aaaaaaaa,bbbbbbbb']).out);
    const other = tmp('fankeel-rimp-');
    const r = run(other, ['import', zipFile]);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /imported: 2 bundles/);
    assert.match(r.out, /manifest: fankeel \S+ · node v\d+/);
    const list = run(other, ['sessions', '--list']).out;
    assert.match(list, /\.fankeel\/bundles\/2026-11-01-aaaaaaaa\.jsonl\.gz\s+[\d.]+ MB\s+local/);
    assert.match(list, /\.fankeel\/bundles\/2026-11-02-bbbbbbbb\.jsonl\.gz/);
    const stem = path.basename(zipFile, '.zip');
    for (const n of ['manifest.json', 'report.md']) assert.ok(fs.existsSync(path.join(other, '.fankeel', 'imports', stem, n)), n);
    const ignore = fs.readFileSync(path.join(other, '.fankeel', '.gitignore'), 'utf8');
    assert.match(ignore, /^bundles\/$/m);
    assert.match(ignore, /^imports\/$/m);
    fs.writeFileSync(path.join(other, '.fankeel', 'bundles', A), 'mine');
    const again = run(other, ['import', zipFile]);
    assert.equal(again.code, 0, again.out);
    assert.match(again.out, /imported: 0 bundles/);
    assert.match(again.out, new RegExp('skipped: ' + A.replace(/\./g, '\\.') + ', ' + B.replace(/\./g, '\\.')));
    assert.equal(fs.readFileSync(path.join(other, '.fankeel', 'bundles', A), 'utf8'), 'mine');
});

test('import refuses a bundle whose sha256 is not the manifest\'s, and writes nothing', () => {
    const s = seed();
    const zipFile = exported(s.root, run(s.root, ['export', '--cross', s.anchor, '--bundles', 'aaaaaaaa']).out);
    const got = zip.read(fs.readFileSync(zipFile));
    const m = JSON.parse(got[0].data.toString('utf8'));
    m.bundles[0].sha256 = '0'.repeat(64);
    got[0].data = Buffer.from(JSON.stringify(m));
    const bad = path.join(tmp('fankeel-rimp-'), 'bad.zip');
    fs.writeFileSync(bad, zip.write(got));
    const other = tmp('fankeel-rimp-');
    const r = run(other, ['import', bad]);
    assert.equal(r.code, 1);
    assert.match(r.out, /does not match its sha256/);
    assert.equal(fs.existsSync(path.join(other, '.fankeel')), false);
});
