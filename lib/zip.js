'use strict';

// The ZIP container a retro export travels in
// (docs/90-agent/plans/2026-11-02-retro-zip-design.md §6). `write` stores only,
// since every bundle is gzip'd already; `read` takes stored and deflated
// entries, so a ZIP the receiver's file manager compressed again still reads.
// No ZIP64, encryption or split archives: each is refused by name.

const zlib = require('node:zlib');

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;
const UTF8 = 0x0800;

// An entry name that would land outside the directory it is unpacked into.
function unsafe(name) {
    return !name || /^[\\/]/.test(name) || /^[A-Za-z]:/.test(name) || name.split(/[\\/]/).includes('..');
}

function dosTime(d) {
    return {
        time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
        date: ((Math.max(d.getFullYear(), 1980) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    };
}

function write(entries, when) {
    if (entries.length > 0xfffe) throw new Error('more than 65534 entries needs ZIP64, which is not supported');
    const { time, date } = dosTime(when || new Date());
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const e of entries) {
        if (unsafe(e.name)) throw new Error('entry name ' + JSON.stringify(e.name) + ' is absolute or climbs out with ..');
        const name = Buffer.from(e.name, 'utf8');
        const data = Buffer.from(e.data);
        if (data.length >= 0xffffffff || offset >= 0xffffffff) throw new Error(e.name + ' is past 4 GB, which needs ZIP64');
        const crc = zlib.crc32(data);
        const lh = Buffer.alloc(30);
        lh.writeUInt32LE(LOCAL, 0);
        lh.writeUInt16LE(20, 4);
        lh.writeUInt16LE(UTF8, 6);
        lh.writeUInt16LE(0, 8);
        lh.writeUInt16LE(time, 10);
        lh.writeUInt16LE(date, 12);
        lh.writeUInt32LE(crc, 14);
        lh.writeUInt32LE(data.length, 18);
        lh.writeUInt32LE(data.length, 22);
        lh.writeUInt16LE(name.length, 26);
        lh.writeUInt16LE(0, 28);
        const ch = Buffer.alloc(46);
        ch.writeUInt32LE(CENTRAL, 0);
        ch.writeUInt16LE(20, 4);
        ch.writeUInt16LE(20, 6);
        ch.writeUInt16LE(UTF8, 8);
        ch.writeUInt16LE(0, 10);
        ch.writeUInt16LE(time, 12);
        ch.writeUInt16LE(date, 14);
        ch.writeUInt32LE(crc, 16);
        ch.writeUInt32LE(data.length, 20);
        ch.writeUInt32LE(data.length, 24);
        ch.writeUInt16LE(name.length, 28);
        ch.writeUInt32LE(offset, 42);
        locals.push(lh, name, data);
        centrals.push(ch, name);
        offset += lh.length + name.length + data.length;
    }
    const cd = Buffer.concat(centrals);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(END, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(cd.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, cd, end]);
}

// The end record is the last 22 bytes, or sits before a comment of up to 65535.
function endRecord(buf) {
    for (let at = buf.length - 22; at >= 0 && at >= buf.length - 22 - 0xffff; at--) {
        if (buf.readUInt32LE(at) === END) return at;
    }
    throw new Error('no end-of-central-directory record: not a ZIP, or cut short');
}

function read(buf) {
    const end = endRecord(buf);
    if (buf.readUInt16LE(end + 4) !== 0 || buf.readUInt16LE(end + 6) !== 0) throw new Error('a split (multi-volume) ZIP is not supported');
    const count = buf.readUInt16LE(end + 10);
    const cdOffset = buf.readUInt32LE(end + 16);
    if (count === 0xffff || cdOffset === 0xffffffff) throw new Error('a ZIP64 archive is not supported');
    const out = [];
    let at = cdOffset;
    for (let i = 0; i < count; i++) {
        if (at + 46 > buf.length || buf.readUInt32LE(at) !== CENTRAL) throw new Error('central directory entry ' + i + ' is damaged');
        const flags = buf.readUInt16LE(at + 8);
        const method = buf.readUInt16LE(at + 10);
        const crc = buf.readUInt32LE(at + 16);
        const csize = buf.readUInt32LE(at + 20);
        const usize = buf.readUInt32LE(at + 24);
        const nlen = buf.readUInt16LE(at + 28);
        const elen = buf.readUInt16LE(at + 30);
        const clen = buf.readUInt16LE(at + 32);
        const local = buf.readUInt32LE(at + 42);
        const name = buf.subarray(at + 46, at + 46 + nlen).toString('utf8');
        at += 46 + nlen + elen + clen;
        if (flags & 1) throw new Error(name + ' is encrypted, which is not supported');
        if (csize === 0xffffffff || usize === 0xffffffff || local === 0xffffffff) throw new Error(name + ' needs ZIP64, which is not supported');
        if (unsafe(name)) throw new Error('entry name ' + JSON.stringify(name) + ' is absolute or climbs out with ..');
        if (name.endsWith('/')) continue;
        if (local + 30 > buf.length || buf.readUInt32LE(local) !== LOCAL) throw new Error(name + ': its local header is missing');
        const from = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
        const raw = buf.subarray(from, from + csize);
        let data;
        if (method === 0) data = Buffer.from(raw);
        // Capped at the declared size, so a crafted entry cannot inflate past it.
        else if (method === 8) data = zlib.inflateRawSync(raw, { maxOutputLength: Math.max(usize, 1) });
        else throw new Error(name + ' uses compression method ' + method + '; only stored and deflate are read');
        if (data.length !== usize || zlib.crc32(data) !== crc) throw new Error(name + ' fails its CRC check: the ZIP is damaged');
        out.push({ name, data });
    }
    return out;
}

module.exports = { write, read };
