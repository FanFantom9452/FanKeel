Apply one mutation and report what the tests do.

- The mutation: in `lib/find.js` at line 5, change `return null;` to `return undefined;`.
- The command: `node --test spec/find.spec.js`

Run the command once before the mutation, apply the mutation, run it again, then restore `lib/find.js` exactly as it was. Reply with the summary lines the command printed each time — the `pass` and `fail` counts — under the headings `before:` and `after:`, then the output of `git diff --stat`. If line 5 of `lib/find.js` does not hold `return null;`, change nothing, run nothing, and reply with one line, `refused: <why>`.
