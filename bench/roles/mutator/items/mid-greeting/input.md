Apply one mutation and report what the tests do.

- The mutation: in `lib/greet.js` at line 4, change `'Hello, '` to `'Hi, '`.
- The command: `node --test spec/greet.spec.js spec/upper.spec.js`

Run the command once before the mutation, apply the mutation, run it again, then restore `lib/greet.js` exactly as it was. Reply with the summary lines the command printed each time — the `pass` and `fail` counts — under the headings `before:` and `after:`, then the output of `git diff --stat`. If line 4 of `lib/greet.js` does not hold `'Hello, '`, change nothing, run nothing, and reply with one line, `refused: <why>`.
