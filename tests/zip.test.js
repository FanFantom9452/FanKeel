'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const zip = require('../lib/zip.js');

const BUNDLE = 'bundles/2026-11-02-aaaaaaaa.jsonl.gz';

// The same bytes with every `from` swapped for `to`; both are one length, so
// every offset in the ZIP still holds.
function rename(buf, from, to) {
    return Buffer.from(buf.toString('latin1').split(from).join(to), 'latin1');
}

// A ZIP the way a file manager writes one: a directory entry, then the file
// compressed with DEFLATE.
function deflated(name, data) {
    const parts = [];
    const central = [];
    let offset = 0;
    for (const [n, body, method] of [['bundles/', Buffer.alloc(0), 0], [name, data, 8]]) {
        const nb = Buffer.from(n, 'utf8');
        const packed = method === 8 ? zlib.deflateRawSync(body) : body;
        const lh = Buffer.alloc(30);
        lh.writeUInt32LE(0x04034b50, 0);
        lh.writeUInt16LE(20, 4);
        lh.writeUInt16LE(method, 8);
        lh.writeUInt32LE(zlib.crc32(body), 14);
        lh.writeUInt32LE(packed.length, 18);
        lh.writeUInt32LE(body.length, 22);
        lh.writeUInt16LE(nb.length, 26);
        const ch = Buffer.alloc(46);
        ch.writeUInt32LE(0x02014b50, 0);
        ch.writeUInt16LE(20, 4);
        ch.writeUInt16LE(20, 6);
        ch.writeUInt16LE(method, 10);
        ch.writeUInt32LE(zlib.crc32(body), 16);
        ch.writeUInt32LE(packed.length, 20);
        ch.writeUInt32LE(body.length, 24);
        ch.writeUInt16LE(nb.length, 28);
        ch.writeUInt32LE(offset, 42);
        parts.push(lh, nb, packed);
        central.push(ch, nb);
        offset += 30 + nb.length + packed.length;
    }
    const cd = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(2, 8);
    end.writeUInt16LE(2, 10);
    end.writeUInt32LE(cd.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...parts, cd, end]);
}

test('write then read gives back every entry, name and bytes', () => {
    const entries = [
        { name: 'manifest.json', data: Buffer.from('{"export":1}') },
        { name: 'report.md', data: Buffer.from('# 跨 session 回顧\n') },
        { name: BUNDLE, data: zlib.gzipSync('{"bundle":1}\n') },
    ];
    const back = zip.read(zip.write(entries));
    assert.deepEqual(back.map((e) => e.name), entries.map((e) => e.name));
    for (let i = 0; i < entries.length; i++) assert.ok(back[i].data.equals(entries[i].data), entries[i].name);
});

test('one changed byte of an entry is caught by its CRC', () => {
    const buf = zip.write([{ name: 'report.md', data: Buffer.from('hello world') }]);
    buf[buf.indexOf('hello world')] = 'j'.charCodeAt(0);
    assert.throws(() => zip.read(buf), /CRC/);
});

test('a name that is absolute or climbs out with .. is refused on write and on read', () => {
    for (const name of ['../x', 'a/../../x', '/etc/x', 'C:/x', '\\x']) {
        assert.throws(() => zip.write([{ name, data: Buffer.from('x') }]), /absolute or climbs out/, name);
    }
    const buf = rename(zip.write([{ name: 'zz/x', data: Buffer.from('x') }]), 'zz/x', '../x');
    assert.throws(() => zip.read(buf), /absolute or climbs out/);
});

test('a ZIP compressed again with DEFLATE reads, its directory entry skipped', () => {
    const data = zlib.gzipSync('{"bundle":1}\n'.repeat(50));
    const back = zip.read(deflated(BUNDLE, data));
    assert.deepEqual(back.map((e) => e.name), [BUNDLE]);
    assert.ok(back[0].data.equals(data));
});

test('ZIP64, encryption, a split ZIP and a buffer that is not a ZIP are refused by name', () => {
    const empty = zip.write([]);
    empty.writeUInt16LE(0xffff, 10);
    assert.throws(() => zip.read(empty), /ZIP64/);
    const one = zip.write([{ name: 'report.md', data: Buffer.from('x') }]);
    const cd = one.readUInt32LE(one.length - 6);
    one.writeUInt16LE(1, cd + 8);
    assert.throws(() => zip.read(one), /encrypted/);
    const split = zip.write([]);
    split.writeUInt16LE(1, 4);
    assert.throws(() => zip.read(split), /split/);
    assert.throws(() => zip.read(Buffer.from('not a zip at all, just text')), /not a ZIP/);
});
