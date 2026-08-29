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

// Reached through the module rather than destructured, so a test can see the
// spawn. Destructured, `t.mock.method(cp, 'execFileSync')` binds a name nothing
// calls: the mock installs, observes nothing, and a test asserting "git was not
// spawned" passes whether or not it was.
const cp = require('node:child_process');
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
function gitList(dir, staged) {
    const args = ['ls-files', '-z', '--cached', '--others', '--exclude-standard'];
    if (staged) args.push('--stage');
    try {
        return cp.execFileSync('git', args, {
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

// A cached record under `--stage`: `<mode> <sha> <stage>\t<path>`. Anchored and
// bounded on every field, because an `--others` entry prints as the bare path
// and the two share one stream — `-z` does not quote, so a path may hold
// anything, including a tab.
const STAGED = /^([0-7]{6}) [0-9a-f]+ [0-3]\t/;

// The mode of a gitlink: a whole repository standing in the list as one entry,
// and the only thing in it that is not a file.
const GITLINK = '160000';

// The list, and which of it git has already said is a file.
//
// `--stage` is what makes the second half possible. Without it a gitlink and an
// extensionless file are the same string, so every caller that needs to tell
// them apart has to stat the path to be told what git knew all along: 8,585
// stats on a workspace of fifteen, against the 5ms `--stage` adds across the
// same thirty repositories.
// The parse, with no spawn in it. The serial path below and the pooled child in
// `lib/fanout.js` both hand their records here, so there is one answer to what a
// staged record means rather than two that can drift — which is the property the
// comment at the top of this file exists to protect.
function parseStaged(records) {
    const files = [];
    const known = new Set();
    for (const record of records) {
        const m = STAGED.exec(record);
        // No mode, so it came from `--others`. An untracked nested repository
        // prints there with a trailing slash and nothing else does, which
        // `isSubtree` already reads without asking the disk.
        if (!m) {
            files.push(record);
            if (!record.endsWith('/')) known.add(record);
            continue;
        }
        const rel = record.slice(m[0].length);
        files.push(rel);
        if (m[1] !== GITLINK) known.add(rel);
    }
    return { files, known };
}

function gitFiles(dir) {
    const staged = gitList(dir, true);
    // A git too old to take `--stage` beside `--others` refuses the whole call
    // rather than the flag. The retry costs one spawn where that happens and
    // returns exactly what this function returned before the flag existed: the
    // list, and nothing known about it. A wrong guess about git's version
    // degrades to statting, which is where this started.
    if (!staged) {
        const plain = gitList(dir, false);
        return plain ? { files: plain, known: new Set() } : null;
    }
    return parseStaged(staged);
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

// Below this many repositories the pool is a loss: a node process costs about
// 59ms to start on the machine this was measured on, and three serial
// `ls-files` come in under that. Four is where the pooled path first clears the
// start-up cost by a margin worth having — not a measured optimum, and the
// number here most likely to be wrong on a machine that is not that one.
const FANOUT_MIN = 4;

const FANOUT = path.join(__dirname, 'fanout.js');

const isRepo = (dir) => fs.existsSync(path.join(dir, '.git'));

// Whether `git ls-files` run here would answer at all — which is not the same
// question as `isRepo`. Run inside a subdirectory of a repository git walks up,
// finds the repository and lists that subdirectory, and that is the answer this
// scanner wants: the project's own ignore rules rather than the walk's fixed
// skip list. So a guard that only looked for `dir/.git` would push every such
// directory onto the walk and change its source, its count and its
// skipped-extension line at once.
//
// It stops where git stops, at the filesystem root. Cheap enough to sit in
// front of a process spawn: a handful of `existsSync` against the 29ms floor a
// spawn costs even when the answer is no.
function isInsideRepo(dir) {
    let at = path.resolve(dir);
    for (;;) {
        if (isRepo(at)) return true;
        const up = path.dirname(at);
        if (up === at) return false;
        at = up;
    }
}

// Depth-first, alphabetical, so two runs over one tree list the same files in
// the same order. A subdirectory that *is* a repository is recorded as one part
// and read afterwards — the best available source per subtree, which is what
// makes a workspace holding a mix of both come out whole.
//
// Recording rather than reading is what lets the repositories be read together.
// The walk decides the order, and which of them answered first never gets a say
// in it.
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
        // Parts rather than files, because a repository is one part here and its
        // file count is not known until it is read. The ceiling that decides the
        // answer is applied in `flatten`, where the files actually exist; this
        // one only stops the walk itself running away on a home directory.
        if (state.parts.length + (state.spent || 0) >= MAX_WALK_FILES) {
            state.truncated = true;
            return;
        }
        const sub = rel ? rel + '/' + entry.name : entry.name;
        if (entry.isDirectory()) {
            if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
            if (isRepo(path.join(root, sub))) {
                state.parts.push({ repo: sub });
                continue;
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
            state.parts.push(sub);
        }
    }
}

// The walk's parts, in the walk's order, turned into the flat list.
//
// `answers` holds what the pooled read said about the repositories the first
// walk found. A repository missing from it — because the pool was not used, or
// because the whole pooled call failed — is read here instead, serially, which
// is exactly what happened before there was a pool.
//
// This is where MAX_WALK_FILES is applied, and applying it here is the one
// behaviour this change alters. It used to be consulted as the walk went, so
// *which* repositories got read depended on how many files the earlier ones
// held: on a real workspace of thirty it read twenty-three and stopped, and
// nothing said which seven were missing. Now the tree is walked whole and the
// list is cut at the same number, so truncation is a function of the file order
// alone. `truncated: true` means what it always meant.
function flatten(root, parts, answers, state) {
    for (const part of parts) {
        if (state.files.length >= MAX_WALK_FILES) {
            state.truncated = true;
            return;
        }
        if (typeof part === 'string') {
            // The dirent already said this is a file, and saying so here is the
            // difference between a caller trusting it and a caller stat-ing the
            // same path to be told again. The git output spliced in below says
            // the same thing about its own entries, from the mode bits, so a
            // list over a mix of both leaves nothing for a caller to ask twice.
            state.known.add(part);
            state.files.push(part);
            continue;
        }
        const sub = part.repo;
        let got = answers.has(sub) ? answers.get(sub) : gitFiles(path.join(root, sub));
        // A `null` from the pool is not quite a `null` from `gitFiles`. The
        // pooled read has failure modes the serial one does not — eight spawns
        // at once can meet EAGAIN or EMFILE where one alone would not — and what
        // follows a `null` here is a walk, which swaps this subtree's source
        // from the project's own ignore rules to a fixed skip list without
        // saying so. One more spawn, on a path that is already the rare one, is
        // cheaper than a count nobody can explain.
        if (!got && answers.get(sub) === null) got = gitFiles(path.join(root, sub));
        if (got) {
            state.repos.push(sub);
            // Both halves carry the same prefix, or `known` names paths no entry
            // in `files` matches and every lookup misses silently — which reads
            // exactly like git having said nothing.
            for (const f of got.files) {
                if (state.files.length >= MAX_WALK_FILES) {
                    state.truncated = true;
                    return;
                }
                const at = sub + '/' + f;
                state.files.push(at);
                if (got.known.has(f)) state.known.add(at);
            }
            continue;
        }
        // git declined to read it, so it is walked instead — which is what
        // happened here before, just at a different moment. Anything nested
        // below it is read serially: this path is rare, and a second pooled call
        // for it would cost a process start to save less than one.
        // `spent` carries what has already been produced, so a root with many
        // declined repositories cannot walk a fresh 20000 parts for each one of
        // them. Without it the backstop resets every time round, and a tree that
        // yields no files never reaches the ceiling below either.
        const inner = { parts: [], truncated: false, unlistable: 0, skippedExt: 0, spent: state.files.length };
        walk(root, sub, inner);
        state.unlistable += inner.unlistable;
        state.skippedExt += inner.skippedExt;
        if (inner.truncated) state.truncated = true;
        flatten(root, inner.parts, new Map(), state);
    }
}

// One synchronous call onto a child that does the concurrency, so that nothing
// above this line becomes a promise. What comes back is handed to `parseStaged`
// — the same function the serial path uses — so there is one answer to what a
// staged record means.
//
// Every failure here returns an empty map rather than throwing, and an empty map
// means `flatten` reads each repository serially. The pool is an optimisation,
// and an optimisation that can take the answer down with it is not one.
function fanoutSync(root, repos) {
    const answers = new Map();
    let parsed;
    try {
        // 64MB rather than the 32 used elsewhere in this file: the payload is
        // the repositories' whole `ls-files` output, and JSON escapes every NUL
        // separator to six characters on the way through.
        const raw = cp.execFileSync(process.execPath, [FANOUT], {
            input: JSON.stringify({ root, repos }),
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
            stdio: ['pipe', 'pipe', 'ignore'],
        });
        parsed = JSON.parse(raw);
    } catch (e) {
        return answers;
    }
    for (const [sub, got] of Object.entries(parsed)) {
        if (!got) {
            answers.set(sub, null);
            continue;
        }
        const records = got.out.split('\0').filter(Boolean);
        answers.set(sub, got.staged ? parseStaged(records) : { files: records, known: new Set() });
    }
    return answers;
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
    // Asked before the spawn rather than after it. `gitFiles` returning null is
    // still what decides — a repository git declines to read falls through to
    // the walk exactly as before — but a directory with no repository above it
    // is now told so by `existsSync` instead of by a process. On a workspace of
    // fifteen where eleven are not repositories that is eleven spawns, and they
    // cost the same whether the answer is yes or no.
    const direct = isInsideRepo(root) ? gitFiles(root) : null;
    // `known` comes from git's own mode bits here, so it holds every entry but
    // the gitlinks. It was empty until `--stage` was asked for, and empty meant
    // the caller stat-ed all of them.
    if (direct) return { files: direct.files, known: direct.known, repos: [], walked: false, truncated: false, unlistable: 0, skippedExt: 0 };

    const found = { parts: [], truncated: false, unlistable: 0, skippedExt: 0 };
    walk(root, '', found);

    const repos = [];
    for (const part of found.parts) if (typeof part !== 'string') repos.push(part.repo);
    const answers = repos.length >= FANOUT_MIN ? fanoutSync(root, repos) : new Map();

    const state = {
        files: [], known: new Set(), repos: [],
        truncated: found.truncated, unlistable: found.unlistable, skippedExt: found.skippedExt,
    };
    flatten(root, found.parts, answers, state);
    if (opts && opts.stats) {
        opts.stats.unlistable = state.unlistable;
        // Both halves, or the caller can only say why for one of them. A root of
        // nothing but archives and images is as readable as a locked one and as
        // empty in the return, and reporting only `unlistable` made it
        // indistinguishable from a root with nothing in it at all.
        opts.stats.skippedExt = state.skippedExt;
    }
    // Nothing readable. Three subtrees that could not be listed is still nothing
    // readable — the count says why, and the caller that wants to say why asks
    // for it above.
    if (!state.files.length) return null;
    return { files: state.files, known: state.known, repos: state.repos, walked: true, truncated: state.truncated, unlistable: state.unlistable, skippedExt: state.skippedExt };
}

module.exports = { trackedFiles, isRepo, parseStaged, flatten, SKIP_EXT, MAX_WALK_FILES };
