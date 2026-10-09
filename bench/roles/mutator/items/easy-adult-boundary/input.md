Apply one mutation and report what the tests do.

- The mutation: in `lib/adult.js` at line 4, change `age >= 18` to `age > 18`.
- The command: `node --test spec/adult.spec.js`

Run the command once before the mutation, apply the mutation, run it again, then restore `lib/adult.js` exactly as it was. Reply with the summary lines the command printed each time — the `pass` and `fail` counts — under the headings `before:` and `after:`, then the output of `git diff --stat`. If line 4 of `lib/adult.js` does not hold `age >= 18`, change nothing, run nothing, and reply with one line, `refused: <why>`.
