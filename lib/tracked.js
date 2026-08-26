'use strict';

// What files are under this root, and where the answer came from.
//
// It lived in `scripts/survey.js` because the scanner was the first thing to need
// it. Then docs-check needed it, then orient, then docs-audit — and `lib/map.js`,
// which could not reach into `scripts/` from `lib/`, grew a second walk of its
// own instead. The two then disagreed: on this repository the map counted 75
// markdown files where docs-check counted 30, and six of the difference were
// filed as the project's own intent.
//
// So it lives here, where everything can reach it, and there is one answer.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// `--others --exclude-standard` alongside the cached list, so a file written
// this session is visible before it is committed.
//
// Plain `git ls-files` is tracked files only, which made the scanner blind to
// exactly the work in progress it is most often asked about. It caught itself:
// docs-check reported `detect()` as declared nowhere while `lib/docs.js` sat in
// the working tree, uncommitted. A scanner that cannot see the file you just
// wrote is the confident wrong answer this plugin exists to prevent.
function gitFiles(dir) {
    try {
        return execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
            cwd: dir,
            encoding: 'utf8',
            maxBuffer: 32 * 1024 * 1024,
            // Asking a directory that is not a repository is a normal step here,
            // not an error, and git says so on stderr. Inheriting that puts
            // `fatal: not a git repository` at the top of a report that then
            // goes on to work perfectly — and it gets quoted as if it meant
            // something.
            stdio: ['ignore', 'pipe', 'ignore'],
        })
            .split('\0')
            .filter(Boolean);
    } catch (e) {
        return null;
    }
}

// Directories a walk never descends into. Everything beginning with a dot is
// skipped as a rule, so this only has to name the ones that do not.
//
// `git ls-files` was the original and only source, on the reasoning that a
// repository already carries an ignore list and maintaining a second one is
// waste. That reasoning does not survive contact with a working directory where
// six of seven projects are not repositories: there, git found one of them and
// reported success, which is worse than reporting nothing. So the list gets
// maintained after all, and it is the price of working where git is not.
const SKIP_DIRS = new Set([
    'node_modules', 'venv', 'env', '__pycache__', 'site-packages',
    'dist', 'build', 'out', 'target', 'coverage', 'vendor',
    'bin', 'obj', 'Debug', 'Release', 'binaries',
]);

// Skipped when walking, and only when walking. A repository's own ignore rules
// already say what belongs to the project, and inside one a `.png` in the tree
// is there on purpose. A working directory has no such rules, and the first run
// against a real one returned eleven thousand files whose visible portion was
// entirely spreadsheets — the question being asked is what code already exists,
// and a document cannot answer it.
const SKIP_EXT = new Set([
    '.zip', '.7z', '.rar', '.tar', '.gz', '.xz', '.bz2',
    '.xlsx', '.xls', '.xlsm', '.docx', '.doc', '.pptx', '.ppt', '.pdf', '.odt', '.ods',
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico', '.mp4', '.mov', '.mp3', '.wav', '.avi',
    '.exe', '.dll', '.so', '.dylib', '.bin', '.msi', '.pyc', '.pyo', '.class', '.jar', '.o', '.a', '.lib', '.pdb',
    '.ttf', '.otf', '.woff', '.woff2', '.eot',
    '.db', '.sqlite', '.sqlite3', '.parquet', '.pkl', '.npy', '.onnx', '.safetensors',
]);

// A backstop, not a policy. Somebody's home directory would otherwise take
// minutes and produce a report nobody could read.
const MAX_WALK_FILES = 20000;

const isRepo = (dir) => fs.existsSync(path.join(dir, '.git'));

// Depth-first, alphabetical, so two runs over one tree list the same files in
// the same order. A subdirectory that *is* a repository is read with git rather
// than walked — the best available source per subtree, which is what makes a
// workspace holding a mix of both come out whole.
//
// The ceiling is checked once, per entry, in the loop below. A copy of it at the
// head of this function was unreachable: the only recursive call sits after that
// check, so nothing reaches here with the list already full.
function walk(root, rel, state) {
    let entries;
    try {
        entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
    } catch (e) {
        // A whole subtree, dropped. It used to be dropped silently, which in walk
        // mode — the multi-project root the scanner exists for — is the one loss
        // no line in the report accounted for. Counted here so the caller can say
        // so alongside the per-file skips.
        //
        // Only when the directory is there and closed. `ENOENT` is a path that
        // does not exist, and counting it turned `--root /no/such/dir` into "1
        // directory that could not be listed" over a walk that never ran — a
        // permission problem the reader does not have, in place of a typo they
        // do.
        if (e.code === 'EACCES' || e.code === 'EPERM') state.unlistable++;
        return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    for (const entry of entries) {
        if (state.files.length >= MAX_WALK_FILES) {
            state.truncated = true;
            return;
        }
        const sub = rel ? rel + '/' + entry.name : entry.name;
        if (entry.isDirectory()) {
            if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
            const full = path.join(root, sub);
            if (isRepo(full)) {
                const list = gitFiles(full);
                if (list) {
                    state.repos.push(sub);
                    for (const f of list) state.files.push(sub + '/' + f);
                    continue;
                }
            }
            walk(root, sub, state);
        } else if (entry.isFile()) {
            // Dropped, and counted. The comment on SKIP_EXT names eleven
            // thousand of these in one real run: a drop that size is the tree
            // rather than a detail of it, and uncounted it makes the report's
            // header read as coverage the scan never had.
            if (SKIP_EXT.has(path.extname(entry.name).toLowerCase())) {
                state.skippedExt++;
                continue;
            }
            state.files.push(sub);
        }
    }
}

// Every file under the root worth looking at, and an honest account of where the
// list came from.
//
// A root that is not itself a repository is normal — it is how related projects
// get kept together, and it is exactly the root a cross-project task opens at,
// because the collision warnings and the scope guard only reach across two
// projects from their common parent. Giving up there would take the scanner away
// from the case that needs it most.
// `stats`, when the caller passes one, is filled with what the walk had to drop.
// It is an out-parameter rather than a second return value because `null` here
// is a contract four callers key on, and two of them — `docs-check` and
// `docs-audit` — guard on `if (!result)` and nothing else. Returning a result
// for a root whose only subtree could not be listed, so that `survey` could
// count it, made both of those report a clean pass over a directory they never
// read: "0 markdown files … Every reference resolves.", exit 0. A caller that
// passes no `stats` gets exactly the old behaviour.
function trackedFiles(root, opts) {
    const direct = gitFiles(root);
    if (direct) return { files: direct, repos: [], walked: false, truncated: false, unlistable: 0, skippedExt: 0 };

    const state = { files: [], repos: [], truncated: false, unlistable: 0, skippedExt: 0 };
    walk(root, '', state);
    if (opts && opts.stats) opts.stats.unlistable = state.unlistable;
    // Nothing readable. Three subtrees that could not be listed is still nothing
    // readable — the count says why, and the caller that wants to say why asks
    // for it above.
    if (!state.files.length) return null;
    return { files: state.files, repos: state.repos, walked: true, truncated: state.truncated, unlistable: state.unlistable, skippedExt: state.skippedExt };
}

module.exports = { trackedFiles, isRepo, gitFiles, SKIP_DIRS, SKIP_EXT, MAX_WALK_FILES };
