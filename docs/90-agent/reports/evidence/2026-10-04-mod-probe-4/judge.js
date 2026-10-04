'use strict';
// mod 探測第四輪 (d) 的判定，docs/90-agent/plans/2026-10-04-mod-probe-4.md。
// 只看 proxy 存下的請求本文與 debug 檔，不看模型自述。
// 用法：node judge.js <證據資料夾>，讀 <dir>/mod-off/ 與 <dir>/mod-on/ 的 bodies/ 與 debug.log。
const fs = require('fs');
const path = require('path');

// 破折號用 fromCharCode 產生：轉錄時 U+2014 可能被換成別的字。
const DASH = String.fromCharCode(0x2014);
const ACTIVE = 'FANKEEL ACTIVE ' + DASH + ' mod-probe d @ survey';
const BRIEF = 'FANKEEL ' + DASH + ' you are a subagent of: mod-probe d @ survey';
const LOADED = 'hooks module fankeel-mod-probe@inline loaded';

function readBodies(arm) {
    const dir = path.join(arm, 'bodies');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => {
        const raw = fs.readFileSync(path.join(dir, f), 'utf8');
        // 解析後再序列化：跳脫寫法的非 ASCII 字變回原字，破折號才比得到。
        let text = raw;
        try { text = JSON.stringify(JSON.parse(raw)); } catch (e) { text = raw; }
        return { file: f, text };
    });
}

// true：debug.log 有 mod 的載入行；false：沒有；null：沒有 debug.log。
function loaded(arm) {
    const file = path.join(arm, 'debug.log');
    if (!fs.existsSync(file)) return null;
    return fs.readFileSync(file, 'utf8').includes(LOADED);
}

function scan(arm) {
    const bodies = readBodies(arm);
    const hit = (needle) => bodies.filter((b) => b.text.includes(needle)).map((b) => b.file);
    return { bodies: bodies.length, active: hit(ACTIVE), brief: hit(BRIEF), anyFankeel: hit('FANKEEL').length, loaded: loaded(arm) };
}

// 對照臂兩樣都找得到、兩臂的載入行各如其分，量測才算數；否則判無效，不判沒有干擾。
function verdict(off, on) {
    const why = [];
    if (off.loaded !== false) why.push('對照臂的 debug.log ' + (off.loaded === null ? '不存在' : '有 mod 載入行'));
    if (on.loaded !== true) why.push('mod 臂的 debug.log ' + (on.loaded === null ? '不存在' : '沒有 mod 載入行'));
    if (!off.active.length) why.push('對照臂本文沒有受控 stage 區塊');
    if (!off.brief.length) why.push('對照臂本文沒有 reader 的 FANKEEL 行');
    if (why.length) return { verdict: '無效', why };
    const miss = [];
    if (!on.active.length) miss.push('mod 臂本文沒有受控 stage 區塊');
    if (!on.brief.length) miss.push('mod 臂本文沒有 reader 的 FANKEEL 行');
    return miss.length ? { verdict: '有干擾', why: miss } : { verdict: '沒有干擾', why: [] };
}

function report(dir) {
    const off = scan(path.join(dir, 'mod-off'));
    const on = scan(path.join(dir, 'mod-on'));
    const lines = [];
    for (const [name, arm] of [['mod-off', off], ['mod-on', on]]) {
        lines.push(name + ': bodies=' + arm.bodies + ' loaded=' + arm.loaded + ' anyFankeel=' + arm.anyFankeel);
        lines.push('  active: ' + (arm.active.join(', ') || 'none'));
        lines.push('  brief: ' + (arm.brief.join(', ') || 'none'));
    }
    const v = verdict(off, on);
    lines.push('verdict: ' + v.verdict + (v.why.length ? ' ' + DASH + ' ' + v.why.join('；') : ''));
    return lines.join('\n');
}

if (require.main === module) {
    const dir = process.argv[2];
    if (!dir) {
        process.stderr.write('usage: node judge.js <evidence dir>\n');
        process.exit(2);
    }
    process.stdout.write(report(dir) + '\n');
}
